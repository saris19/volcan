// Estaciones SIMULADAS alrededor del volcán Galeras.
// Coordenadas aproximadas e ilustrativas: no corresponden a la red oficial de monitoreo.
export const CRATER_LOCATION = { latitude: 1.2208, longitude: -77.3592 };

const RAW_STATIONS = [
  { id: 'GAL-CRA', name: 'Cráter', location: { latitude: 1.2190, longitude: -77.3620 } },
  { id: 'GAL-ANG', name: 'Anganoy', location: { latitude: 1.2150, longitude: -77.3200 } },
  { id: 'GAL-COB', name: 'Cobanegra', location: { latitude: 1.1950, longitude: -77.3550 } },
  { id: 'GAL-GEN', name: 'Genoy', location: { latitude: 1.2650, longitude: -77.3350 } },
  { id: 'GAL-CON', name: 'Consacá', location: { latitude: 1.2080, longitude: -77.4650 } },
];

export function haversineKm(pointA, pointB) {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(pointB.latitude - pointA.latitude);
  const deltaLon = toRadians(pointB.longitude - pointA.longitude);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(pointA.latitude)) * Math.cos(toRadians(pointB.latitude)) * Math.sin(deltaLon / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
}

export const STATIONS = RAW_STATIONS.map((station) => ({
  ...station,
  distanceToCraterKm: Number(haversineKm(station.location, CRATER_LOCATION).toFixed(2)),
}));

export const STATION_BY_ID = new Map(STATIONS.map((station) => [station.id, station]));

export const SAMPLE_RATE_HZ = 50;
