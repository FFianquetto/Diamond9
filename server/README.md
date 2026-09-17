# Diamante 9 — Scan API (Node + OCR + logos + DB)

## Arrancar el proyecto (2 terminales)

**Terminal 1 — API (puerto 5000)**

```bash
cd server
npm install
npm start
```

**Terminal 2 — Angular (puerto 2000)**

```bash
cd ..
npm install
npm start
```

Abre: http://localhost:2000  
El proxy `/api` apunta a `http://localhost:5000`.

Atajos desde la raíz del repo:

```bash
npm run start:api
npm start
```

Arquitectura:

```
Cámara (Angular)
    │
    ▼
Node.js  /api/scan
    │
    ├─► Roboflow  (opcional: gorra / carta / pelota)
    │
    ├─► OCR + match de logo (plantilla + colores)
    │     → Tarjeta, Gorra y Pelota
    │
    └─► JSON / Mongo → jugador + equipo + modelKey
```

Modelos 3D: únicamente `public/assets/modelos/`.

## Arranque rápido API (sin Roboflow ni Mongo)

```bash
cd server
cp .env.example .env
npm install
npm start
```

API en `http://localhost:5000`

## Con MongoDB

En `.env`:

```
DB_MODE=mongo
MONGODB_URI=mongodb://127.0.0.1:27017/diamante9
```

## Con Roboflow

1. Crea/entrena un modelo con clases `baseball_cap`, `baseball_card`, `baseball`
2. Publica Hosted Inference
3. En `.env`:

```
ROBOFLOW_API_KEY=tu_clave
ROBOFLOW_MODEL=nombre-del-modelo
ROBOFLOW_VERSION=1
```

Sin clave, el modo de la app (Tarjeta / Gorra / Pelota) + OCR + logos + DB resuelven el **equipo**.

## Probar

```bash
curl http://localhost:5000/api/scan/health
curl http://localhost:5000/api/scan/catalog
```
