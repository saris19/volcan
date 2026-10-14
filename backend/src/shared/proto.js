import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

// En local los .proto están en ../../../proto; dentro del contenedor en /app/proto.
const candidateDirs = [
  process.env.PROTO_DIR,
  path.resolve(currentDir, '../../../proto'),
  path.resolve(currentDir, '../../proto'),
].filter(Boolean);

const protoDir = candidateDirs.find((dir) => fs.existsSync(path.join(dir, 'galeras/v1/common.proto')));
if (!protoDir) {
  throw new Error(`Proto directory not found. Checked: ${candidateDirs.join(', ')}`);
}

const PROTO_FILES = [
  'galeras/v1/common.proto',
  'galeras/v1/ingestion.proto',
  'galeras/v1/analysis.proto',
  'galeras/v1/alerts.proto',
  'galeras/v1/risk_zones.proto',
  'galeras/v1/simulator.proto',
];

const packageDefinition = protoLoader.loadSync(PROTO_FILES, {
  includeDirs: [protoDir],
  keepCase: false, // station_id -> stationId
  longs: Number,
  enums: String, // 'ALERT_LEVEL_RED'
  defaults: true,
  oneofs: true,
});

export const galeras = grpc.loadPackageDefinition(packageDefinition).galeras.v1;
export { grpc };
