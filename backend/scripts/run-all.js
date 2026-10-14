// Levanta los 5 microservicios en local (sin Docker), cada uno en su propio proceso.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SERVICES = [
  { name: 'risk-zones', port: 50055, env: {} },
  { name: 'alerts', port: 50054, env: {} },
  { name: 'analysis', port: 50053, env: { ALERTS_ADDR: 'localhost:50054' } },
  { name: 'ingestion', port: 50052, env: { ANALYSIS_ADDR: 'localhost:50053' } },
  { name: 'simulator', port: 50051, env: { INGESTION_ADDR: 'localhost:50052' } },
];

let stopping = false;

const children = SERVICES.map(({ name, port, env }) => {
  const child = spawn(process.execPath, ['src/main.js'], {
    cwd: backendDir,
    env: { ...process.env, ...env, SERVICE: name, PORT: String(port) },
    stdio: 'inherit',
  });
  child.on('exit', (code) => {
    console.log(`[${name}] exited with code ${code}`);
    // Si un microservicio muere, se detiene todo para que la plataforma reinicie el contenedor.
    if (!stopping) stopAll(1);
  });
  return child;
});

function stopAll(exitCode = 0) {
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  process.exit(exitCode);
}
process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));
