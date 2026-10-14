import { galeras } from '../../shared/proto.js';
import { startServer } from '../../shared/grpc-utils.js';
import { EVACUATION_POLICY, RECOMMENDATIONS, RISK_ZONES, SHELTERS } from './zones-data.js';

const riskZoneImplementation = {
  // UNARY: zones, shelters and recommendations for a given alert level.
  getRiskZones(call, callback) {
    const level = EVACUATION_POLICY[call.request.level] ? call.request.level : 'ALERT_LEVEL_GREEN';
    const hazardsToEvacuate = EVACUATION_POLICY[level];
    callback(null, {
      zones: RISK_ZONES.map((zone) => ({ ...zone, evacuate: hazardsToEvacuate.includes(zone.hazard) })),
      shelters: SHELTERS,
      recommendations: RECOMMENDATIONS[level],
    });
  },
};

export async function start() {
  await startServer('risk-zones', [
    { service: galeras.RiskZoneService.service, implementation: riskZoneImplementation },
  ]);
}
