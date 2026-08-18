# 01 — Plataforma de desarrollo elegida y justificación técnica

**Proyecto:** Diamante 9 · Beisbol AR  
**Integrantes:** ________________ / ________________  
**Roles:** Programador · Diseñador de ventana AR  

---

## 1. Plataforma elegida

| Campo | Decisión |
|-------|----------|
| Tipo | **Aplicación Web basada en AR** |
| Framework UI | **Angular 19** (TypeScript, componentes standalone) |
| Capa AR (planificada / en integración) | **MindAR** (Image Tracking) + **Three.js** (modelos glTF/glb) |
| Cámara | API web `getUserMedia` / MediaDevices |
| Empaque móvil (3ª entrega) | **Capacitor** → APK Android (y PWA instalable); IPA si hay entorno Apple |
| Dispositivos objetivo | Navegadores móviles **Android** y **iOS** (Chrome / Safari) |
| Diseño | **Responsive** obligatorio (ya implementado en la shell UI) |

No se eligió app nativa pura (Kotlin/Swift) ni Flutter/React Native porque el curso privilegia procesamiento de imagen en web, el equipo ya tiene una base Angular con identidad visual aprobada, y glTF/glb + tracking por imagen son estándar en WebAR.

---

## 2. Justificación técnica

### Ventajas frente a nativo / Vuforia puro

1. **Una sola base de código** para Android e iOS vía navegador.
2. **Responsive** con CSS/Angular Material ya alineado a la identidad Diamante 9 (sin rediseñar).
3. Modelos **glTF/glb** nativos en web (Three.js) → flujo directo del Diseñador AR (Blender → export).
4. Filtros de video con **Canvas 2D** (requisito de la rúbrica) sin SDK propietario.
5. Despliegue sencillo (hosting estático + **HTTPS** para cámara).
6. Camino claro a **APK** con Capacitor en la 3ª entrega sin reescribir la UI.

### Restricciones asumidas (y mitigación)

| Riesgo | Mitigación |
|--------|------------|
| Cámara/AR requiere HTTPS en móvil | Hosting con SSL o túnel (ngrok) en demos |
| Safari iOS límites WebXR/WebAR | Preferir MindAR (image targets) probado en iOS; pruebas tempranas |
| Peso de modelos 3D | Presupuesto: glb livianos, texturas comprimidas, lazy-load |
| Rendimiento CPU/GPU móvil | Menos de ~50–80k tris por escena; un modelo activo a la vez |

### Stack por rol

| Rol | Herramientas |
|-----|----------------|
| Programador | Angular, TypeScript, MindAR, Three.js, Canvas filtros, Capacitor |
| Diseñador AR | Blender (modelado/animación), export glb, marcadores imprimibles, video/audio |

---

## 3. Evidencia en el repositorio

- App Angular en raíz del proyecto (`src/app/...`).
- Rutas de experiencia: `/`, `/ar`, `/videos`, `/trivia`, `/estadisticas`, `/marcadores`.
- Assets preparados: `public/assets/markers`, `models3d`, `videos`, `logos`.
- Servidor de desarrollo: **puerto 2000** (`npm start` → http://localhost:2000).

---

## 4. Referencias (para citar en la entrega)

- Angular: https://angular.dev  
- MindAR: https://hiukim.github.io/mind-ar-js-doc/  
- Three.js / glTF: https://threejs.org  
- Capacitor: https://capacitorjs.com  
