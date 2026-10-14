#!/bin/sh
set -eu
/etc/envoy/render-config.sh > /tmp/envoy.yaml
echo "Envoy config generated (UPSTREAM_TLS=${UPSTREAM_TLS:-false})"
exec envoy -c /tmp/envoy.yaml --log-level "${ENVOY_LOG_LEVEL:-info}"
