import { AlertLevel, EventType } from '../gen/galeras/v1/common_pb';
import { HazardLevel } from '../gen/galeras/v1/risk_zones_pb';

interface LevelInfo {
  label: string;
  cssVar: string;
}

export const LEVEL_INFO: Record<AlertLevel, LevelInfo> = {
  [AlertLevel.UNSPECIFIED]: { label: 'Sin datos', cssVar: 'var(--text-3)' },
  [AlertLevel.GREEN]: { label: 'Verde', cssVar: 'var(--level-green)' },
  [AlertLevel.YELLOW]: { label: 'Amarillo', cssVar: 'var(--level-yellow)' },
  [AlertLevel.ORANGE]: { label: 'Naranja', cssVar: 'var(--level-orange)' },
  [AlertLevel.RED]: { label: 'Rojo', cssVar: 'var(--level-red)' },
};

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  [EventType.UNSPECIFIED]: '—',
  [EventType.VOLCANO_TECTONIC]: 'Volcano-tectónico (VT)',
  [EventType.LONG_PERIOD]: 'Largo periodo (LP)',
  [EventType.TREMOR]: 'Tremor',
};

export const EVENT_TYPE_SHORT: Record<EventType, string> = {
  [EventType.UNSPECIFIED]: '—',
  [EventType.VOLCANO_TECTONIC]: 'VT',
  [EventType.LONG_PERIOD]: 'LP',
  [EventType.TREMOR]: 'TR',
};

export const HAZARD_INFO: Record<HazardLevel, LevelInfo> = {
  [HazardLevel.UNSPECIFIED]: { label: '—', cssVar: 'var(--text-3)' },
  [HazardLevel.HIGH]: { label: 'Alta', cssVar: 'var(--level-red)' },
  [HazardLevel.MEDIUM]: { label: 'Media', cssVar: 'var(--level-orange)' },
  [HazardLevel.LOW]: { label: 'Baja', cssVar: 'var(--level-yellow)' },
};

// Hex values for canvas and Leaflet (they cannot read CSS variables directly).
export const LEVEL_HEX: Record<AlertLevel, string> = {
  [AlertLevel.UNSPECIFIED]: '#6b7480',
  [AlertLevel.GREEN]: '#3ecf8e',
  [AlertLevel.YELLOW]: '#f2cc3d',
  [AlertLevel.ORANGE]: '#ff8a3d',
  [AlertLevel.RED]: '#ff4d4f',
};

export const HAZARD_HEX: Record<HazardLevel, string> = {
  [HazardLevel.UNSPECIFIED]: '#6b7480',
  [HazardLevel.HIGH]: '#ff4d4f',
  [HazardLevel.MEDIUM]: '#ff8a3d',
  [HazardLevel.LOW]: '#f2cc3d',
};
