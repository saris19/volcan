import type { CSSProperties } from 'react';
import { AlertLevel } from '../gen/galeras/v1/common_pb';
import type { SeismicEvent } from '../gen/galeras/v1/alerts_pb';
import { formatInteger, formatNumber, formatTime } from '../lib/format';
import { LEVEL_INFO } from '../lib/levels';

interface AlertHeroProps {
  level: AlertLevel;
  message: string;
  updatedAtMs: number;
  eventsLastWindow: number;
  activeStations: number;
  totalStations: number;
  latestEvent: SeismicEvent | undefined;
  totalMessages: number;
}

export function AlertHero(props: AlertHeroProps) {
  const levelInfo = LEVEL_INFO[props.level];
  const style = { '--level-color': levelInfo.cssVar } as CSSProperties;

  return (
    <section className="hero" id="top" aria-labelledby="hero-title" style={style}>
      <div className="container hero__grid">
        <div>
          <p className="eyebrow">Sistema de alerta temprana · Volcán Galeras · Datos simulados</p>
          <h1 className="hero__title" id="hero-title">
            <span className="hero__level-dot" aria-hidden="true" />
            <span>
              Nivel <span className="hero__level">{levelInfo.label}</span>
            </span>
          </h1>
          <p className="hero__message" role="status" aria-live="polite">
            {props.message}
          </p>
          <p className="hero__meta mono">
            {props.updatedAtMs > 0 ? `Actualizado ${formatTime(props.updatedAtMs)} · vía AlertService.SubscribeAlerts` : 'Esperando el primer mensaje del stream… Si el backend está en un plan gratuito puede tardar hasta 1 minuto en despertar.'}
          </p>
        </div>

        <dl className="metrics" aria-label="Indicadores en vivo">
          <div className="metric">
            <dt className="metric__label">Eventos · 2 min</dt>
            <dd className="metric__value">{formatInteger(props.eventsLastWindow)}</dd>
          </div>
          <div className="metric">
            <dt className="metric__label">Estaciones con actividad</dt>
            <dd className="metric__value">
              {props.activeStations}
              <span className="muted"> / {props.totalStations}</span>
            </dd>
          </div>
          <div className="metric">
            <dt className="metric__label">Último STA/LTA</dt>
            <dd className="metric__value">{props.latestEvent ? formatNumber(props.latestEvent.staLtaRatio) : '—'}</dd>
            <dd className="metric__hint">{props.latestEvent ? props.latestEvent.stationId : 'Sin eventos'}</dd>
          </div>
          <div className="metric">
            <dt className="metric__label">Mensajes gRPC recibidos</dt>
            <dd className="metric__value">{formatInteger(props.totalMessages)}</dd>
            <dd className="metric__hint">En esta sesión del navegador</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
