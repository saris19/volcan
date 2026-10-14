import { RPC_CATALOG, getMessageCount, type RpcKind } from '../api/rpc-stats';
import { formatInteger } from '../lib/format';

const KIND_LABEL: Record<RpcKind, string> = {
  unary: 'unaria',
  'server-streaming': 'server streaming',
  'client-streaming': 'client streaming',
  'bidi-streaming': 'bidireccional',
};

/** Shows every RPC in the system, its kind and how many messages this browser received. */
export function RpcTraffic() {
  return (
    <div className="panel table-wrap">
      <table>
        <caption className="visually-hidden">RPC del sistema y mensajes recibidos por este navegador</caption>
        <thead>
          <tr>
            <th scope="col">Método</th>
            <th scope="col">Tipo</th>
            <th scope="col">Recorrido</th>
            <th scope="col" className="numeric">Mensajes en este navegador</th>
          </tr>
        </thead>
        <tbody>
          {RPC_CATALOG.map((rpc) => (
            <tr key={rpc.method}>
              <td className="mono">{rpc.method}</td>
              <td>
                <span className={`rpc-kind rpc-kind--${rpc.kind}`}>{KIND_LABEL[rpc.kind]}</span>
              </td>
              <td className="muted">{rpc.path}</td>
              <td className="numeric">{rpc.fromBrowser ? formatInteger(getMessageCount(rpc.method)) : <span className="muted">interno</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
