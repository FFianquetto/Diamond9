# 03 — Propuesta de interfaz

**Proyecto:** Diamante 9 · Beisbol AR  
**(15 + 15 + 15 = 40 pts según rúbrica)**  
**Principio:** la identidad visual actual (colores, tipografía Lexend Deca, layout) **se conserva**; esta propuesta documenta pantallas y flujos ya implementados como mockups oficiales.

---

## A. Bocetos / mockups de pantallas (15 pts)

> Sustituir esta sección en el PDF con **capturas reales** (`npm start` → http://localhost:2000).  
> Guardar capturas en `docs/avance-1/capturas/` con los nombres sugeridos.

### Inventario de pantallas

| # | Pantalla | Ruta | Archivo captura sugerido |
|---|----------|------|--------------------------|
| 1 | Inicio / Landing | `/` | `01-inicio.png` |
| 2 | Escáner AR (ventana AR) | `/ar` | `02-ar-scanner.png` |
| 3 | Guía de marcadores | `/marcadores` | `03-marcadores.png` |
| 4 | Videos + filtros | `/videos` | `04-videos-filtros.png` |
| 5 | Trivia (modo bonus) | `/trivia` | `05-trivia.png` |
| 6 | Estadísticas en vivo | `/estadisticas` | `06-stats.png` |

### Descripción breve (wireframe textual)

**1. Inicio**  
Hero con marca **DIAMANTE 9**, headline AR, CTAs “Abrir escáner AR” / “Ver marcadores”, sección de 4 modos (AR, Videos, Trivia, Stats).

**2. Escáner AR** (misma identidad que el home)  
- Frame de cámara  
- Overlay del contenido detectado  
- Fila de botones: Info · Stats · Video · Animar  
- Lista “Simular escaneo” / marcadores (hasta integrar tracking real)  
- Mensajes de feedback

**3. Marcadores**  
Tarjetas 01–03 con tip y acciones asociadas; CTA a `/ar`.

**4. Videos**  
Canvas de preview + lista de clips + chips de filtros permitidos.

**5. Trivia**  
Pregunta, opciones, feedback, puntaje.

**6. Stats**  
Scoreboard simulado + líderes del día.

### Identidad (no modificar en desarrollo)

| Token | Uso |
|-------|-----|
| Fondo negro `#000000` | Base |
| Cyan `#00C2D7` | Acento / CTAs |
| Tipografía Lexend Deca | UI |
| Bordes / paneles estilo actual | Cards y botones AR |

---

## B. Flujo de navegación y distribución de botones (15 pts)

### Mapa de navegación

```text
                    ┌─────────────┐
                    │   Inicio /  │
                    │  Diamante 9 │
                    └──────┬──────┘
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
      ┌────────┐     ┌──────────┐    ┌──────────┐
      │  /ar   │◄────│/marcadores│    │ /videos  │
      │Escáner │     └──────────┘    │ Filtros  │
      └────┬───┘                     └──────────┘
           │
     botones AR
     (Info/Stats/Video/Animar)
           │
     ┌─────┴─────┐
     ▼           ▼
┌─────────┐ ┌─────────┐
│ /trivia │ │/estadis-│
│ bonus   │ │ ticas   │
└─────────┘ └─────────┘
```

Menú superior (misma barra en todas las vistas):  
**Inicio · Escáner AR · Videos · Trivia · Stats · Más (Marcadores)**

### Distribución en la ventana AR (`/ar`)

```text
┌──────────────────────────────┐
│        [ Vista cámara ]      │
│         overlay 3D           │
│      paneles Info/Stats      │
├──────────────────────────────┤
│ [Info] [Stats] [Video] [Anim]│  ← misma estética de botones del sitio
├──────────────────────────────┤
│ Activar / Detener cámara     │
│ Feedback (mensaje + sonido)  │
├──────────────────────────────┤
│ Marcador 1 | 2 | 3 (detonar) │
└──────────────────────────────┘
```

La rúbrica exige que la UI de la ventana AR **respeite** colores, tipografías e íconos de la página principal: se cumple reutilizando el design system existente (sin rediseño).

---

## C. Acciones asociadas a cada botón (15 pts)

### Ventana AR — controles principales

| Botón | Acción al presionar | Feedback UX | Contenido asociado |
|-------|---------------------|-------------|--------------------|
| **Activar cámara** | Solicita permiso y muestra stream | Mensaje “Cámara lista…” | — |
| **Detener cámara** | Cierra tracks del MediaStream | Overlay vuelve a placeholder | — |
| **Marcador (1–3)** | Activa experiencia de ese target | Mensaje “Marcador detectado…” + beep | Escudo / Jugador / Estadio |
| **Info** | Muestra diálogo con datos; programa rotación 360° + narración | Estado *pressed*, mensaje, audio | Texto histórico / ficha |
| **Stats** | Abre panel de estadísticas del objeto o liga | *pressed* + mensaje | AVG, HR, capacidad, etc. |
| **Video** | Toggle reproducción del clip del marcador | *pressed* + mensaje play/stop | Highlight / tour / historia |
| **Animar** | Dispara animación 3D (celebración, swing, flyover) | *pressed* + animación visible | Clip de animación del glb |
| **Cerrar marcador** | Limpia overlay y paneles | Mensaje “Experiencia AR cerrada” | — |

### Pantalla Videos

| Control | Acción |
|---------|--------|
| Tarjeta de video | Selecciona clip del acervo |
| Chip **Original** | Sin filtro |
| Chip **Desenfoque** | Blur Canvas |
| Chip **Pixelado** | Pixelate |
| Chip **Cámara térmica** | Mapa térmico |
| Chip **Ajuste de color** | Shift de canales |
| Chip **Colores pastel** | Filtro personalizado |
| Chip **Alta saturación** | Filtro personalizado |
| Chip **Suavizado** | Filtro personalizado |

No se exponen: B/N, grises, sepia, exposición, invertidos.

### Trivia / Stats (modos extra)

| Pantalla | Controles | Acción |
|----------|-----------|--------|
| Trivia | Opciones A–D | Valida respuesta, puntúa, feedback |
| Trivia | Siguiente / Reiniciar | Avanza o resetea |
| Stats | (automático) | Actualiza marcador simulado en vivo |

### Navegación global

| Control | Destino |
|---------|---------|
| Logo D9·AR | `/` |
| Escáner AR | `/ar` |
| Videos | `/videos` |
| Trivia | `/trivia` |
| Stats | `/estadisticas` |
| Marcadores | `/marcadores` |

---

## D. Criterio de aceptación Avance 1 (interfaz)

- [ ] Capturas de las 6 pantallas incluidas en el zip  
- [ ] Este documento firmado / con nombres  
- [ ] Flujo anterior coherente con la app en puerto **2000**  
- [ ] Sin cambios de identidad visual respecto al prototipo aprobado por el equipo  
