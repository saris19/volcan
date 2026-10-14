import type { GetRiskZonesResponse } from '../gen/galeras/v1/risk_zones_pb';
import { HAZARD_INFO } from '../lib/levels';

interface ZonePanelProps {
  riskZones: GetRiskZonesResponse | null;
}

export function ZonePanel({ riskZones }: ZonePanelProps) {
  if (!riskZones) {
    return (
      <div className="panel panel__body" role="status">
        <p className="muted" style={{ margin: 0 }}>
          Cargando zonas de riesgo (RiskZoneService.GetRiskZones)…
        </p>
      </div>
    );
  }

  return (
    <div className="stack">
      <section className="panel" aria-labelledby="recommendations-title">
        <div className="panel__header">
          <h3 className="panel__title" id="recommendations-title">
            Qué hacer ahora
          </h3>
        </div>
        <div className="panel__body">
          <ul className="recommendations">
            {riskZones.recommendations.map((recommendation) => (
              <li key={recommendation}>{recommendation}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="panel" aria-labelledby="zones-title">
        <div className="panel__header">
          <h3 className="panel__title" id="zones-title">
            Zonas de amenaza
          </h3>
        </div>
        <div className="panel__body" style={{ paddingBlock: 0 }}>
          <ul className="zone-list">
            {riskZones.zones.map((zone) => (
              <li className="zone-item" key={zone.id}>
                <div className="zone-item__head">
                  <span>
                    <span className="dot" style={{ color: HAZARD_INFO[zone.hazard].cssVar, display: 'inline-block', marginRight: 8 }} aria-hidden="true" />
                    {zone.name}
                  </span>
                  {zone.evacuate ? <span className="tag tag--danger">Evacuar</span> : <span className="tag">Sin evacuación</span>}
                </div>
                <p className="zone-item__localities">
                  Radio {zone.radiusKm} km · {zone.localities.join(', ')}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
