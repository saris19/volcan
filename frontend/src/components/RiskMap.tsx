import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Circle, CircleMarker, MapContainer, Marker, TileLayer, Tooltip } from 'react-leaflet';
import { AlertLevel, type Station } from '../gen/galeras/v1/common_pb';
import type { GetRiskZonesResponse } from '../gen/galeras/v1/risk_zones_pb';
import { HAZARD_HEX, LEVEL_HEX } from '../lib/levels';

interface RiskMapProps {
  stations: Station[];
  riskZones: GetRiskZonesResponse | null;
  activeLevels: Map<string, AlertLevel>;
}

const CRATER: [number, number] = [1.2208, -77.3592];

const craterIcon = L.divIcon({
  className: '',
  html: '<svg width="22" height="20" viewBox="0 0 22 20" aria-hidden="true"><path d="M11 1 L21 19 L1 19 Z" fill="#ff8a3d" stroke="#0b0d10" stroke-width="1.5"/></svg>',
  iconSize: [22, 20],
  iconAnchor: [11, 15],
});

export function RiskMap({ stations, riskZones, activeLevels }: RiskMapProps) {
  // Larger zones first so smaller ones stay on top and remain hoverable.
  const zones = [...(riskZones?.zones ?? [])].sort((a, b) => b.radiusKm - a.radiusKm);

  return (
    <div>
      <div className="map" role="region" aria-label="Mapa de zonas de amenaza, estaciones y puntos de encuentro">
        <MapContainer center={CRATER} zoom={10} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          {zones.map((zone) => (
            <Circle
              key={zone.id}
              center={[zone.center?.latitude ?? CRATER[0], zone.center?.longitude ?? CRATER[1]]}
              radius={zone.radiusKm * 1000}
              pathOptions={{
                color: HAZARD_HEX[zone.hazard],
                weight: zone.evacuate ? 2 : 1,
                dashArray: zone.evacuate ? undefined : '4 6',
                fillOpacity: zone.evacuate ? 0.18 : 0.04,
              }}
            >
              <Tooltip sticky>
                {zone.name}
                {zone.evacuate ? ' · EVACUAR' : ''}
              </Tooltip>
            </Circle>
          ))}
          <Marker position={CRATER} icon={craterIcon}>
            <Tooltip>Cráter del Galeras</Tooltip>
          </Marker>
          {stations.map((station) => {
            const level = activeLevels.get(station.id);
            return (
              <CircleMarker
                key={station.id}
                center={[station.location?.latitude ?? 0, station.location?.longitude ?? 0]}
                radius={level ? 8 : 6}
                pathOptions={{
                  color: '#0b0d10',
                  weight: 2,
                  fillColor: level ? LEVEL_HEX[level] : '#7cc4ff',
                  fillOpacity: 1,
                }}
              >
                <Tooltip>
                  {station.id} · {station.name}
                </Tooltip>
              </CircleMarker>
            );
          })}
          {riskZones?.shelters.map((shelter) => (
            <CircleMarker
              key={shelter.id}
              center={[shelter.location?.latitude ?? 0, shelter.location?.longitude ?? 0]}
              radius={5}
              pathOptions={{ color: '#eef1f4', weight: 2, fillColor: '#0b0d10', fillOpacity: 1 }}
            >
              <Tooltip>
                {shelter.name} · capacidad {shelter.capacity}
              </Tooltip>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
      <div className="legend" aria-hidden="true">
        <span className="legend__item">
          <span className="dot" style={{ color: '#ff8a3d' }} /> Cráter
        </span>
        <span className="legend__item">
          <span className="dot" style={{ color: '#7cc4ff' }} /> Estación (sin actividad)
        </span>
        <span className="legend__item">
          <span className="dot" style={{ color: '#eef1f4' }} /> Punto de encuentro
        </span>
        <span className="legend__item">Línea continua = zona a evacuar</span>
      </div>
    </div>
  );
}
