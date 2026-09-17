# Diamante 9 — API Node (opcional)

El escáner AR usa **MindAR en el navegador** y **no requiere** este backend.

La API sigue disponible si quieres catálogo HTTP, OCR legacy o experimentos con Roboflow.

## Arrancar solo el frontend (recomendado)

```bash
npm install
npm start
```

→ http://localhost:2000

## Arrancar el backend (opcional)

```bash
cd server
npm install
npm start
```

→ http://localhost:5000

Desde la raíz del repo:

```bash
npm run start:api
```

Endpoints:

- `GET  /api/scan/health`
- `GET  /api/scan/catalog`
- `POST /api/scan` (legacy OCR/logo; el front ya no lo usa)

Copia `server/.env.example` a `server/.env` si usas Roboflow o Mongo.
