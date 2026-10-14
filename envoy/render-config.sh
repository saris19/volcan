#!/bin/sh
# Genera la configuración de Envoy a partir de variables de entorno.
#
# Envoy traduce gRPC-Web (navegador) <-> gRPC sobre HTTP/2 (microservicios).
# Solo se exponen los servicios que el frontend necesita; analysis queda interno.
#
# Variables:
#   LISTEN_PORT            Puerto de escucha (Cloud Run inyecta PORT)
#   UPSTREAM_TLS           "true" para hablar HTTPS/HTTP2 con los upstreams (Cloud Run)
#   SIMULATOR_ADDR, INGESTION_ADDR, ALERTS_ADDR, RISK_ZONES_ADDR   host:puerto
#   ALLOWED_ORIGIN         Origen permitido por CORS (por defecto "*")
#   ADMIN_ADDRESS          Interfaz del panel de administración (por defecto 0.0.0.0)
set -eu

LISTEN_PORT="${LISTEN_PORT:-${PORT:-8080}}"
UPSTREAM_TLS="${UPSTREAM_TLS:-false}"
ALLOWED_ORIGIN="${ALLOWED_ORIGIN:-*}"
ADMIN_ADDRESS="${ADMIN_ADDRESS:-0.0.0.0}"

strip_scheme() { echo "$1" | sed -E -e 's#^https?://##' -e 's#/$##'; }
host_of() { strip_scheme "$1" | cut -d: -f1; }
port_of() {
  port="$(strip_scheme "$1" | awk -F: '{print $2}')"
  if [ -n "$port" ]; then echo "$port"; elif [ "$UPSTREAM_TLS" = "true" ]; then echo 443; else echo 80; fi
}

if [ "$ALLOWED_ORIGIN" = "*" ]; then
  ORIGIN_MATCH='- prefix: "*"'
else
  ORIGIN_MATCH="- exact: \"$ALLOWED_ORIGIN\""
fi

route() {
  # $1 = servicio gRPC, $2 = cluster, $3 = dirección upstream
  echo "              - match: { prefix: \"/galeras.v1.$1/\" }"
  echo "                route:"
  echo "                  cluster: $2"
  echo "                  timeout: 0s"
  echo "                  max_stream_duration: { grpc_timeout_header_max: 0s }"
  if [ "$UPSTREAM_TLS" = "true" ]; then
    echo "                  host_rewrite_literal: $(host_of "$3")"
  fi
}

cluster() {
  # $1 = nombre, $2 = dirección upstream
  host="$(host_of "$2")"
  port="$(port_of "$2")"
  cat <<EOF
  - name: $1
    type: LOGICAL_DNS
    dns_lookup_family: V4_ONLY
    lb_policy: ROUND_ROBIN
    connect_timeout: 5s
    typed_extension_protocol_options:
      envoy.extensions.upstreams.http.v3.HttpProtocolOptions:
        "@type": type.googleapis.com/envoy.extensions.upstreams.http.v3.HttpProtocolOptions
        explicit_http_config:
          http2_protocol_options: {}
    load_assignment:
      cluster_name: $1
      endpoints:
      - lb_endpoints:
        - endpoint:
            address:
              socket_address: { address: $host, port_value: $port }
EOF
  if [ "$UPSTREAM_TLS" = "true" ]; then
    cat <<EOF
    transport_socket:
      name: envoy.transport_sockets.tls
      typed_config:
        "@type": type.googleapis.com/envoy.extensions.transport_sockets.tls.v3.UpstreamTlsContext
        sni: $host
        common_tls_context:
          alpn_protocols: ["h2"]
          validation_context:
            trusted_ca: { filename: /etc/ssl/certs/ca-certificates.crt }
EOF
  fi
}

cat <<EOF
admin:
  address:
    socket_address: { address: $ADMIN_ADDRESS, port_value: 9901 }

static_resources:
  listeners:
  - name: grpc_web_listener
    address:
      socket_address: { address: 0.0.0.0, port_value: $LISTEN_PORT }
    filter_chains:
    - filters:
      - name: envoy.filters.network.http_connection_manager
        typed_config:
          "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager
          codec_type: AUTO
          stat_prefix: ingress_http
          stream_idle_timeout: 0s
          route_config:
            name: galeras_routes
            virtual_hosts:
            - name: galeras
              domains: ["*"]
              typed_per_filter_config:
                envoy.filters.http.cors:
                  "@type": type.googleapis.com/envoy.extensions.filters.http.cors.v3.CorsPolicy
                  allow_origin_string_match:
                  $ORIGIN_MATCH
                  allow_methods: "GET, POST, OPTIONS"
                  allow_headers: "keep-alive,user-agent,cache-control,content-type,content-transfer-encoding,x-accept-content-transfer-encoding,x-accept-response-streaming,x-user-agent,x-grpc-web,grpc-timeout,connect-protocol-version,connect-timeout-ms"
                  expose_headers: "grpc-status,grpc-message,grpc-status-details-bin"
                  max_age: "86400"
              routes:
              - match: { path: "/healthz" }
                direct_response: { status: 200, body: { inline_string: "ok" } }
$(route SimulatorControlService simulator "$SIMULATOR_ADDR")
$(route IngestionService ingestion "$INGESTION_ADDR")
$(route AlertService alerts "$ALERTS_ADDR")
$(route RiskZoneService risk_zones "$RISK_ZONES_ADDR")
          http_filters:
          - name: envoy.filters.http.cors
            typed_config:
              "@type": type.googleapis.com/envoy.extensions.filters.http.cors.v3.Cors
          - name: envoy.filters.http.grpc_web
            typed_config:
              "@type": type.googleapis.com/envoy.extensions.filters.http.grpc_web.v3.GrpcWeb
          - name: envoy.filters.http.router
            typed_config:
              "@type": type.googleapis.com/envoy.extensions.filters.http.router.v3.Router

  clusters:
$(cluster simulator "$SIMULATOR_ADDR")
$(cluster ingestion "$INGESTION_ADDR")
$(cluster alerts "$ALERTS_ADDR")
$(cluster risk_zones "$RISK_ZONES_ADDR")
EOF
