# Despliegue gratuito: backend en Render + frontend en Vercel

```
Navegador ──HTTPS / gRPC-Web──▶ Vercel (React estático)
    │
    └────HTTPS / gRPC-Web──▶ Render (plan Free, 1 contenedor)
                              ┌───────────────────────────────────────────┐
                              │ Envoy :$PORT  (gRPC-Web ⇄ gRPC)           │
                              │   │  gRPC sobre HTTP/2 (localhost)        │
                              │   ├─▶ simulator   :50051                  │
                              │   ├─▶ ingestion   :50052 ⇄ analysis :50053│
                              │   ├─▶ alerts      :50054                  │
                              │   └─▶ risk-zones  :50055                  │
                              └───────────────────────────────────────────┘
```

**Por qué un solo contenedor:** en Render, un servicio gratuito no puede *recibir* tráfico de la red privada, y los *private services* no tienen plan gratuito. Por eso, en el plan Free, los 5 microservicios corren como **procesos independientes dentro del mismo contenedor**. Siguen comunicándose entre sí con gRPC sobre HTTP/2, con los mismos contratos `.proto` y el mismo código. Lo único que cambia es la forma de desplegarlos. Si necesitas desplegarlos por separado, usa `docker-compose.yml`, Cloud Run (`deploy/`) o los private services de pago de Render.

Archivos involucrados:

| Archivo | Para qué sirve |
|---|---|
| `render.yaml` | Blueprint de Render: crea el servicio automáticamente |
| `render/Dockerfile` | Imagen con Node.js + Envoy |
| `render/start.sh` | Arranca los 5 microservicios y Envoy en el puerto que asigna Render |
| `frontend/vercel.json` | Configuración del build de Vite en Vercel |

---

## Paso 1 — Subir el proyecto a GitHub

Crea un repositorio vacío en github.com (por ejemplo `galeras-grpc`, sin README). Luego, desde la carpeta del proyecto:

```bash
cd galeras-grpc
git init
git add .
git commit -m "Sistema de alerta temprana Galeras con gRPC"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/galeras-grpc.git
git push -u origin main
```

> `.gitignore` ya excluye `node_modules/` y `dist/`. La carpeta `frontend/src/gen/` **sí** debe subirse, porque contiene el código generado desde los `.proto`.

## Paso 2 — Backend en Render

1. Entra a https://dashboard.render.com e inicia sesión con GitHub.
2. **New → Blueprint** y selecciona el repositorio `galeras-grpc`.
3. Render detecta `render.yaml` y muestra el servicio `galeras-grpc` (plan Free, región Virginia). Pulsa **Apply**.
4. Espera a que termine el build. La primera vez tarda unos 5 minutos.
5. Copia la URL del servicio, por ejemplo `https://galeras-grpc.onrender.com`. Si el nombre ya está tomado, Render le agrega un sufijo.
6. Comprueba que responde abriendo `https://TU-SERVICIO.onrender.com/healthz`. Debe mostrar `ok`.

## Paso 3 — Frontend en Vercel

1. Entra a https://vercel.com/new e importa el mismo repositorio.
2. En **Root Directory** pulsa *Edit* y elige `frontend`. Vercel detecta Vite automáticamente.
3. En **Environment Variables** agrega:

   | Name | Value |
   |---|---|
   | `VITE_API_URL` | `https://TU-SERVICIO.onrender.com` (sin `/` al final) |

4. Pulsa **Deploy** y copia la URL de producción, por ejemplo `https://galeras-grpc.vercel.app`.

## Paso 4 — Restringir CORS a tu dominio de Vercel

Por defecto Envoy acepta peticiones de cualquier origen (`*`). Para dejarlo solo a tu frontend:

1. En Render: servicio `galeras-grpc` → **Environment**.
2. Cambia `ALLOWED_ORIGIN` a tu URL de Vercel exacta, por ejemplo `https://galeras-grpc.vercel.app`, sin `/` al final.
3. **Save changes**. Render redespliega solo.

> Las URL de *preview* de Vercel (`galeras-grpc-git-…vercel.app`) quedan bloqueadas con esta configuración. Si las necesitas, deja `ALLOWED_ORIGIN` en `*`.

## Paso 5 — Verificar

Abre la URL de Vercel:

- Arriba a la derecha debe aparecer **"En vivo · gRPC-Web"**.
- El sismograma se va llenando.
- **Simular un evento** → VT, intensidad 9 → el nivel pasa a Rojo.
- DevTools → Network: las peticiones van a `onrender.com` con `content-type: application/grpc-web+proto`.

---

## Limitaciones del plan gratuito

- **Se duerme:** tras 15 minutos sin peticiones, Render apaga el servicio. La siguiente visita lo despierta en aproximadamente 1 minuto, y el tablero se reconecta solo. **Abre la página 2 o 3 minutos antes de la sustentación.**
- **Estado en memoria:** al dormirse se pierde el historial de eventos. Es normal en esta demo, que no usa base de datos.
- **750 horas gratis al mes** por cuenta de Render. Un solo servicio alcanza para todo el mes.
- **CPU limitada:** el arranque y el build son más lentos que en local.

## Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| El tablero se queda en "Conectando…" más de 2 min | El servicio sigue despertando o falló el build | Revisa **Logs** en Render; abre `/healthz` |
| La consola muestra un error **CORS** | `ALLOWED_ORIGIN` no coincide exactamente con la URL de Vercel | Copia la URL sin `/` final, o usa `*` |
| Cambiaste `VITE_API_URL` y no tuvo efecto | Es una variable de *build* | En Vercel: **Deployments → … → Redeploy** |
| Error `404` al llamar `/galeras.v1...` | `VITE_API_URL` apunta a Vercel en vez de a Render | Corrige la variable y redespliega |
| En los logs aparece `[ingestion] exited with code 1` | Un microservicio falló | El contenedor se reinicia solo; revisa el error anterior en los logs |

## Probar la imagen de Render en tu Mac (opcional)

```bash
docker build -f render/Dockerfile -t galeras-render .
docker run --rm -p 10000:10000 -e PORT=10000 galeras-render
curl http://localhost:10000/healthz     # ok
```

Luego, en `frontend/`, ejecuta `VITE_API_URL=http://localhost:10000 npm run dev`.
