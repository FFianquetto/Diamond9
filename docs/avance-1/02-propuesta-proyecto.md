# 02 — Propuesta de proyecto

**Proyecto:** Diamante 9 · Beisbol AR  
**(15 + 15 + 15 = 40 pts según rúbrica)**

---

## A. Concepto y objetivo de la app (15 pts)

### Concepto

**Diamante 9** es una aplicación **web de realidad aumentada** orientada al **beisbol de la Liga Mexicana de Beisbol (LMB)**. El usuario apunta la cámara del teléfono a pósters o marcadores impresos (escudo, carta de jugador, diamante/estadio) y en pantalla aparecen modelos 3D, estadísticas simuladas, videos y animaciones, con botones que respetan la identidad visual de la app.

La narrativa une afición y aprendizaje: conocer historia, reglas y atmósfera del diamante mexicano, complementada con un **acervo multimedia** (rúbrica: material temático tipo archivo “Mundial 2026” / temporada 2026) editable con filtros de imagen permitidos.

### Objetivo general

Permitir que cualquier aficionado, desde un navegador móvil Android o iOS, **escanee marcadores de beisbol** y **interactúe** con contenido AR (3D, video, stats, trivia) de forma coherente, responsive y demostrable en video.

### Objetivos específicos

1. Activar experiencias AR al reconocer imágenes/marcadores.
2. Ofrecer al menos **dos tipos de acciones** en la ventana AR (video, stats, animación, info).
3. Exponer modos extra: trivia y estadísticas en vivo simuladas.
4. Permitir edición visual de videos del acervo con filtros autorizados.
5. Mantener **una sola identidad UI** (colores, tipografía, layout ya definidos en el prototipo).

### Público

Estudiantes, aficionados LMB y evaluadores del curso (demo en aula / video).

---

## B. Funciones AR previstas (15 pts)

### Lista de funciones (con referencias visuales)

> **Refs visuales:** usar capturas actuales de `/ar` y `/marcadores`, más bocetos de marcadores en `public/assets/markers/` (imprimibles). Pegar imágenes en el PDF final o en `docs/avance-1/refs/`.

| # | Función | Descripción | Estado Avance 1 |
|---|---------|-------------|-----------------|
| 1 | Escaneo / Image Tracking | Cámara + reconocimiento de marcadores (MindAR) | Cámara + simulación lista; tracking real → Avance 2 |
| 2 | Overlay AR | Modelo 3D anclado al marcador | Placeholder visual; glb → Avance 2–3 |
| 3 | Botón **Info** | Diálogo + rotación 360° + narración | UI lista |
| 4 | Botón **Stats** | Panel de estadísticas del objeto/juego | UI lista |
| 5 | Botón **Video** | Reproduce clip asociado al marcador | UI lista |
| 6 | Botón **Animar** | Dispara animación/celebración del modelo | UI lista (conectar a glb) |
| 7 | Efectos | Partículas / luces / banner de celebración | Planificado Avance 3 |
| 8 | Galería / multi-modo | Home → AR / Videos / Trivia / Stats | Implementado en navegación |
| 9 | Feedback | Sonido corto + mensaje en pantalla + estado pressed | Parcial; completar en Avance 2 |
| 10 | QR (opcional) | Abrir experiencia o marcador digital | Opcional si hay tiempo |

### Tres marcadores previstos (mínimo rúbrica final = 3)

| Marcador | Contenido 3D | Acciones |
|----------|--------------|----------|
| Escudo LMB | Escudo / identidad | Info histórica, stats liga, video orígenes, rotación |
| Jugador estrella | Bateador glb | Info ficha, AVG/HR/RBI, highlight, celebración |
| Estadio diamante | Campo / estadio | Capacidad/medidas, tour video, flyover |

---

## C. Contenido temático a integrar (15 pts)

> La rúbrica menciona “Mundial 2026” en el acervo de videos; el hilo conductor del proyecto es **beisbol LMB**. En la entrega se presenta el acervo como material de temporada / archivo 2026 alineado a beisbol.

### Imágenes / marcadores

| Archivo destino | Uso |
|-----------------|-----|
| `public/assets/markers/escudo-lmb.png` | Target tracking #1 |
| `public/assets/markers/jugador-carta.png` | Target tracking #2 |
| `public/assets/markers/estadio-diamante.png` | Target tracking #3 |
| `public/assets/logos/` | Logo app / favicon |
| `public/assets/images/` | Pósters promocionales, banners |

### Modelos 3D (Diseñador AR)

| Archivo destino | Contenido | Animaciones |
|-----------------|-----------|-------------|
| `models3d/escudo.glb` | Escudo | Idle + rotación 360° |
| `models3d/jugador.glb` | Bateador | Swing / celebración |
| `models3d/estadio.glb` o `trofeo.glb` | Campo o trofeo | Flyover / giro |

Formato: **glTF / glb**, optimizado para móvil.

### Videos (acervo + filtros)

| Clip | Tema | Filtros aplicables |
|------|------|--------------------|
| Historia LMB | Orígenes del beisbol profesional en México | Desenfoque, pixelado, térmica, ajuste color, pastel, saturación, suavizado |
| Archivo temporada / Mundial 2026 | Material multimedia del curso | Idem |
| Noche en el diamante | Ambiente de estadio | Idem |

**Filtros prohibidos (no implementar):** blanco y negro, escala de grises, sepia, exposición, colores invertidos.

### Audio

- Clics de UI (feedback).
- Narración corta al pulsar **Info** (por marcador).
- Opcional: ambiente de estadio en bajo volumen.

---

## D. Alcance por entrega (recordatorio)

| Entrega | Compromiso |
|---------|------------|
| 1ª | Este documento + UI base + justificación plataforma |
| 2ª | Escaneo real ≥2 marcadores + eventos básicos + manual preliminar |
| 3ª | 3 marcadores, acciones completas, 3D, bonus, APK, optimización, video demo |
