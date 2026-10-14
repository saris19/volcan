import { galeras, grpc } from '../../shared/proto.js';
import { createClient, keepAlive, requireEnv, startServer } from '../../shared/grpc-utils.js';
import { logger } from '../../shared/logger.js';
import { SAMPLE_RATE_HZ, STATIONS } from '../../shared/stations.js';
import { EVENT_TYPES, SignalGenerator } from './signal-generator.js';

const PACKET_INTERVAL_MS = 200;
const SAMPLES_PER_PACKET = (SAMPLE_RATE_HZ * PACKET_INTERVAL_MS) / 1000;
// Cloud Run corta las peticiones a los 60 min: reabrimos el stream antes.
const STREAM_MAX_DURATION_MS = Number(process.env.STREAM_MAX_DURATION_MS || 30 * 60_000);
const SPONTANEOUS_EVENTS = process.env.SPONTANEOUS_EVENTS !== 'false';

const generator = new SignalGenerator();

/**
 * CLIENT STREAMING: opens StreamReadings and keeps writing a packet per
 * station every 200 ms. When the stream closes, ingestion answers with a summary.
 */
function runReadingStream(ingestionClient) {
  return new Promise((resolve, reject) => {
    const call = ingestionClient.streamReadings((error, summary) => {
      clearInterval(timer);
      if (error) return reject(error);
      logger.info(`Stream closed by ingestion: ${JSON.stringify(summary)}`);
      resolve();
    });

    const openedAt = Date.now();
    let nextPacketStartMs = Date.now();
    logger.info('Reading stream opened (client streaming)');

    const timer = setInterval(() => {
      generator.pruneFinishedEvents();
      for (const station of STATIONS) {
        call.write({
          stationId: station.id,
          timestampMs: nextPacketStartMs,
          sampleRateHz: SAMPLE_RATE_HZ,
          samples: generator.generate(station, nextPacketStartMs, SAMPLES_PER_PACKET, SAMPLE_RATE_HZ),
        });
      }
      nextPacketStartMs += PACKET_INTERVAL_MS;
      if (Date.now() - openedAt > STREAM_MAX_DURATION_MS) {
        clearInterval(timer);
        call.end(); // Cierra el lado del cliente -> ingesta responde con el resumen
      }
    }, PACKET_INTERVAL_MS);
  });
}

function scheduleSpontaneousEvents() {
  const scheduleNext = () => {
    const delayMs = 45_000 + Math.random() * 75_000;
    setTimeout(() => {
      const eventType = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];
      const intensity = 1.5 + Math.random() * 3; // Eventos leves de fondo
      generator.addEvent(eventType, intensity);
      logger.info(`Spontaneous event: ${eventType} intensity ${intensity.toFixed(1)}`);
      scheduleNext();
    }, delayMs);
  };
  scheduleNext();
}

const simulatorControlImplementation = {
  // UNARIA: el frontend dispara un evento para la demo.
  triggerEvent(call, callback) {
    const { eventType, intensity } = call.request;
    if (!EVENT_TYPES.includes(eventType)) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: `Unknown event type: ${eventType}` });
    }
    if (!(intensity >= 1 && intensity <= 10)) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'Intensity must be between 1 and 10' });
    }
    generator.addEvent(eventType, intensity);
    logger.info(`Manual event: ${eventType} intensity ${intensity}`);
    callback(null, { accepted: true, message: `Evento simulado en curso (intensidad ${intensity})` });
  },
};

export async function start() {
  const ingestionClient = createClient(galeras.IngestionService, requireEnv('INGESTION_ADDR', 'localhost:50052'));
  await startServer('simulator', [
    { service: galeras.SimulatorControlService.service, implementation: simulatorControlImplementation },
  ]);
  if (SPONTANEOUS_EVENTS) scheduleSpontaneousEvents();
  keepAlive('reading stream', () => runReadingStream(ingestionClient));
}
