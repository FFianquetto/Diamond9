import { config } from '../config.js';

/**
 * Object detection vía Roboflow Hosted Inference.
 * Sin API key: null (el pipeline usa el modo del cliente + OCR).
 *
 * Entrena / publica un modelo en Roboflow Universe con clases:
 *   baseball_cap | baseball_card | baseball
 */
export async function detectObjects(imageBase64) {
  const { apiKey, model, version, baseUrl } = config.roboflow;
  if (!apiKey) {
    return {
      enabled: false,
      predictions: [],
      note: 'ROBOFLOW_API_KEY no configurada',
    };
  }

  const clean = String(imageBase64 || '').replace(/^data:image\/\w+;base64,/, '');
  const url = `${baseUrl}/${model}/${version}?api_key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: clean,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Roboflow ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const predictions = (data.predictions || []).map((p) => ({
    class: String(p.class || p.class_name || '').toLowerCase(),
    confidence: Number(p.confidence || 0),
    x: p.x,
    y: p.y,
    width: p.width,
    height: p.height,
  }));

  return { enabled: true, predictions, raw: data };
}

export function classifyFromPredictions(predictions, preferredMode) {
  if (!predictions?.length) {
    return preferredMode || 'unknown';
  }

  const ranked = [...predictions].sort((a, b) => b.confidence - a.confidence);
  const top = ranked[0];
  const cls = top.class;

  if (/cap|hat|gorra|visor/.test(cls)) return 'gorra';
  if (/card|carta|trading|player/.test(cls)) return 'tarjeta';
  if (/ball|pelota|baseball(?!\s*cap)/.test(cls)) return 'pelota';

  return preferredMode || 'unknown';
}
