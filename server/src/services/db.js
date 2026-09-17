import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '../data');

const playerSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true },
    nombre: String,
    aliases: [String],
    equipoId: String,
    equipo: String,
    posicion: String,
    liga: String,
    stats: mongoose.Schema.Types.Mixed,
  },
  { collection: 'players' },
);

const teamSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true },
    nombre: String,
    aliases: [String],
    liga: String,
    abrev: String,
    color: String,
    keywords: [String],
    modelKey: String,
  },
  { collection: 'teams' },
);

const Player = mongoose.models.Player || mongoose.model('Player', playerSchema);
const Team = mongoose.models.Team || mongoose.model('Team', teamSchema);

let jsonCache = { players: [], teams: [] };
let ready = false;

function normalize(s = '') {
  return String(s)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function loadJsonSeeds() {
  const [playersRaw, teamsRaw] = await Promise.all([
    fs.readFile(path.join(dataDir, 'players.json'), 'utf8'),
    fs.readFile(path.join(dataDir, 'teams.json'), 'utf8'),
  ]);
  jsonCache = {
    players: JSON.parse(playersRaw),
    teams: JSON.parse(teamsRaw),
  };
}

export async function initDb() {
  await loadJsonSeeds();

  if (config.dbMode === 'mongo') {
    try {
      await mongoose.connect(config.mongoUri);
      const playerCount = await Player.countDocuments();
      if (playerCount === 0) {
        await Player.insertMany(jsonCache.players);
        await Team.insertMany(jsonCache.teams);
        console.log('[db] Mongo seed aplicado');
      }
      ready = true;
      console.log('[db] MongoDB conectado');
      return;
    } catch (err) {
      console.warn('[db] Mongo falló, usando JSON local:', err.message);
    }
  }

  ready = true;
  console.log(`[db] Modo JSON · ${jsonCache.players.length} jugadores · ${jsonCache.teams.length} equipos`);
}

export function isDbReady() {
  return ready;
}

export async function findPlayerByText(ocrText) {
  const text = normalize(ocrText);
  if (!text) return null;

  const players =
    config.dbMode === 'mongo' && mongoose.connection.readyState === 1
      ? await Player.find().lean()
      : jsonCache.players;

  let best = null;
  let bestScore = 0;

  for (const p of players) {
    const names = [p.nombre, ...(p.aliases || [])].map(normalize);
    for (const alias of names) {
      if (!alias) continue;
      if (text.includes(alias)) {
        const score = alias.length;
        if (score > bestScore) {
          bestScore = score;
          best = p;
        }
      } else {
        const parts = alias.split(' ').filter((w) => w.length >= 4);
        const hits = parts.filter((w) => text.includes(w)).length;
        if (parts.length && hits === parts.length) {
          const score = alias.length * 0.9;
          if (score > bestScore) {
            bestScore = score;
            best = p;
          }
        }
      }
    }
  }

  return best;
}

export async function findTeamByText(ocrText) {
  const text = normalize(ocrText);
  if (!text) return null;

  const teams =
    config.dbMode === 'mongo' && mongoose.connection.readyState === 1
      ? await Team.find().lean()
      : jsonCache.teams;

  let best = null;
  let bestScore = 0;

  for (const t of teams) {
    const names = [t.nombre, ...(t.aliases || []), ...(t.keywords || [])].map(normalize);
    for (const alias of names) {
      if (!alias) continue;
      // NY / LA / SF: coincidencia de palabra completa
      if (alias.length <= 2) {
        const re = new RegExp(`(?:^|\\s)${alias}(?:\\s|$)`);
        if (re.test(text) && bestScore < 3) {
          bestScore = 3;
          best = t;
        }
        continue;
      }
      if (text.includes(alias)) {
        const score = alias.length;
        if (score > bestScore) {
          bestScore = score;
          best = t;
        }
      }
    }
  }

  return best;
}

export async function getTeamById(id) {
  if (!id) return null;
  if (config.dbMode === 'mongo' && mongoose.connection.readyState === 1) {
    return Team.findOne({ id }).lean();
  }
  return jsonCache.teams.find((t) => t.id === id) || null;
}

export async function listCatalog() {
  const players =
    config.dbMode === 'mongo' && mongoose.connection.readyState === 1
      ? await Player.find().lean()
      : jsonCache.players;
  const teams =
    config.dbMode === 'mongo' && mongoose.connection.readyState === 1
      ? await Team.find().lean()
      : jsonCache.teams;
  return { players, teams };
}
