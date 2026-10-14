import { API_URL } from './api/clients';
import { getTotalMessages } from './api/rpc-stats';
import { AlertHero } from './components/AlertHero';
import { EventTable } from './components/EventTable';
import { RiskMap } from './components/RiskMap';
import { RpcTraffic } from './components/RpcTraffic';
import { SectionHeader } from './components/SectionHeader';
import { Seismograph } from './components/Seismograph';
import { SimulationPanel } from './components/SimulationPanel';
import { TopBar } from './components/TopBar';
import { ZonePanel } from './components/ZonePanel';
import { getActiveStationLevels, useAlerts } from './hooks/useAlerts';
import { useNow } from './hooks/useNow';
import { useSignal } from './hooks/useSignal';
import { useRiskZones, useStations } from './hooks/useUnaryData';

export function App() {
  const alerts = useAlerts();
  const signal = useSignal();
  const stations = useStations();
  const riskZones = useRiskZones(alerts.currentLevel);
  const now = useNow(1_000);
  const activeLevels = getActiveStationLevels(alerts.events, now);

  return (
    <>
      <a className="skip-link" href="#signal">
        Saltar al sismograma
      </a>
      <TopBar alertStatus={alerts.status} signalStatus={signal.status} />

      <main>
        <AlertHero
          level={alerts.currentLevel}
          message={alerts.message}
          updatedAtMs={alerts.updatedAtMs}
          eventsLastWindow={alerts.eventsLastWindow}
          activeStations={activeLevels.size}
          totalStations={stations.length}
          latestEvent={alerts.events[0]}
          totalMessages={getTotalMessages()}
        />

        <section className="section" id="signal" aria-labelledby="signal-title">
          <div className="container">
            <SectionHeader
              id="signal"
              eyebrow="IngestionService.WatchSignal · server streaming"
              title="Señal sísmica en vivo"
              description="Últimos 30 segundos de cada estación, a 50 muestras por segundo. Escala comprimida para ver a la vez el ruido de fondo y los eventos."
            />
            <Seismograph stations={stations} buffersRef={signal.buffersRef} activeLevels={activeLevels} />
          </div>
        </section>

        <section className="section" id="map" aria-labelledby="map-title">
          <div className="container">
            <SectionHeader
              id="map"
              eyebrow="RiskZoneService.GetRiskZones · unaria"
              title="Zonas de riesgo y evacuación"
              description="Las zonas y recomendaciones se vuelven a pedir cada vez que cambia el nivel de alerta."
            />
            <div className="map-layout">
              <RiskMap stations={stations} riskZones={riskZones} activeLevels={activeLevels} />
              <ZonePanel riskZones={riskZones} />
            </div>
          </div>
        </section>

        <section className="section" id="events" aria-labelledby="events-title">
          <div className="container">
            <SectionHeader
              id="events"
              eyebrow="AlertService.ListRecentEvents + SubscribeAlerts"
              title="Eventos detectados"
              description="Clasificados por el servicio de análisis con el método STA/LTA y la frecuencia dominante de la señal."
            />
            <EventTable events={alerts.events} />
          </div>
        </section>

        <section className="section" id="simulation" aria-labelledby="simulation-title">
          <div className="container">
            <SectionHeader
              id="simulation"
              eyebrow="SimulatorControlService.TriggerEvent · unaria"
              title="Simular un evento"
              description="Inyecta un evento en el simulador. Recorre todo el sistema: simulador → ingesta → análisis → alertas → este tablero."
            />
            <SimulationPanel />
          </div>
        </section>

        <section className="section" id="rpc" aria-labelledby="rpc-title">
          <div className="container">
            <SectionHeader
              id="rpc"
              eyebrow="Contratos .proto"
              title="Tráfico gRPC"
              description="Los cuatro tipos de llamada de gRPC presentes en el sistema. El navegador usa gRPC-Web a través de Envoy; los servicios internos se comunican con gRPC sobre HTTP/2."
              aside={<span className="tag mono">{API_URL}</span>}
            />
            <RpcTraffic />
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container">
          <p>
            Proyecto académico · Programación Web · Taller gRPC. Señales, estaciones y zonas son simuladas e ilustrativas: no representan la red oficial de monitoreo ni el mapa oficial de amenaza volcánica.
          </p>
          <p>Ante una emergencia real, siga únicamente la información del Servicio Geológico Colombiano y la Unidad Nacional para la Gestión del Riesgo de Desastres.</p>
        </div>
      </footer>
    </>
  );
}
