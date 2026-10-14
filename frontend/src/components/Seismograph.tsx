import { useEffect, useRef, type MutableRefObject } from 'react';
import { AlertLevel, type Station } from '../gen/galeras/v1/common_pb';
import { SIGNAL_SECONDS, type SignalBuffer } from '../hooks/useSignal';
import { LEVEL_HEX } from '../lib/levels';
import { formatNumber } from '../lib/format';

interface SeismographProps {
  stations: Station[];
  buffersRef: MutableRefObject<Map<string, SignalBuffer>>;
  activeLevels: Map<string, AlertLevel>;
}

const ROW_HEIGHT_PX = 64;
const CLIP_AMPLITUDE = 50; // Valor que llena media fila
const BASE_TRACE_COLOR = 'rgba(163, 172, 182, 0.85)';
const GRID_COLOR = 'rgba(255, 255, 255, 0.06)';
const TIME_TICKS = [30, 25, 20, 15, 10, 5, 0];

/** sqrt compression so background noise and big events are both visible. */
function compress(value: number): number {
  return (Math.sign(value) * Math.sqrt(Math.abs(value))) / Math.sqrt(CLIP_AMPLITUDE);
}

export function Seismograph({ stations, buffersRef, activeLevels }: SeismographProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeLevelsRef = useRef(activeLevels);
  activeLevelsRef.current = activeLevels;
  const peakRefs = useRef(new Map<string, HTMLSpanElement | null>());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || stations.length === 0) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let animationFrame = 0;
    let lastPeakUpdate = 0;

    const draw = (timestamp: number) => {
      const pixelRatio = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = stations.length * ROW_HEIGHT_PX;
      if (canvas.width !== Math.round(width * pixelRatio) || canvas.height !== Math.round(height * pixelRatio)) {
        canvas.width = Math.round(width * pixelRatio);
        canvas.height = Math.round(height * pixelRatio);
      }
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);

      // Vertical grid every 5 s
      context.strokeStyle = GRID_COLOR;
      context.lineWidth = 1;
      for (const tick of TIME_TICKS) {
        const x = Math.round(width * (1 - tick / SIGNAL_SECONDS)) + 0.5;
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
      }

      stations.forEach((station, rowIndex) => {
        const centerY = rowIndex * ROW_HEIGHT_PX + ROW_HEIGHT_PX / 2;
        const halfRow = (ROW_HEIGHT_PX / 2) * 0.9;

        context.strokeStyle = GRID_COLOR;
        context.beginPath();
        context.moveTo(0, rowIndex * ROW_HEIGHT_PX + 0.5);
        context.lineTo(width, rowIndex * ROW_HEIGHT_PX + 0.5);
        context.stroke();

        const buffer = buffersRef.current.get(station.id);
        if (!buffer) return;
        const level = activeLevelsRef.current.get(station.id);
        context.strokeStyle = level ? LEVEL_HEX[level] : BASE_TRACE_COLOR;
        context.lineWidth = 1;

        // Min/max per pixel column: classic seismograph look and cheap to draw.
        const size = buffer.samples.length;
        const samplesPerPixel = size / width;
        context.beginPath();
        for (let x = 0; x < width; x += 1) {
          const from = Math.floor(x * samplesPerPixel);
          const to = Math.max(from + 1, Math.floor((x + 1) * samplesPerPixel));
          let min = Infinity;
          let max = -Infinity;
          for (let index = from; index < to; index += 1) {
            const value = buffer.samples[(buffer.writeIndex + index) % size];
            if (value < min) min = value;
            if (value > max) max = value;
          }
          const yTop = centerY - Math.max(-1, Math.min(1, compress(max))) * halfRow;
          const yBottom = centerY - Math.max(-1, Math.min(1, compress(min))) * halfRow;
          context.moveTo(x + 0.5, yTop);
          context.lineTo(x + 0.5, Math.max(yBottom, yTop + 1));
        }
        context.stroke();
      });

      if (timestamp - lastPeakUpdate > 250) {
        lastPeakUpdate = timestamp;
        for (const station of stations) {
          const element = peakRefs.current.get(station.id);
          const buffer = buffersRef.current.get(station.id);
          if (element) element.textContent = buffer ? `pico ${formatNumber(buffer.lastPeak)}` : 'sin señal';
        }
      }

      animationFrame = requestAnimationFrame(draw);
    };

    animationFrame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animationFrame);
  }, [stations, buffersRef]);

  if (stations.length === 0) {
    return (
      <div className="panel empty-trace" role="status">
        Esperando la lista de estaciones (IngestionService.ListStations)…
      </div>
    );
  }

  return (
    <figure className="panel" style={{ margin: 0 }}>
      <div className="seismograph">
        <div className="seismograph__labels">
          {stations.map((station) => {
            const level = activeLevels.get(station.id);
            return (
              <div className="trace-label" key={station.id}>
                <span className="trace-label__id">
                  <span className="dot" style={{ color: level ? LEVEL_HEX[level] : 'var(--text-3)' }} aria-hidden="true" />
                  {station.id}
                </span>
                <span className="trace-label__meta">
                  {station.name} · {formatNumber(station.distanceToCraterKm)} km
                </span>
                <span className="trace-label__meta mono" ref={(element) => peakRefs.current.set(station.id, element)} />
              </div>
            );
          })}
        </div>
        <canvas
          ref={canvasRef}
          className="seismograph__canvas"
          style={{ height: stations.length * ROW_HEIGHT_PX }}
          role="img"
          aria-label={`Sismograma en vivo de ${stations.length} estaciones, últimos ${SIGNAL_SECONDS} segundos`}
        />
      </div>
      <figcaption className="time-axis" aria-hidden="true">
        {TIME_TICKS.map((tick) => (
          <span key={tick}>{tick === 0 ? 'ahora' : `-${tick}s`}</span>
        ))}
      </figcaption>
    </figure>
  );
}
