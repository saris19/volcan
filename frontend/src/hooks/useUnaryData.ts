import { useEffect, useState } from 'react';
import { ingestionClient, riskZoneClient } from '../api/clients';
import { countMessage } from '../api/rpc-stats';
import type { Station } from '../gen/galeras/v1/common_pb';
import { AlertLevel } from '../gen/galeras/v1/common_pb';
import type { GetRiskZonesResponse } from '../gen/galeras/v1/risk_zones_pb';

const RETRY_MS = 3_000;

/** UNARY: station list, retried until the backend answers. */
export function useStations(): Station[] {
  const [stations, setStations] = useState<Station[]>([]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = () => {
      ingestionClient
        .listStations({})
        .then((response) => {
          countMessage('IngestionService.ListStations');
          if (!cancelled) setStations(response.stations);
        })
        .catch(() => {
          if (!cancelled) timer = setTimeout(load, RETRY_MS);
        });
    };
    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return stations;
}

/** UNARY: zones and recommendations, requested again whenever the alert level changes. */
export function useRiskZones(level: AlertLevel): GetRiskZonesResponse | null {
  const [riskZones, setRiskZones] = useState<GetRiskZonesResponse | null>(null);

  useEffect(() => {
    if (level === AlertLevel.UNSPECIFIED) return;
    let cancelled = false;
    riskZoneClient
      .getRiskZones({ level })
      .then((response) => {
        countMessage('RiskZoneService.GetRiskZones');
        if (!cancelled) setRiskZones(response);
      })
      .catch((error) => console.warn('GetRiskZones failed', error));
    return () => {
      cancelled = true;
    };
  }, [level]);

  return riskZones;
}
