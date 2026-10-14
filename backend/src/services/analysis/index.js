import { galeras, grpc } from '../../shared/proto.js';
import { createClient, requireEnv, startServer } from '../../shared/grpc-utils.js';
import { logger } from '../../shared/logger.js';
import { StaLtaDetector } from './sta-lta-detector.js';

const detector = new StaLtaDetector();
let alertsClient;

function reportEvent(event) {
  // UNARY: analysis -> alerts
  alertsClient.reportEvent(event, { deadline: Date.now() + 5_000 }, (error, response) => {
    if (error) return logger.warn(`ReportEvent failed: ${error.message}`);
    logger.info(`Event ${response.eventId} reported. Global level: ${response.currentLevel}`);
  });
}

function isValidWindow(window) {
  return window.stationId && window.samples.length > 0 && window.sampleRateHz > 0;
}

const analysisImplementation = {
  // BIDIRECTIONAL: classify each window as it arrives.
  analyzeStream(call) {
    logger.info('Ingestion connected (bidirectional stream)');
    call.on('data', (window) => {
      if (!isValidWindow(window)) return;
      const { classification, eventToReport } = detector.analyze(window);
      call.write(classification);
      if (eventToReport) reportEvent(eventToReport);
    });
    call.on('end', () => call.end());
    call.on('error', (error) => logger.warn(`Analysis stream error: ${error.message}`));
  },

  // UNARY
  analyzeWindow(call, callback) {
    if (!isValidWindow(call.request)) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'Window requires stationId, samples and sampleRateHz' });
    }
    const { classification, eventToReport } = detector.analyze(call.request);
    if (eventToReport) reportEvent(eventToReport);
    callback(null, classification);
  },
};

export async function start() {
  alertsClient = createClient(galeras.AlertService, requireEnv('ALERTS_ADDR', 'localhost:50054'));
  await startServer('analysis', [
    { service: galeras.AnalysisService.service, implementation: analysisImplementation },
  ]);
}
