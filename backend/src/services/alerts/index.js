import { galeras, grpc } from '../../shared/proto.js';
import { startServer } from '../../shared/grpc-utils.js';
import { logger } from '../../shared/logger.js';
import { AlertState } from './alert-state.js';

const HEARTBEAT_INTERVAL_MS = 5_000;

const alertState = new AlertState();
const subscribers = new Set();
let lastBroadcastLevel = null;

function broadcast(update) {
  lastBroadcastLevel = update.currentLevel;
  for (const subscriber of subscribers) subscriber.write(update);
}

const alertImplementation = {
  // UNARY: analysis reports (or updates) an event.
  reportEvent(call, callback) {
    const event = call.request;
    if (!event.id || !event.stationId) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'Event requires id and stationId' });
    }
    alertState.upsertEvent(event);
    const update = alertState.snapshot(event);
    if (update.currentLevel !== lastBroadcastLevel) {
      logger.info(`Global level changed: ${lastBroadcastLevel} -> ${update.currentLevel}`);
    }
    broadcast(update);
    callback(null, { eventId: event.id, currentLevel: update.currentLevel });
  },

  // SERVER STREAMING: live alert updates to the dashboard.
  subscribeAlerts(call) {
    subscribers.add(call);
    logger.info(`Alert subscriber connected (${subscribers.size} active)`);
    call.write(alertState.snapshot()); // Estado inicial inmediato
    const removeSubscriber = () => subscribers.delete(call);
    call.on('cancelled', removeSubscriber);
    call.on('close', removeSubscriber);
    call.on('error', removeSubscriber);
  },

  // UNARY
  listRecentEvents(call, callback) {
    const limit = Math.min(Math.max(call.request.limit || 20, 1), 100);
    callback(null, { events: alertState.listEvents(limit) });
  },
};

export async function start() {
  await startServer('alerts', [{ service: galeras.AlertService.service, implementation: alertImplementation }]);
  // Heartbeat: mantiene vivos los streams a través de proxies y hace que el nivel
  // baje solo cuando los eventos salen de la ventana de evaluación.
  setInterval(() => broadcast(alertState.snapshot()), HEARTBEAT_INTERVAL_MS).unref();
}
