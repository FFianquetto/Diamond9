import { createWorker, PSM } from 'tesseract.js';

let workerPromise = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker('eng', 1, { logger: () => {} });
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÁÉÍÓÚáéíóúÑñ0123456789 ',
        tessedit_pageseg_mode: PSM.AUTO,
      });
      return worker;
    })();
  }
  return workerPromise;
}

/**
 * OCR sobre imagen base64 (data URL o raw).
 * modeHint 'gorra': intenta también modo sparse (logos cortos tipo NY).
 */
export async function runOcr(imageBase64, modeHint = null) {
  const clean = String(imageBase64 || '');
  const dataUrl = clean.startsWith('data:')
    ? clean
    : `data:image/jpeg;base64,${clean}`;

  const worker = await getWorker();
  const {
    data: { text },
  } = await worker.recognize(dataUrl);

  let out = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();

  if (modeHint === 'gorra' && out.length < 4) {
    try {
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      });
      const second = await worker.recognize(dataUrl);
      const alt = String(second?.data?.text || '')
        .replace(/\s+/g, ' ')
        .trim();
      if (alt.length > out.length) out = alt;
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.AUTO,
      });
    } catch {
      // ignore second-pass OCR errors
    }
  }

  return out;
}
