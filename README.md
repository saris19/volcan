# Galeras · Sistema de alerta temprana volcánica con gRPC

Taller gRPC — Programación Web.

Aplicación de monitoreo sísmico en tiempo real para el volcán Galeras construida con **microservicios que se comunican con gRPC sobre HTTP/2** en lugar de una API REST. Un simulador genera las señales de 5 estaciones; el backend las agrupa, las analiza con el método STA/LTA, calcula el nivel de alerta y lo transmite en vivo a un tablero web.

> Todos los datos (estaciones, señales y zonas de amenaza) son **simulados e ilustrativos**. No representan la red oficial de monitoreo ni el mapa oficial de amenaza del Servicio Geológico Colombiano.

---

## 1. Arquitectura

```
                         gRPC sobre HTTP/2 (red interna)                       │  gRPC-Web
                                                                               │
┌─────────────┐ client streaming ┌───────────┐ bidireccional ┌──────────┐ unaria ┌────────┐
│  simulator  │ ───────────────▶ │ ingestion │ ◀───────────▶ │ analysis │ ─────▶ │ alerts │
└─────────────┘  StreamReadings  └───────────┘ AnalyzeStream └──────────┘ Report └────────┘
       ▲                               │                                   Event     │
       │ unaria                        │ server streaming                            │ server streaming
       │ TriggerEvent                  │ WatchSignal                                 │ SubscribeAlerts
       │                               ▼                                             ▼
       │                        ┌──────────────────────────────────────────────────────────┐
       └────────────────────────│        Envoy (traduce gRPC-Web ⇄ gRPC HTTP/2)            │
                                └──────────────────────────────────────────────────────────┘
┌────────────┐  unaria GetRiskZones          ▲
│ risk-zones │ ◀─────────────────────────────┤  gRPC-Web (HTTPS)
└────────────┘                               │
                                    ┌─────────────────┐
                                    │ Frontend React  │
                                    └─────────────────┘
```

| Microservicio | Responsabilidad | RPC que expone |
|---|---|---|
| `simulator` | Genera la señal de 5 estaciones (50 muestras/s) y eventos VT, LP y tremor | `SimulatorControlService.TriggerEvent` (unaria) |
| `ingestion` | Recibe las lecturas, arma ventanas de 2 s y las reenvía al análisis | `StreamReadings` (client streaming), `WatchSignal` (server streaming), `ListStations` (unaria) |
| `analysis` | Clasifica cada ventana con STA/LTA y frecuencia dominante (DFT) | `AnalyzeStream` (bidireccional), `AnalyzeWindow` (unaria) |
| `alerts` | Guarda eventos, calcula el nivel global y lo emite en vivo | `ReportEvent` (unaria), `SubscribeAlerts` (server streaming), `ListRecentEvents` (unaria) |
| `risk-zones` | Zonas de amenaza, puntos de encuentro y recomendaciones según el nivel | `GetRiskZones` (unaria) |
| `envoy` | Gateway: el navegador habla gRPC-Web y Envoy lo convierte a gRPC/HTTP2 | — |
| `frontend` | Tablero React: nivel de alerta, sismograma, mapa, eventos, simulación | — |

### Los 4 tipos de RPC de gRPC, cada uno donde tiene sentido

| Tipo | Dónde | Por qué |
|---|---|---|
| **Unaria** | `GetRiskZones`, `ReportEvent`, `TriggerEvent`… | Pregunta y respuesta puntual |
| **Client streaming** | simulador → `StreamReadings` | El sensor envía datos sin parar; solo al cerrar recibe un resumen |
| **Server streaming** | `WatchSignal`, `SubscribeAlerts` → navegador | El servidor empuja datos en vivo, sin *polling* |
| **Bidireccional** | ingesta ⇄ `AnalyzeStream` | Ventanas de ida y clasificaciones de vuelta por la misma conexión HTTP/2 |

### ¿Por qué gRPC y no REST?

- **Protobuf**: mensajes binarios mucho más livianos que JSON. Importa con 25 paquetes de señal por segundo.
- **HTTP/2**: muchos streams multiplexados sobre una sola conexión TCP, sin abrir una conexión por petición.
- **Streaming nativo**: con REST habría que recurrir a *polling*, WebSockets o SSE.
- **Contrato estricto** (`.proto`): backend y frontend comparten los mismos tipos; el código del cliente TypeScript se genera automáticamente.

### ¿Por qué Envoy?

El navegador no permite controlar los frames HTTP/2 ni leer los *trailers*, que gRPC necesita. Por eso el frontend usa **gRPC-Web** (admite llamadas unarias y server streaming) y Envoy lo traduce a gRPC puro hacia los microservicios. El *client streaming* y el bidireccional ocurren entre servicios del backend, donde sí hay gRPC completo. Envoy solo expone los servicios que el frontend necesita: `analysis` queda interno.

---

## 2. Estructura del proyecto

```
galeras-grpc/
├── proto/galeras/v1/        Contratos gRPC (.proto) — fuente única de verdad
├── backend/
│   ├── src/main.js          Punto de entrada: SERVICE elige qué microservicio arranca
│   ├── src/shared/          Carga de .proto, utilidades gRPC, estaciones
│   ├── src/services/        simulator · ingestion · analysis · alerts · risk-zones
│   ├── scripts/run-all.js   Levanta los 5 servicios en local sin Docker
│   ├── scripts/smoke-test.js Prueba los 4 tipos de RPC
│   └── Dockerfile           Una imagen, un contenedor por microservicio
├── envoy/                   Gateway gRPC-Web (config generada por variables de entorno)
├── frontend/                React + Vite + Connect-ES (cliente gRPC-Web)
│   └── src/gen/             Código TypeScript generado desde los .proto
├── deploy/                  Scripts de despliegue en Google Cloud Run
├── render/ + render.yaml    Despliegue gratuito en Render (contenedor todo en uno)
└── docker-compose.yml       Entorno local completo
```

