// Zonas de amenaza ILUSTRATIVAS (círculos concéntricos alrededor del cráter).
// No reemplazan el mapa oficial de amenaza volcánica del Servicio Geológico Colombiano.
import { CRATER_LOCATION } from '../../shared/stations.js';

export const RISK_ZONES = [
  {
    id: 'zone-high',
    name: 'Zona de amenaza alta',
    hazard: 'HAZARD_LEVEL_HIGH',
    center: CRATER_LOCATION,
    radiusKm: 6,
    localities: ['Sectores altos de Genoy', 'Mapachico', 'Área del cráter'],
  },
  {
    id: 'zone-medium',
    name: 'Zona de amenaza media',
    hazard: 'HAZARD_LEVEL_MEDIUM',
    center: CRATER_LOCATION,
    radiusKm: 12,
    localities: ['Consacá', 'Yacuanquer', 'La Florida', 'Nariño'],
  },
  {
    id: 'zone-low',
    name: 'Zona de amenaza baja',
    hazard: 'HAZARD_LEVEL_LOW',
    center: CRATER_LOCATION,
    radiusKm: 20,
    localities: ['Pasto (casco urbano)', 'Sandoná', 'Tangua'],
  },
];

export const SHELTERS = [
  { id: 'shelter-north', name: 'Punto de encuentro Norte', location: { latitude: 1.2400, longitude: -77.2700 }, capacity: 1500 },
  { id: 'shelter-east', name: 'Punto de encuentro Oriente', location: { latitude: 1.2050, longitude: -77.2550 }, capacity: 2500 },
  { id: 'shelter-south', name: 'Punto de encuentro Sur', location: { latitude: 1.1300, longitude: -77.3100 }, capacity: 1000 },
  { id: 'shelter-west', name: 'Punto de encuentro Occidente', location: { latitude: 1.1950, longitude: -77.5250 }, capacity: 800 },
];

// Qué zonas se evacúan según el nivel de alerta.
export const EVACUATION_POLICY = {
  ALERT_LEVEL_GREEN: [],
  ALERT_LEVEL_YELLOW: [],
  ALERT_LEVEL_ORANGE: ['HAZARD_LEVEL_HIGH'],
  ALERT_LEVEL_RED: ['HAZARD_LEVEL_HIGH', 'HAZARD_LEVEL_MEDIUM'],
};

export const RECOMMENDATIONS = {
  ALERT_LEVEL_GREEN: ['Conozca su zona de amenaza y su punto de encuentro más cercano.'],
  ALERT_LEVEL_YELLOW: [
    'Siga la información de fuentes oficiales.',
    'Revise su kit de emergencia: agua, linterna, radio, documentos y botiquín.',
  ],
  ALERT_LEVEL_ORANGE: [
    'Evacúe preventivamente la zona de amenaza alta.',
    'Tenga listo su kit de emergencia y defina con su familia la ruta de salida.',
    'Proteja vías respiratorias ante posible caída de ceniza.',
  ],
  ALERT_LEVEL_RED: [
    'Evacúe de inmediato las zonas de amenaza alta y media.',
    'Diríjase al punto de encuentro asignado siguiendo las rutas señalizadas.',
    'No regrese hasta que las autoridades lo indiquen.',
  ],
};
