# Una sola imagen para los 5 microservicios: la variable SERVICE decide cuál arranca.
# Construir desde la raíz del repositorio (necesita la carpeta proto/):
#   docker build -f backend/Dockerfile -t galeras-backend .
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production \
    PROTO_DIR=/app/proto

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

COPY proto ./proto
COPY backend/src ./src

USER node
EXPOSE 8080
CMD ["node", "src/main.js"]
