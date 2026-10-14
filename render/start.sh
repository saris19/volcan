#!/usr/bin/env bash
# Arranca los 5 microservicios (puertos internos 50051-50055) y Envoy en $PORT.
# Si cualquiera de los dos procesos termina, el contenedor se detiene y Render lo reinicia.
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PUBLIC_PORT="${PORT:-10000}"

node "${APP_DIR}/backend/scripts/run-all.js" &
BACKEND_PID=$!

# Envoy solo habla con los servicios dentro del mismo contenedor.
LISTEN_PORT="${PUBLIC_PORT}" \
ADMIN_ADDRESS=127.0.0.1 \
SIMULATOR_ADDR=127.0.0.1:50051 \
INGESTION_ADDR=127.0.0.1:50052 \
ALERTS_ADDR=127.0.0.1:50054 \
RISK_ZONES_ADDR=127.0.0.1:50055 \
  "${APP_DIR}/envoy/render-config.sh" > /tmp/envoy.yaml

envoy -c /tmp/envoy.yaml --log-level "${ENVOY_LOG_LEVEL:-warn}" &
ENVOY_PID=$!
echo "Envoy listening on :${PUBLIC_PORT} (CORS origin: ${ALLOWED_ORIGIN:-*})"

trap 'kill "${BACKEND_PID}" "${ENVOY_PID}" 2>/dev/null || true' SIGTERM SIGINT
wait -n "${BACKEND_PID}" "${ENVOY_PID}"
EXIT_CODE=$?
kill "${BACKEND_PID}" "${ENVOY_PID}" 2>/dev/null || true
exit "${EXIT_CODE}"
