// Prueba de humo: ejercita los 4 tipos de RPC contra los servicios en ejecución.
// Uso: npm run smoke-test   (con los servicios ya levantados)
import { galeras } from '../src/shared/proto.js';
import { createClient } from '../src/shared/grpc-utils.js';

const address = (name, fallback) => process.env[name] || fallback;
const simulator = createClient(galeras.SimulatorControlService, address('SIMULATOR_ADDR', 'localhost:50051'));
const ingestion = createClient(galeras.IngestionService, address('INGESTION_ADDR', 'localhost:50052'));
const alerts = createClient(galeras.AlertService, address('ALERTS_ADDR', 'localhost:50054'));
const riskZones = createClient(galeras.RiskZoneService, address('RISK_ZONES_ADDR', 'localhost:50055'));

const unary = (client, method, request) =>
  new Promise((resolve, reject) => client[method](request, (error, response) => (error ? reject(error) : resolve(response))));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const { stations } = await unary(ingestion, 'listStations', {});
console.log(`✔ ListStations (unaria): ${stations.map((station) => station.id).join(', ')}`);

const zones = await unary(riskZones, 'getRiskZones', { level: 'ALERT_LEVEL_RED' });
console.log(`✔ GetRiskZones (unaria): ${zones.zones.length} zonas, evacuar: ${zones.zones.filter((z) => z.evacuate).map((z) => z.id)}`);

let signalChunks = 0;
const signalStream = ingestion.watchSignal({ stationIds: [] });
signalStream.on('data', () => (signalChunks += 1));
signalStream.on('error', () => {});

const levelsSeen = new Set();
const alertStream = alerts.subscribeAlerts({});
alertStream.on('data', (update) => levelsSeen.add(update.currentLevel));
alertStream.on('error', () => {});

await sleep(6_000); // Deja que el LTA de cada estación se estabilice
const trigger = await unary(simulator, 'triggerEvent', { eventType: 'EVENT_TYPE_VOLCANO_TECTONIC', intensity: 9 });
console.log(`✔ TriggerEvent (unaria): ${trigger.message}`);
await sleep(10_000);

console.log(`✔ WatchSignal (server streaming): ${signalChunks} fragmentos de señal recibidos`);
console.log(`✔ SubscribeAlerts (server streaming): niveles vistos ${[...levelsSeen].join(', ')}`);

const { events } = await unary(alerts, 'listRecentEvents', { limit: 10 });
console.log(`✔ ListRecentEvents (unaria): ${events.length} eventos`);
for (const event of events.slice(0, 5)) {
  console.log(`   ${event.stationId} ${event.eventType} ${event.level} STA/LTA=${event.staLtaRatio.toFixed(1)}`);
}

signalStream.cancel();
alertStream.cancel();
const passed = signalChunks > 0 && events.length > 0 && levelsSeen.size > 1;
console.log(passed ? '\nOK: el flujo client streaming -> bidireccional -> unaria -> server streaming funciona.' : '\nFALLÓ');
process.exit(passed ? 0 : 1);
