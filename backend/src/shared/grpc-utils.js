import { grpc } from './proto.js';
import { logger } from './logger.js';

/**
 * Creates a gRPC client. Uses TLS when the address points to port 443
 * (e.g. a Cloud Run URL) or when USE_TLS=true.
 */
export function createClient(ServiceClient, address) {
  const normalizedAddress = address.replace(/^https?:\/\//, '');
  const useTls = process.env.USE_TLS === 'true' || normalizedAddress.endsWith(':443');
  const credentials = useTls ? grpc.credentials.createSsl() : grpc.credentials.createInsecure();
  return new ServiceClient(normalizedAddress, credentials, {
    'grpc.keepalive_time_ms': 20_000,
    'grpc.keepalive_timeout_ms': 10_000,
    'grpc.keepalive_permit_without_calls': 1,
  });
}

/**
 * Starts a gRPC server on 0.0.0.0:PORT. Cloud Run injects PORT and,
 * with --use-http2, delivers HTTP/2 cleartext (h2c) to the container.
 */
export function startServer(serviceName, registrations) {
  const server = new grpc.Server({
    'grpc.keepalive_permit_without_calls': 1,
    'grpc.http2.min_ping_interval_without_data_ms': 10_000,
  });
  for (const { service, implementation } of registrations) {
    server.addService(service, implementation);
  }
  const port = Number(process.env.PORT || 50051);
  return new Promise((resolve, reject) => {
    server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), (error, boundPort) => {
      if (error) return reject(error);
      logger.info(`${serviceName} listening on :${boundPort}`);
      resolve(server);
    });
  });
}

/** Runs a task forever, waiting `delayMs` between retries when it fails or ends. */
export async function keepAlive(taskName, task, delayMs = 2_000) {
  for (;;) {
    try {
      await task();
      logger.warn(`${taskName} ended, restarting`);
    } catch (error) {
      logger.warn(`${taskName} failed: ${error.message}. Retrying in ${delayMs} ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

export function requireEnv(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}
