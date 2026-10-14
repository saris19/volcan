// Detector STA/LTA (Short-Term Average / Long-Term Average).
// STA = energía de la ventana actual; LTA = energía de fondo de la estación.
// Si STA/LTA supera un umbral, la ventana contiene un evento sísmico.

const EVENT_RATIO_THRESHOLD = 2.5;
const LEVEL_THRESHOLDS = [
  { minRatio: 18, level: 'ALERT_LEVEL_RED' },
  { minRatio: 8, level: 'ALERT_LEVEL_ORANGE' },
  { minRatio: EVENT_RATIO_THRESHOLD, level: 'ALERT_LEVEL_YELLOW' },
];
const VOLCANO_TECTONIC_MIN_FREQUENCY_HZ = 5;
const TREMOR_MIN_CONSECUTIVE_WINDOWS = 5; // 10 s de señal sostenida
const EPISODE_END_QUIET_WINDOWS = 2;

const LEVEL_RANK = {
  ALERT_LEVEL_UNSPECIFIED: 0,
  ALERT_LEVEL_GREEN: 1,
  ALERT_LEVEL_YELLOW: 2,
  ALERT_LEVEL_ORANGE: 3,
  ALERT_LEVEL_RED: 4,
};

function rootMeanSquare(samples) {
  const sumOfSquares = samples.reduce((sum, value) => sum + value * value, 0);
  return Math.sqrt(sumOfSquares / samples.length);
}

function removeMean(samples) {
  const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  return samples.map((value) => value - mean);
}

/**
 * Dominant frequency: the peak of a simple discrete Fourier transform
 * between 1 Hz and Nyquist (ignores the slow oceanic microseism).
 */
function estimateDominantFrequency(samples, sampleRateHz) {
  const durationS = samples.length / sampleRateHz;
  const resolutionHz = 1 / durationS;
  const nyquistHz = sampleRateHz / 2;
  let bestFrequencyHz = 0;
  let bestPower = -1;
  for (let frequencyHz = 1; frequencyHz < nyquistHz; frequencyHz += resolutionHz) {
    let real = 0;
    let imaginary = 0;
    for (let index = 0; index < samples.length; index += 1) {
      const angle = (2 * Math.PI * frequencyHz * index) / sampleRateHz;
      real += samples[index] * Math.cos(angle);
      imaginary -= samples[index] * Math.sin(angle);
    }
    const power = real * real + imaginary * imaginary;
    if (power > bestPower) {
      bestPower = power;
      bestFrequencyHz = frequencyHz;
    }
  }
  return bestFrequencyHz;
}

/** Keeps per-station state and groups consecutive event windows into episodes. */
export class StaLtaDetector {
  constructor() {
    this.stationStates = new Map();
  }

  getState(stationId) {
    if (!this.stationStates.has(stationId)) {
      this.stationStates.set(stationId, { longTermAverage: null, episode: null });
    }
    return this.stationStates.get(stationId);
  }

  /**
   * Classifies a window. Returns { classification, eventToReport } where
   * eventToReport is set when an episode starts, escalates or changes type.
   */
  analyze(window) {
    const state = this.getState(window.stationId);
    const samples = removeMean(window.samples);
    const shortTermAverage = rootMeanSquare(samples);

    if (state.longTermAverage === null) state.longTermAverage = shortTermAverage;
    const ratio = shortTermAverage / Math.max(state.longTermAverage, 1e-6);

    // El LTA se adapta rápido al ruido y casi nada durante un evento.
    const adaptation = ratio < EVENT_RATIO_THRESHOLD ? 0.05 : 0.002;
    state.longTermAverage = state.longTermAverage * (1 - adaptation) + shortTermAverage * adaptation;

    const isEvent = ratio >= EVENT_RATIO_THRESHOLD;
    const peakAmplitude = Math.max(...samples.map(Math.abs));
    const dominantFrequencyHz = estimateDominantFrequency(samples, window.sampleRateHz);
    const level = isEvent ? LEVEL_THRESHOLDS.find((threshold) => ratio >= threshold.minRatio).level : 'ALERT_LEVEL_GREEN';

    let eventType = 'EVENT_TYPE_UNSPECIFIED';
    let eventToReport = null;

    if (isEvent) {
      const isNewEpisode = !state.episode;
      if (isNewEpisode) {
        state.episode = {
          id: `${window.stationId}-${window.startTimeMs}`,
          startedAtMs: window.startTimeMs,
          eventWindows: 0,
          quietWindows: 0,
          maxRatio: 0,
          maxPeak: 0,
          level: 'ALERT_LEVEL_GREEN',
          eventType: 'EVENT_TYPE_UNSPECIFIED',
          frequencyHz: dominantFrequencyHz,
        };
      }
      const episode = state.episode;
      episode.eventWindows += 1;
      episode.quietWindows = 0;
      // La frecuencia del episodio se toma de su ventana más energética.
      if (ratio > episode.maxRatio) episode.frequencyHz = dominantFrequencyHz;
      episode.maxRatio = Math.max(episode.maxRatio, ratio);
      episode.maxPeak = Math.max(episode.maxPeak, peakAmplitude);

      const previousLevel = episode.level;
      const previousType = episode.eventType;
      if (LEVEL_RANK[level] > LEVEL_RANK[episode.level]) episode.level = level;

      if (episode.frequencyHz >= VOLCANO_TECTONIC_MIN_FREQUENCY_HZ) {
        episode.eventType = 'EVENT_TYPE_VOLCANO_TECTONIC';
      } else if (episode.eventWindows >= TREMOR_MIN_CONSECUTIVE_WINDOWS) {
        episode.eventType = 'EVENT_TYPE_TREMOR';
      } else {
        episode.eventType = 'EVENT_TYPE_LONG_PERIOD';
      }
      eventType = episode.eventType;

      if (isNewEpisode || episode.level !== previousLevel || episode.eventType !== previousType) {
        eventToReport = {
          id: episode.id,
          stationId: window.stationId,
          detectedAtMs: episode.startedAtMs,
          eventType: episode.eventType,
          level: episode.level,
          staLtaRatio: episode.maxRatio,
          peakAmplitude: episode.maxPeak,
          dominantFrequencyHz: episode.frequencyHz,
        };
      }
    } else if (state.episode) {
      state.episode.quietWindows += 1;
      if (state.episode.quietWindows >= EPISODE_END_QUIET_WINDOWS) state.episode = null;
    }

    return {
      classification: {
        stationId: window.stationId,
        startTimeMs: window.startTimeMs,
        staLtaRatio: ratio,
        peakAmplitude,
        dominantFrequencyHz,
        level,
        eventType,
        isEvent,
      },
      eventToReport,
    };
  }
}
