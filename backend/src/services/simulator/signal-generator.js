import { STATIONS } from '../../shared/stations.js';

const WAVE_SPEED_KM_PER_S = 3.0;

// Parámetros de cada tipo de evento simulado.
const EVENT_PROFILES = {
  EVENT_TYPE_VOLCANO_TECTONIC: { frequencyHz: [8, 12], durationMs: 5_000, riseMs: 150 },
  EVENT_TYPE_LONG_PERIOD: { frequencyHz: [1.5, 3], durationMs: 9_000, riseMs: 800 },
  EVENT_TYPE_TREMOR: { frequencyHz: [2, 4], durationMs: 22_000, riseMs: 3_000 },
};

export const EVENT_TYPES = Object.keys(EVENT_PROFILES);

function gaussianNoise() {
  // Box-Muller
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function randomBetween([min, max]) {
  return min + Math.random() * (max - min);
}

/**
 * Generates synthetic seismic signals for every station: background noise
 * plus events that propagate from the crater with delay and attenuation.
 */
export class SignalGenerator {
  constructor() {
    this.activeEvents = [];
    this.microseismPhase = new Map(STATIONS.map((station) => [station.id, Math.random() * Math.PI * 2]));
  }

  addEvent(eventType, intensity) {
    const profile = EVENT_PROFILES[eventType] ?? EVENT_PROFILES.EVENT_TYPE_VOLCANO_TECTONIC;
    const clampedIntensity = Math.min(10, Math.max(1, intensity));
    this.activeEvents.push({
      eventType,
      originMs: Date.now(),
      durationMs: profile.durationMs,
      riseMs: profile.riseMs,
      frequencyHz: randomBetween(profile.frequencyHz),
      // Amplitud en la fuente: crece de forma no lineal con la intensidad.
      sourceAmplitude: 1.2 * clampedIntensity ** 1.6,
    });
  }

  /** Returns `sampleCount` samples for a station starting at `startMs`. */
  generate(station, startMs, sampleCount, sampleRateHz) {
    const samples = new Float32Array(sampleCount);
    const phase = this.microseismPhase.get(station.id);
    const travelDelayMs = (station.distanceToCraterKm / WAVE_SPEED_KM_PER_S) * 1000;
    const attenuation = 1 / (1 + station.distanceToCraterKm / 4);

    for (let index = 0; index < sampleCount; index += 1) {
      const timeMs = startMs + (index * 1000) / sampleRateHz;
      const timeS = timeMs / 1000;
      // Ruido de fondo + microsismo oceánico (onda lenta).
      let value = 0.5 * gaussianNoise() + 0.3 * Math.sin(2 * Math.PI * 0.2 * timeS + phase);

      for (const event of this.activeEvents) {
        const elapsedMs = timeMs - event.originMs - travelDelayMs;
        if (elapsedMs < 0 || elapsedMs > event.durationMs) continue;
        value += event.sourceAmplitude * attenuation * envelope(event, elapsedMs) * waveform(event, elapsedMs);
      }
      samples[index] = value;
    }
    return Array.from(samples);
  }

  pruneFinishedEvents() {
    const maxDelayMs = 10_000;
    const now = Date.now();
    this.activeEvents = this.activeEvents.filter((event) => now - event.originMs < event.durationMs + maxDelayMs);
  }
}

function envelope(event, elapsedMs) {
  const rise = Math.min(1, elapsedMs / event.riseMs);
  if (event.eventType === 'EVENT_TYPE_TREMOR') {
    // Meseta sostenida con caída suave al final.
    const remaining = event.durationMs - elapsedMs;
    return rise * Math.min(1, remaining / 3_000);
  }
  // Subida rápida y decaimiento exponencial.
  const decay = Math.exp(-elapsedMs / (event.durationMs / 3.5));
  return rise * decay;
}

function waveform(event, elapsedMs) {
  const timeS = elapsedMs / 1000;
  const carrier = Math.sin(2 * Math.PI * event.frequencyHz * timeS);
  if (event.eventType === 'EVENT_TYPE_TREMOR') {
    // Modulación lenta típica del tremor.
    return carrier * (0.7 + 0.3 * Math.sin(2 * Math.PI * 0.3 * timeS)) + 0.15 * gaussianNoise();
  }
  return carrier + 0.2 * gaussianNoise();
}
