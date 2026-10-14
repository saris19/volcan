import { useEffect, useRef, useState } from 'react';

export type StreamStatus = 'connecting' | 'live' | 'reconnecting';

const INITIAL_RETRY_MS = 1_000;
const MAX_RETRY_MS = 15_000;

/**
 * Opens a gRPC server-streaming call and keeps it alive: if the stream ends
 * (e.g. Cloud Run closes it after 60 min) or fails, it reconnects with backoff.
 */
export function useServerStream<T>(
  openStream: (signal: AbortSignal) => AsyncIterable<T>,
  onMessage: (message: T) => void,
): StreamStatus {
  const [status, setStatus] = useState<StreamStatus>('connecting');
  const openStreamRef = useRef(openStream);
  const onMessageRef = useRef(onMessage);
  openStreamRef.current = openStream;
  onMessageRef.current = onMessage;

  useEffect(() => {
    const controller = new AbortController();
    let retryMs = INITIAL_RETRY_MS;

    const run = async () => {
      while (!controller.signal.aborted) {
        try {
          for await (const message of openStreamRef.current(controller.signal)) {
            setStatus('live');
            retryMs = INITIAL_RETRY_MS;
            onMessageRef.current(message);
          }
        } catch (error) {
          if (controller.signal.aborted) return;
          console.warn('Stream error, reconnecting', error);
        }
        if (controller.signal.aborted) return;
        setStatus('reconnecting');
        await new Promise((resolve) => setTimeout(resolve, retryMs));
        retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
      }
    };

    run();
    return () => controller.abort();
  }, []);

  return status;
}
