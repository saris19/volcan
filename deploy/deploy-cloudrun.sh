#!/usr/bin/env bash
# Despliega todo el sistema en Google Cloud Run.
#
# Requisitos: gcloud instalado y autenticado (gcloud auth login) y un proyecto con facturación.
# Uso (desde la raíz del repositorio):
#   PROJECT_ID=mi-proyecto REGION=us-central1 ./deploy/deploy-cloudrun.sh
set -euo pipefail

PROJECT_ID="${PROJECT_ID:?Defina PROJECT_ID}"
REGION="${REGION:-us-central1}"
REPOSITORY="${REPOSITORY:-galeras}"
REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}"
TAG="${TAG:-$(date +%Y%m%d%H%M%S)}"

echo "==> Proyecto ${PROJECT_ID} · región ${REGION} · tag ${TAG}"
gcloud config set project "${PROJECT_ID}" >/dev/null
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com

if ! gcloud artifacts repositories describe "${REPOSITORY}" --location "${REGION}" >/dev/null 2>&1; then
  gcloud artifacts repositories create "${REPOSITORY}" --repository-format=docker --location "${REGION}"
fi

echo "==> Construyendo imágenes de backend y Envoy con Cloud Build"
gcloud builds submit . \
  --config deploy/cloudbuild-backend.yaml \
  --substitutions "_REGISTRY=${REGISTRY},_TAG=${TAG}"

url_of() { gcloud run services describe "$1" --region "${REGION}" --format 'value(status.url)'; }
grpc_address_of() { echo "$(url_of "$1" | sed 's#^https://##'):443"; }

# --use-http2: Cloud Run entrega HTTP/2 de extremo a extremo (h2c) al contenedor,
# requisito para gRPC. TLS (HTTPS) lo termina Cloud Run automáticamente.
deploy_grpc_service() {
  local name="$1" env_vars="$2"
  shift 2
  gcloud run deploy "${name}" \
    --image "${REGISTRY}/backend:${TAG}" \
    --region "${REGION}" \
    --use-http2 \
    --allow-unauthenticated \
    --timeout 3600 \
    --set-env-vars "${env_vars}" \
    "$@"
}

# Servicios con estado en memoria o streams permanentes: 1 instancia siempre encendida.
STATEFUL_FLAGS=(--min-instances 1 --max-instances 1 --no-cpu-throttling)

echo "==> Desplegando microservicios"
deploy_grpc_service galeras-risk-zones "SERVICE=risk-zones"
deploy_grpc_service galeras-alerts "SERVICE=alerts" "${STATEFUL_FLAGS[@]}"
deploy_grpc_service galeras-analysis "SERVICE=analysis,ALERTS_ADDR=$(grpc_address_of galeras-alerts)" "${STATEFUL_FLAGS[@]}"
deploy_grpc_service galeras-ingestion "SERVICE=ingestion,ANALYSIS_ADDR=$(grpc_address_of galeras-analysis)" "${STATEFUL_FLAGS[@]}"
deploy_grpc_service galeras-simulator "SERVICE=simulator,INGESTION_ADDR=$(grpc_address_of galeras-ingestion)" "${STATEFUL_FLAGS[@]}"

echo "==> Desplegando Envoy (gateway gRPC-Web)"
gcloud run deploy galeras-envoy \
  --image "${REGISTRY}/envoy:${TAG}" \
  --region "${REGION}" \
  --allow-unauthenticated \
  --timeout 3600 \
  --set-env-vars "^@^UPSTREAM_TLS=true@ALLOWED_ORIGIN=*@SIMULATOR_ADDR=$(url_of galeras-simulator)@INGESTION_ADDR=$(url_of galeras-ingestion)@ALERTS_ADDR=$(url_of galeras-alerts)@RISK_ZONES_ADDR=$(url_of galeras-risk-zones)"
ENVOY_URL="$(url_of galeras-envoy)"

echo "==> Construyendo y desplegando el frontend (API: ${ENVOY_URL})"
gcloud builds submit . \
  --config deploy/cloudbuild-frontend.yaml \
  --substitutions "_REGISTRY=${REGISTRY},_TAG=${TAG},_VITE_API_URL=${ENVOY_URL}"
gcloud run deploy galeras-web \
  --image "${REGISTRY}/frontend:${TAG}" \
  --region "${REGION}" \
  --allow-unauthenticated
WEB_URL="$(url_of galeras-web)"

echo "==> Restringiendo CORS de Envoy al dominio del frontend"
gcloud run services update galeras-envoy --region "${REGION}" --update-env-vars "ALLOWED_ORIGIN=${WEB_URL}"

echo
echo "Listo."
echo "  Frontend: ${WEB_URL}"
echo "  Envoy:    ${ENVOY_URL}"
echo "Recuerde ejecutar deploy/destroy-cloudrun.sh al terminar para evitar costos."
