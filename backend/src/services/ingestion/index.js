import { galeras } from '../../shared/proto.js';
import { createClient, keepAlive, requireEnv, startServer } from '../../shared/grpc-utils.js';
import { logger } from '../../shared/logger.js';
import { SAMPLE_RATE_HZ, STATIONS, STATION_BY_ID } from '../../shared/stations.js';

const ANALYSIS_WINDOW_SECONDS = 2;
const SAMPLES_PER_WINDOW = SAMPLE_RATE_HZ * ANALYSIS_WINDOW_SECONDS;

const stationBuffers = new Map(); // stationId -> { startTimeMs, samples[] }
const signalWatchers = new Set(); // server-streaming calls from the frontend
let analysisStream = null;
const stats = { windowsForwarded: 0, classificationsReceived: 0 };

/**
 * BIDIRECTIONAL: a single long-lived stream to the analysis service.
 * Windows go out and classifications come back on the same HTTP/2 connection.
 */
function runAnalysisStream(analysisClient) {
  return new Promise((resolve, reject) => {
    const call = analysisClient.analyzeStream();
    analysisStream = call;
    logger.info('Analysis stream opened (bidirectional)');

    call.on('data', (classification) => {
      stats.classificationsReceived += 1;
      if (classification.isEvent) {
        logger.info(
          `Event at ${classification.stationId}: ratio ${classification.staLtaRatio.toFixed(2)} ` +
            `${classification.eventType} ${classification.level}`,
        );
      }
    });
    call.on('error', (error) => {
      analysisStream = null;
      reject(error);
    });
    call.on('end', () => {
      analysisStream = null;
      resolve();
    });
  });
}

function bufferReading(reading) {
  let buffer = stationBuffers.get(reading.stationId);
  if (!buffer) {
    buffer = { startTimeMs: reading.timestampMs, samples: [] };
    stationBuffers.set(reading.stationId, buffer);
  }
  buffer.samples.push(...reading.samples);

  while (buffer.samples.length >= SAMPLES_PER_WINDOW) {
    const window = {
      stationId: reading.stationId,
      startTimeMs: buffer.startTimeMs,
      sampleRateHz: reading.sampleRateHz,
      samples: buffer.samples.splice(0, SAMPLES_PER_WINDOW),
    };
    buffer.startTimeMs += ANALYSIS_WINDOW_SECONDS * 1000;
    if (analysisStream) {
      analysisStream.write(window);
      stats.windowsForwarded += 1;
    }
  }
}

function broadcastSignal(reading) {
  const signalChunk = {
    stationId: reading.stationId,
    startTimeMs: reading.timestampMs,
    sampleRateHz: reading.sampleRateHz,
    samples: reading.samples,
  };
  for (const watcher of signalWatchers) {
    if (watcher.stationFilter.size === 0 || watcher.stationFilter.has(reading.stationId)) {
      watcher.call.write(signalChunk);
    }
  }
}

const ingestionImplementation = {
  // CLIENT STREAMING: many readings in, one summary out.
  streamReadings(call, callback) {
    let readingsReceived = 0;
    const windowsAtStart = stats.windowsForwarded;
    logger.info('Simulator connected (client streaming)');

    call.on('data', (reading) => {
      if (!STATION_BY_ID.has(reading.stationId)) return;
      readingsReceived += 1;
      bufferReading(reading);
      broadcastSignal(reading);
    });
    call.on('end', () => {
      callback(null, { readingsReceived, windowsForwarded: stats.windowsForwarded - windowsAtStart });
    });
    call.on('error', (error) => logger.warn(`Reading stream error: ${error.message}`));
  },

  // SERVER STREAMING: live signal for the dashboard.
  watchSignal(call) {
    const watcher = { call, stationFilter: new Set(call.request.stationIds) };
    signalWatchers.add(watcher);
    logger.info(`Signal watcher connected (${signalWatchers.size} active)`);
    const removeWatcher = () => {
      signalWatchers.delete(watcher);
    };
    call.on('cancelled', removeWatcher);
    call.on('close', removeWatcher);
    call.on('error', removeWatcher);
  },

  // UNARY
  listStations(_call, callback) {
    callback(null, { stations: STATIONS });
  },
};

export async function start() {
  const analysisClient = createClient(galeras.AnalysisService, requireEnv('ANALYSIS_ADDR', 'localhost:50053'));
  await startServer('ingestion', [
    { service: galeras.IngestionService.service, implementation: ingestionImplementation },
  ]);
  keepAlive('analysis stream', () => runAnalysisStream(analysisClient));
  setInterval(() => {
    logger.info(
      `Stats: windows=${stats.windowsForwarded} classifications=${stats.classificationsReceived} watchers=${signalWatchers.size}`,
    );
  }, 60_000).unref();
}

