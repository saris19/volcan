import { useCallback, useRef } from 'react';
import { ingestionClient } from '../api/clients';
import { countMessage } from '../api/rpc-stats';
import type { SignalWindow } from '../gen/galeras/v1/common_pb';
import { useServerStream } from './useServerStream';

export const SIGNAL_SECONDS = 30;
export const SAMPLE_RATE_HZ = 50;
const BUFFER_SIZE = SIGNAL_SECONDS * SAMPLE_RATE_HZ;

export interface SignalBuffer {
  samples: Float32Array; // Ring buffer
  writeIndex: number;
  lastPeak: number;
}

/**
 * Live signal (server streaming). Samples are written to refs instead of React
 * state so 25 messages/second don't trigger 25 re-renders; the canvas reads them.
 */
export function useSignal() {
  const buffersRef = useRef(new Map<string, SignalBuffer>());

  const openStream = useCallback(
    (signal: AbortSignal) => ingestionClient.watchSignal({ stationIds: [] }, { signal }),
    [],
  );

  const handleChunk = useCallback((chunk: SignalWindow) => {
    countMessage('IngestionService.WatchSignal');
    let buffer = buffersRef.current.get(chunk.stationId);
    if (!buffer) {
      buffer = { samples: new Float32Array(BUFFER_SIZE), writeIndex: 0, lastPeak: 0 };
      buffersRef.current.set(chunk.stationId, buffer);
    }
    let peak = 0;
    for (const sample of chunk.samples) {
      buffer.samples[buffer.writeIndex] = sample;
      buffer.writeIndex = (buffer.writeIndex + 1) % BUFFER_SIZE;
      peak = Math.max(peak, Math.abs(sample));
    }
    buffer.lastPeak = peak;
  }, []);

  const status = useServerStream(openStream, handleChunk);
  return { buffersRef, status };
}
