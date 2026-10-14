import { useState, type FormEvent } from 'react';
import { ConnectError } from '@connectrpc/connect';
import { simulatorClient } from '../api/clients';
import { countMessage } from '../api/rpc-stats';
import { EventType } from '../gen/galeras/v1/common_pb';

type RequestState = { kind: 'idle' } | { kind: 'sending' } | { kind: 'success'; message: string } | { kind: 'error'; message: string };

const EVENT_OPTIONS = [
  { value: EventType.VOLCANO_TECTONIC, label: 'VT', description: 'Fractura · 8–12 Hz' },
  { value: EventType.LONG_PERIOD, label: 'LP', description: 'Fluidos · 1,5–3 Hz' },
  { value: EventType.TREMOR, label: 'Tremor', description: 'Sostenido · 22 s' },
];

export function SimulationPanel() {
  const [eventType, setEventType] = useState<EventType>(EventType.VOLCANO_TECTONIC);
  const [intensity, setIntensity] = useState(6);
  const [requestState, setRequestState] = useState<RequestState>({ kind: 'idle' });

  const handleSubmit = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    setRequestState({ kind: 'sending' });
    try {
      const response = await simulatorClient.triggerEvent({ eventType, intensity });
      countMessage('SimulatorControlService.TriggerEvent');
      setRequestState({ kind: 'success', message: `${response.message}. Observa el sismograma en unos segundos.` });
    } catch (error) {
      const reason = error instanceof ConnectError ? error.rawMessage : 'Error desconocido';
      setRequestState({ kind: 'error', message: `No se pudo contactar al simulador: ${reason}. Verifica que Envoy y el simulador estén en ejecución.` });
    }
  };

  return (
    <form className="panel" onSubmit={handleSubmit} aria-describedby="simulation-help">
      <div className="panel__body">
        <div className="control-grid">
          <fieldset>
            <legend>Tipo de evento</legend>
            <div className="segmented">
              {EVENT_OPTIONS.map((option) => (
                <label className="segmented__option" key={option.value}>
                  <input
                    type="radio"
                    name="event-type"
                    value={option.value}
                    checked={eventType === option.value}
                    onChange={() => setEventType(option.value)}
                  />
                  <span>
                    {option.label}
                    <small>{option.description}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label className="field-label" htmlFor="intensity">
              Intensidad
            </label>
            <div className="range-row">
              <input
                id="intensity"
                type="range"
                min={1}
                max={10}
                step={1}
                value={intensity}
                onChange={(changeEvent) => setIntensity(Number(changeEvent.target.value))}
              />
              <output className="range-value" htmlFor="intensity">
                {intensity}
              </output>
            </div>
            <p className="helper" id="simulation-help">
              Aproximado: 1–3 amarillo · 4–7 naranja · 8–10 rojo (depende de la distancia de cada estación).
            </p>
          </div>
        </div>

        <div className="actions">
          <button className="button button--primary" type="submit" disabled={requestState.kind === 'sending'}>
            {requestState.kind === 'sending' ? 'Enviando…' : 'Disparar evento →'}
          </button>
          <p
            className={`feedback ${requestState.kind === 'success' ? 'feedback--success' : ''} ${requestState.kind === 'error' ? 'feedback--error' : ''}`}
            role="status"
            aria-live="polite"
          >
            {requestState.kind === 'success' || requestState.kind === 'error' ? requestState.message : ''}
          </p>
        </div>
      </div>
    </form>
  );
}
