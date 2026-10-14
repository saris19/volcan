// Contador de mensajes por RPC, para mostrar el tráfico gRPC en la demo.
export type RpcKind = 'unary' | 'server-streaming' | 'client-streaming' | 'bidi-streaming';

export interface RpcDescriptor {
  method: string;
  kind: RpcKind;
  path: string; // Backend services involved
  fromBrowser: boolean;
}

export const RPC_CATALOG: RpcDescriptor[] = [
  { method: 'IngestionService.StreamReadings', kind: 'client-streaming', path: 'simulator → ingestion', fromBrowser: false },
  { method: 'AnalysisService.AnalyzeStream', kind: 'bidi-streaming', path: 'ingestion ⇄ analysis', fromBrowser: false },
  { method: 'AlertService.ReportEvent', kind: 'unary', path: 'analysis → alerts', fromBrowser: false },
  { method: 'IngestionService.WatchSignal', kind: 'server-streaming', path: 'ingestion → navegador', fromBrowser: true },
  { method: 'AlertService.SubscribeAlerts', kind: 'server-streaming', path: 'alerts → navegador', fromBrowser: true },
  { method: 'AlertService.ListRecentEvents', kind: 'unary', path: 'navegador → alerts', fromBrowser: true },
  { method: 'RiskZoneService.GetRiskZones', kind: 'unary', path: 'navegador → risk-zones', fromBrowser: true },
  { method: 'IngestionService.ListStations', kind: 'unary', path: 'navegador → ingestion', fromBrowser: true },
  { method: 'SimulatorControlService.TriggerEvent', kind: 'unary', path: 'navegador → simulator', fromBrowser: true },
];

const messageCounts = new Map<string, number>();

export function countMessage(method: string): void {
  messageCounts.set(method, (messageCounts.get(method) ?? 0) + 1);
}

export function getMessageCount(method: string): number {
  return messageCounts.get(method) ?? 0;
}

export function getTotalMessages(): number {
  let total = 0;
  for (const count of messageCounts.values()) total += count;
  return total;
}
