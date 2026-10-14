import { useCallback, useEffect, useState } from 'react';
import { alertClient } from '../api/clients';
import { countMessage } from '../api/rpc-stats';
import type { AlertUpdate, SeismicEvent } from '../gen/galeras/v1/alerts_pb';
import { AlertLevel } from '../gen/galeras/v1/common_pb';
import { useServerStream } from './useServerStream';

const MAX_EVENTS = 50;
const STATION_HIGHLIGHT_MS = 15_000;

export interface AlertsState {
  currentLevel: AlertLevel;
  message: string;
  eventsLastWindow: number;
  updatedAtMs: number;
  events: SeismicEvent[];
}

const INITIAL_STATE: AlertsState = {
  currentLevel: AlertLevel.UNSPECIFIED,
  message: 'Conectando con el servicio de alertas…',
  eventsLastWindow: 0,
  updatedAtMs: 0,
  events: [],
};

function upsertEvents(events: SeismicEvent[], incoming: SeismicEvent[]): SeismicEvent[] {
  const byId = new Map(events.map((event) => [event.id, event]));
  for (const event of incoming) byId.set(event.id, event);
  return [...byId.values()]
    .sort((a, b) => Number(b.detectedAtMs - a.detectedAtMs))
    .slice(0, MAX_EVENTS);
}

/** Live alert level (server streaming) + event history (unary). */
export function useAlerts() {
  const [state, setState] = useState<AlertsState>(INITIAL_STATE);

  useEffect(() => {
    alertClient
      .listRecentEvents({ limit: 20 })
      .then((response) => {
        countMessage('AlertService.ListRecentEvents');
        setState((previous) => ({ ...previous, events: upsertEvents(previous.events, response.events) }));
      })
      .catch((error) => console.warn('ListRecentEvents failed', error));
  }, []);

  const openStream = useCallback((signal: AbortSignal) => alertClient.subscribeAlerts({}, { signal }), []);
  const handleUpdate = useCallback((update: AlertUpdate) => {
    countMessage('AlertService.SubscribeAlerts');
    setState((previous) => ({
      currentLevel: update.currentLevel,
      message: update.message,
      eventsLastWindow: update.eventsLastWindow,
      updatedAtMs: Number(update.updatedAtMs),
      events: update.event ? upsertEvents(previous.events, [update.event]) : previous.events,
    }));
  }, []);

  const status = useServerStream(openStream, handleUpdate);
  return { ...state, status };
}

/** Most severe recent level per station, used to color the map and the traces. */
export function getActiveStationLevels(events: SeismicEvent[], now: number): Map<string, AlertLevel> {
  const levels = new Map<string, AlertLevel>();
  for (const event of events) {
    if (now - Number(event.detectedAtMs) > STATION_HIGHLIGHT_MS) continue;
    const previous = levels.get(event.stationId) ?? AlertLevel.UNSPECIFIED;
    if (event.level > previous) levels.set(event.stationId, event.level);
  }
  return levels;
}
