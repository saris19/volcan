# Imagen "todo en uno" para el plan gratuito de Render.
# Corre los 5 microservicios como procesos independientes que se comunican con gRPC
# sobre HTTP/2 (localhost), y Envoy expuesto en $PORT como gateway gRPC-Web.
# Construir desde la raíz del repositorio:
#   docker build -f render/Dockerfile -t galeras-render .
FROM envoyproxy/envoy:v1.31-latest AS envoy

FROM node:20-bookworm-slim

COPY --from=envoy /usr/local/bin/envoy /usr/local/bin/envoy

WORKDIR /app
ENV NODE_ENV=production \
    PROTO_DIR=/app/proto

COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev

COPY proto ./proto
COPY backend/src ./backend/src
COPY backend/scripts ./backend/scripts
COPY envoy/render-config.sh ./envoy/render-config.sh
COPY render/start.sh ./render/start.sh
RUN chmod +x ./envoy/render-config.sh ./render/start.sh

USER node
# Render inyecta PORT (10000 por defecto)
EXPOSE 10000
CMD ["./render/start.sh"]
