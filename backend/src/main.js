// Single image, one microservice per container: SERVICE selects which one runs.
const SERVICE_ENTRYPOINTS = {
  simulator: './services/simulator/index.js',
  ingestion: './services/ingestion/index.js',
  analysis: './services/analysis/index.js',
  alerts: './services/alerts/index.js',
  'risk-zones': './services/risk-zones/index.js',
};

const serviceName = process.env.SERVICE;
const entrypoint = SERVICE_ENTRYPOINTS[serviceName];

if (!entrypoint) {
  console.error(`Set SERVICE to one of: ${Object.keys(SERVICE_ENTRYPOINTS).join(', ')}`);
  process.exit(1);
}

const { start } = await import(entrypoint);
await start();

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => process.exit(0));
}
