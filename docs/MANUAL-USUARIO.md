# Manual de usuario — Diamante 9 AR

Guía rápida para usar la app de béisbol con realidad aumentada (LNM / LMB / MLB).

---

## 1. Cómo arrancar

Necesitas **dos terminales**:

**Terminal A — API (escáner)**
```powershell
cd "…\Diamante9\server"
npm start
```
Debe decir: `http://localhost:5000`

**Terminal B — App Angular**
```powershell
cd "…\Diamante9"
npm start
```
Abre: **http://localhost:2000**

Si el puerto 5000 ya está en uso, la API probablemente ya está corriendo: no hace falta volver a lanzarla.

---

## 2. Inicio (Home)

Ruta: `/`

Desde la portada puedes entrar a cada módulo (escáner, galería, trivia, juegos, etc.).  
También puedes usar el menú superior en cualquier momento.

---

## 3. Escáner AR

Ruta: `/ar`

### Pasos
1. Entra a **Escáner AR**.
2. Elige el tipo:
   - **Tarjeta** — cartas / escudos
   - **Gorra** — logo frontal de la gorra
   - **Pelota** — pelota de béisbol
3. Pulsa **Activar cámara** y acepta el permiso.
4. Centra el objeto en el cuadro (buena luz, logo al frente).
5. Cuando detecte algo, verás:
   - Modelo 3D encima de la cámara
   - Nombre del equipo / objeto
   - Botones: **Info · Stats · Video · Animar**

### Gorras (modo demo MLB)
Si el reconocimiento no confirma el logo, el escáner muestra por defecto **New York Yankees** o **Boston Red Sox** (alternados), con su modelo 3D, para que puedas probar las acciones AR.

### Consejos
- Acerca el logo al centro.
- Evita contraluz fuerte (ventana detrás).
- Revisa arriba: `API Node · DB conectada` (si dice offline, arranca la terminal del `server`).

### Acciones AR
| Botón | Qué hace |
|--------|----------|
| Info | Texto del equipo / objeto |
| Stats | Datos rápidos |
| Video | Clip / hint de video |
| Animar | Animación del modelo 3D |

---

## 4. Equipos

Ruta: `/equipos`

Lista de equipos LNM (escaneables / referencia).  
Útil para saber qué escudos y colores reconoce la experiencia.

---

## 5. Galería / Videos

Ruta: `/videos` (también `/galeria` redirige aquí)

### Qué puedes hacer
1. Ver imágenes de equipos y jugadores.
2. Reproducir el video embebido.
3. Aplicar **filtros** (brillo, contraste, etc.).
4. **Descargar** la imagen filtrada si el botón está disponible.

---

## 6. Modelos 3D

Ruta: `/modelos`

Galería de props:
- Bates
- Pelota
- Gorras (Yankees, Red Sox, LNM, LMB, etc.)

Toca un modelo para verlo rotar. Los archivos viven en `public/assets/modelos/`.

---

## 7. Contenido informativo

| Sección | Ruta | Uso |
|---------|------|-----|
| Historia | `/historia` | Línea de tiempo y leyendas |
| Estadísticas | `/estadisticas` | Standing / líderes |
| Recompensas | `/recompensas` | Insignias por escanear, jugar o completar trivia |

### Recompensas — cómo avanzar
1. Escanea en `/ar`.
2. Juega trivia o mini juegos.
3. Vuelve a **Recompensas** para ver lo desbloqueado.

---

## 8. Trivia

Ruta: `/trivia`

1. Entra a Trivia.
2. Responde las preguntas de béisbol / LNM.
3. Completar ayuda a desbloquear recompensas.

---

## 9. Juegos

### Jonrón al toque — `/juego`
1. Abre el juego.
2. Espera el momento del pitch.
3. Toca en el instante justo para batear.

### Hockey de rebote — `/rebote`
1. Abre el juego.
2. Desliza la tabla / pala.
3. No dejes caer la pelota.

---

## 10. Flujo sugerido (demo)

1. Arranca **API** + **Angular**.
2. Home → **Escáner AR** → modo **Gorra** → activa cámara.
3. Prueba **Info / Stats / Animar** con Yankees o Red Sox.
4. Ve a **Modelos 3D** y revisa las gorras.
5. Abre **Galería**, **Historia** o **Estadísticas**.
6. Juega **Trivia** o **Jonrón**.
7. Revisa **Recompensas**.

---

## 11. Problemas frecuentes

| Problema | Qué hacer |
|----------|-----------|
| Cámara no abre | Permite acceso en el navegador; prueba Chrome |
| API offline | `cd server` → `npm start` (puerto 5000) |
| Angular no carga | Desde la raíz del proyecto: `npm start` (puerto 2000) |
| Puerto ocupado | Cierra la otra terminal o deja la instancia que ya corre |
| Gorra no “reconoce” | En modo Gorra igual verás Yankees o Red Sox (demo) |

---

## 12. Consultar la base (catálogo)

Con la API encendida:
- Salud: http://localhost:5000/api/scan/health  
- Catálogo: http://localhost:5000/api/scan/catalog  

Archivos locales:
- `server/src/data/teams.json`
- `server/src/data/players.json`
