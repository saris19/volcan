import type { CSSProperties } from 'react';
import type { SeismicEvent } from '../gen/galeras/v1/alerts_pb';
import { formatNumber, formatTime } from '../lib/format';
import { EVENT_TYPE_LABEL, LEVEL_INFO } from '../lib/levels';

interface EventTableProps {
  events: SeismicEvent[];
}

export function EventTable({ events }: EventTableProps) {
  if (events.length === 0) {
    return (
      <div className="panel empty-state">
        <p className="empty-state__title">Aún no hay eventos</p>
        <p className="empty-state__text">
          Cuando el servicio de análisis detecte un evento, aparecerá aquí en tiempo real. Puedes provocar uno desde el panel de simulación.
        </p>
        <a className="button button--secondary" href="#simulation">
          Simular un evento →
        </a>
      </div>
    );
  }

  return (
    <div className="panel table-wrap">
      <table>
        <caption className="visually-hidden">Eventos sísmicos recientes, del más nuevo al más antiguo</caption>
        <thead>
          <tr>
            <th scope="col">Hora</th>
            <th scope="col">Estación</th>
            <th scope="col">Tipo</th>
            <th scope="col">Nivel</th>
            <th scope="col" className="numeric">STA/LTA</th>
            <th scope="col" className="numeric">Frecuencia</th>
            <th scope="col" className="numeric">Amplitud</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => {
            const levelInfo = LEVEL_INFO[event.level];
            return (
              <tr key={event.id}>
                <td className="mono">{formatTime(event.detectedAtMs)}</td>
                <td className="mono">{event.stationId}</td>
                <td>{EVENT_TYPE_LABEL[event.eventType]}</td>
                <td>
                  <span className="level-badge" style={{ '--level-color': levelInfo.cssVar } as CSSProperties}>
                    <span className="dot" aria-hidden="true" />
                    {levelInfo.label}
                  </span>
                </td>
                <td className="numeric">{formatNumber(event.staLtaRatio)}</td>
                <td className="numeric">{formatNumber(event.dominantFrequencyHz)} Hz</td>
                <td className="numeric">{formatNumber(event.peakAmplitude)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
