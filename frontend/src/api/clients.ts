import { createClient } from '@connectrpc/connect';
import { createGrpcWebTransport } from '@connectrpc/connect-web';
import { AlertService } from '../gen/galeras/v1/alerts_pb';
import { IngestionService } from '../gen/galeras/v1/ingestion_pb';
import { RiskZoneService } from '../gen/galeras/v1/risk_zones_pb';
import { SimulatorControlService } from '../gen/galeras/v1/simulator_pb';

export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

// El navegador no puede hablar gRPC "puro" (no controla los frames HTTP/2 ni los trailers),
// así que usamos gRPC-Web: Envoy lo traduce a gRPC sobre HTTP/2 hacia los microservicios.
const transport = createGrpcWebTransport({ baseUrl: API_URL });

export const alertClient = createClient(AlertService, transport);
export const ingestionClient = createClient(IngestionService, transport);
export const riskZoneClient = createClient(RiskZoneService, transport);
export const simulatorClient = createClient(SimulatorControlService, transport);
