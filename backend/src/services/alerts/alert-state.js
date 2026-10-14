// Calcula el nivel de alerta global a partir de los eventos recientes.
// Nota: en la vida real el cambio de nivel lo decreta la autoridad competente;
// aquí se automatiza solo con fines académicos.

const EVALUATION_WINDOW_MS = Number(process.env.EVALUATION_WINDOW_MS || 120_000);
const MAX_STORED_EVENTS = 200;
const ESCALATION_EVENT_COUNT = 8; // Muchos eventos seguidos suben un nivel

const LEVELS = ['ALERT_LEVEL_GREEN', 'ALERT_LEVEL_YELLOW', 'ALERT_LEVEL_ORANGE', 'ALERT_LEVEL_RED'];

const LEVEL_MESSAGES = {
  ALERT_LEVEL_GREEN: 'Actividad estable. Sin eventos relevantes en la ventana de evaluación.',
  ALERT_LEVEL_YELLOW: 'Cambios en la actividad sísmica. Manténgase informado por canales oficiales.',
  ALERT_LEVEL_ORANGE: 'Actividad elevada. Prepare su plan de evacuación y ubique su punto de encuentro.',
  ALERT_LEVEL_RED: 'Actividad crítica. Evacúe las zonas de amenaza alta y media de inmediato.',
};

export class AlertState {
  constructor() {
    this.eventsById = new Map();
  }

  upsertEvent(event) {
    this.eventsById.set(event.id, event);
    if (this.eventsById.size > MAX_STORED_EVENTS) {
      const oldestId = this.eventsById.keys().next().value;
      this.eventsById.delete(oldestId);
    }
  }

  recentEvents(now = Date.now()) {
    return [...this.eventsById.values()].filter((event) => now - event.detectedAtMs <= EVALUATION_WINDOW_MS);
  }

  listEvents(limit) {
    return [...this.eventsById.values()].sort((a, b) => b.detectedAtMs - a.detectedAtMs).slice(0, limit);
  }

  currentLevel(now = Date.now()) {
    const recent = this.recentEvents(now);
    if (recent.length === 0) return 'ALERT_LEVEL_GREEN';
    let levelIndex = Math.max(...recent.map((event) => LEVELS.indexOf(event.level)), 0);
    if (recent.length >= ESCALATION_EVENT_COUNT) levelIndex = Math.min(levelIndex + 1, LEVELS.length - 1);
    return LEVELS[levelIndex];
  }

  snapshot(event = null) {
    const now = Date.now();
    const currentLevel = this.currentLevel(now);
    return {
      currentLevel,
      updatedAtMs: now,
      event,
      eventsLastWindow: this.recentEvents(now).length,
      message: LEVEL_MESSAGES[currentLevel],
    };
  }
}
