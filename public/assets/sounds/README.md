# Sonidos de interfaz

Coloca aquí archivos de audio cortos (`.wav`, `.mp3` o `.ogg`).

## Archivos actuales

| Archivo | Uso |
|---------|-----|
| `ui-click.wav` | Clic general (botones AR, thumbs) |
| `ui-filter.wav` | Cambio de filtro en Galería |
| `ui-success.wav` | Confirmación / éxito |

Ruta pública en la app: `assets/sounds/<archivo>`  
(carpeta real: `public/assets/sounds/`).

Para cambiar un sonido, sustituye el archivo con el **mismo nombre** o actualiza las rutas en `src/app/comp/shared/ui-sound.service.ts`.