---

## 3. Ejecutar en local

### Opción A — Docker Compose (recomendada)

Requisito: Docker Desktop.

```bash
docker compose up --build
```

- Tablero: http://localhost:5173
- Envoy (gRPC-Web): http://localhost:8080 · administración: http://localhost:9901

### Opción B — Sin Docker para el backend

Requisitos: Node.js 20+ y Docker solo para Envoy.

```bash
# 1. Backend (5 microservicios en puertos 50051–50055)
cd backend
npm install
npm run dev

# 2. Envoy (en otra terminal, desde la raíz)
docker build -t galeras-envoy ./envoy
docker run --rm -p 8080:8080 \
  -e SIMULATOR_ADDR=host.docker.internal:50051 \
  -e INGESTION_ADDR=host.docker.internal:50052 \
  -e ALERTS_ADDR=host.docker.internal:50054 \
  -e RISK_ZONES_ADDR=host.docker.internal:50055 \
  galeras-envoy

# 3. Frontend (en otra terminal)
cd frontend
npm install
npm run dev        # http://localhost:5173
```

### Prueba de humo del backend

Con los servicios en ejecución:

```bash
cd backend
npm run smoke-test
```

Ejercita las llamadas unarias y los streams, dispara un evento de intensidad 9 y verifica que el nivel de alerta cambie.

---

## 4. Desplegar en la nube

Hay dos opciones:

- **Gratis: Render (backend) + Vercel (frontend).** Sigue la guía paso a paso en [`DEPLOY-RENDER-VERCEL.md`](DEPLOY-RENDER-VERCEL.md).
- **Google Cloud Run**, con cada microservicio en su propio servicio. Es lo que se describe a continuación.

### Google Cloud Run

Cloud Run soporta **HTTP/2 de extremo a extremo** (`--use-http2`), que gRPC necesita, y entrega HTTPS automáticamente.

Requisitos: [gcloud CLI](https://cloud.google.com/sdk/docs/install), una cuenta de Google Cloud con facturación activa (los créditos de estudiante sirven).

```bash
gcloud auth login
PROJECT_ID=mi-proyecto REGION=us-central1 ./deploy/deploy-cloudrun.sh
```

El script:

1. Habilita Cloud Run, Artifact Registry y Cloud Build.
2. Construye las imágenes en Cloud Build (no necesitas Docker local).
3. Despliega los 5 microservicios con `--use-http2`, conectándolos por sus URL `*.run.app:443` con TLS.
4. Despliega Envoy con `UPSTREAM_TLS=true` (habla HTTPS/HTTP2 con cada servicio).
5. Compila el frontend apuntando a la URL de Envoy y lo publica con nginx.
6. Restringe el CORS de Envoy al dominio del frontend.

Al finalizar imprime la URL del tablero.

**Costos:** `alerts`, `analysis`, `ingestion` y `simulator` se despliegan con `--min-instances 1 --no-cpu-throttling`, porque mantienen estado en memoria y streams abiertos. Eso genera un pequeño costo por hora. Después de la sustentación ejecuta:

```bash
PROJECT_ID=mi-proyecto ./deploy/destroy-cloudrun.sh
```

**Límite de 60 minutos:** Cloud Run cierra cualquier petición a los 60 min. El simulador reabre su stream cada 30 min, la ingesta reconecta el stream bidireccional y el frontend reconecta los server streams automáticamente (con *backoff*).

---

## 5. Modificar los contratos

1. Edita los archivos en `proto/galeras/v1/`.
2. Backend: no requiere generación; `@grpc/proto-loader` carga los `.proto` al iniciar.
3. Frontend: regenera los tipos TypeScript:

```bash
cd frontend
npm run generate   # buf generate ../proto  ->  src/gen/
```

---

## 6. Cómo funciona la detección

- **STA/LTA:** STA es la energía (RMS) de la ventana actual de 2 s; LTA es la energía de fondo de la estación, que se adapta lentamente. Si STA/LTA ≥ 2,5 hay evento: ≥ 2,5 amarillo, ≥ 8 naranja, ≥ 18 rojo.
- **Tipo de evento:** frecuencia dominante ≥ 5 Hz → volcano-tectónico (VT). Por debajo: largo periodo (LP), o tremor si dura ≥ 10 s.
- **Nivel global** (`alerts`): el nivel más alto de los eventos de los últimos 2 minutos. Si hay 8 o más eventos, sube un nivel. Cuando los eventos salen de la ventana, el nivel baja.

> En la realidad, el nivel de alerta lo declara la autoridad competente tras el análisis de expertos. Aquí se automatiza solo con fines académicos.

---

## 7. Guion sugerido para la demo

1. Muestra el tablero en verde y el sismograma con ruido de fondo (server streaming `WatchSignal`).
2. Abre la sección **Tráfico gRPC**: los 4 tipos de RPC y los mensajes que recibe el navegador.
3. Dispara un **VT de intensidad 9**: la señal salta primero en `GAL-CRA` (la más cercana) y luego en las demás, por el retardo de propagación.
4. El nivel pasa a **Rojo** (server streaming `SubscribeAlerts`) y el mapa marca las zonas a evacuar (unaria `GetRiskZones`).
5. Dispara un **tremor** y muestra que el análisis lo distingue de un LP por su duración.
6. Abre las DevTools → Network: las peticiones son `application/grpc-web+proto`, no JSON.
