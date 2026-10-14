#!/usr/bin/env bash
# Elimina los servicios de Cloud Run creados por deploy-cloudrun.sh.
set -euo pipefail

PROJECT_ID="${PROJECT_ID:?Defina PROJECT_ID}"
REGION="${REGION:-us-central1}"
gcloud config set project "${PROJECT_ID}" >/dev/null

for service in galeras-web galeras-envoy galeras-simulator galeras-ingestion galeras-analysis galeras-alerts galeras-risk-zones; do
  gcloud run services delete "${service}" --region "${REGION}" --quiet || true
done
echo "Servicios eliminados. Las imágenes siguen en Artifact Registry (repositorio 'galeras')."
