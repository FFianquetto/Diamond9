import { Router } from 'express';
import { detectObjects, classifyFromPredictions } from '../services/roboflow.js';
import { runOcr } from '../services/ocr.js';
import { matchTeamLogo } from '../services/logoMatch.js';
import { findPlayerByText, findTeamByText, getTeamById, listCatalog } from '../services/db.js';

export const scanRouter = Router();

const MODE_MODEL = {
  tarjeta: 'bate',
  gorra: 'gorra-yankees',
  pelota: 'pelota',
};

function withModelKey(team, preferredMode) {
  if (!team) return null;
  const modelKey =
    team.modelKey ||
    MODE_MODEL[preferredMode] ||
    (preferredMode === 'gorra' ? 'gorra-diablos' : 'pelota');
  return { ...team, modelKey };
}

/**
 * POST /api/scan
 * body: { image: base64|dataURL, mode?: 'tarjeta'|'gorra'|'pelota' }
 *
 * Flujo:
 *   Cámara → Node → Roboflow (opcional) → OCR + match de logo/colores → DB → equipo
 *   Tarjeta / Gorra / Pelota: todos pueden resolver por logo (plantilla + colores).
 */
scanRouter.post('/', async (req, res) => {
  try {
    const image = req.body?.image;
    const preferredMode = req.body?.mode || null;

    if (!image || typeof image !== 'string') {
      return res.status(400).json({
        ok: false,
        error: 'Falta image (base64 o data URL)',
      });
    }

    let detection = { enabled: false, predictions: [] };
    try {
      detection = await detectObjects(image);
    } catch (err) {
      detection = {
        enabled: true,
        predictions: [],
        error: err.message,
      };
    }

    const objectType = classifyFromPredictions(
      detection.predictions,
      preferredMode,
    );

    const mode = preferredMode || objectType;
    const ocrText = await runOcr(image, mode);
    let player = null;
    let team = null;
    let recognized = false;
    let message = '';
    let logoMatch = null;

    if (objectType === 'tarjeta' || preferredMode === 'tarjeta') {
      player = await findPlayerByText(ocrText);
      if (player) {
        team = withModelKey(
          (await getTeamById(player.equipoId)) || {
            id: player.equipoId,
            nombre: player.equipo,
            liga: player.liga,
            modelKey: 'bate',
          },
          'tarjeta',
        );
        recognized = true;
        message = `Carta de ${player.nombre} · equipo ${team.nombre}`;
      } else {
        // Escudo / logo en carta (sin nombre legible)
        logoMatch = await matchTeamLogo(image, ocrText);
        team = withModelKey(
          logoMatch?.team || (await findTeamByText(ocrText)),
          'tarjeta',
        );
        if (team) {
          recognized = true;
          message = `Escudo/carta de ${team.nombre}`;
        } else {
          message =
            'No se encontró el jugador/equipo. Acerca el logo o el nombre en la carta.';
        }
      }
    } else if (objectType === 'gorra' || preferredMode === 'gorra') {
      logoMatch = await matchTeamLogo(image, ocrText);
      team = withModelKey(
        logoMatch?.team || (await findTeamByText(ocrText)),
        'gorra',
      );

      if (team) {
        recognized = true;
        message = `Sí · gorra de ${team.nombre} (${team.liga || 'liga'})`;
      } else {
        message =
          'No se reconoció el logo. Acerca la gorra, buena luz, logo al centro.';
      }
    } else if (objectType === 'pelota' || preferredMode === 'pelota') {
      // Las pelotas casi siempre llevan logo/sello de equipo o liga
      logoMatch = await matchTeamLogo(image, ocrText);
      team = withModelKey(
        logoMatch?.team || (await findTeamByText(ocrText)),
        'pelota',
      );

      if (team) {
        recognized = true;
        message = `Pelota con logo de ${team.nombre}`;
        team = { ...team, modelKey: 'pelota' };
      } else {
        recognized = true;
        message = 'Pelota de beisbol detectada (sin logo de equipo claro)';
        team = {
          id: 'pelota-beisbol',
          nombre: 'Pelota de beisbol',
          liga: 'General',
          abrev: 'BALL',
          color: '#F5F5F5',
          modelKey: 'pelota',
        };
      }
    } else {
      player = await findPlayerByText(ocrText);
      if (player) {
        team = withModelKey(
          (await getTeamById(player.equipoId)) || {
            id: player.equipoId,
            nombre: player.equipo,
            liga: player.liga,
          },
          mode,
        );
        recognized = true;
        message = `${player.nombre} · ${team.nombre}`;
      } else {
        logoMatch = await matchTeamLogo(image, ocrText);
        team = withModelKey(
          logoMatch?.team || (await findTeamByText(ocrText)),
          mode,
        );
        if (team) {
          recognized = true;
          message = `Equipo: ${team.nombre}`;
        } else {
          message =
            'Objeto no clasificado. Elige modo Tarjeta/Gorra/Pelota y centra el logo.';
        }
      }
    }

    return res.json({
      ok: true,
      recognized,
      objectType,
      message,
      ocrText,
      player: player
        ? {
            id: player.id,
            nombre: player.nombre,
            equipo: player.equipo,
            posicion: player.posicion,
            liga: player.liga,
            stats: player.stats,
          }
        : null,
      team: team
        ? {
            id: team.id,
            nombre: team.nombre,
            liga: team.liga,
            abrev: team.abrev,
            color: team.color,
            modelKey: team.modelKey || null,
          }
        : null,
      logoMatch: logoMatch
        ? {
            colorScore: logoMatch.colorScore,
            textScore: logoMatch.textScore,
            templateScore: logoMatch.templateScore ?? null,
            combined: logoMatch.combined,
          }
        : null,
      detection: {
        enabled: detection.enabled,
        predictions: detection.predictions,
        error: detection.error || null,
        note: detection.note || null,
      },
    });
  } catch (err) {
    console.error('[scan]', err);
    return res.status(500).json({
      ok: false,
      error: err.message || 'Error interno de escaneo',
    });
  }
});

scanRouter.get('/catalog', async (_req, res) => {
  const catalog = await listCatalog();
  res.json({ ok: true, ...catalog });
});

scanRouter.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'diamante9-scan-api' });
});
