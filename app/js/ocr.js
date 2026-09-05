// OCR скриншотов через локальный Tesseract (vendor/, без CDN).
// Изображение не покидает ПК — модели уходит только распознанный текст.
import { $, addMsg, setStatus, addOcrDetails } from './ui.js';
import { stream } from './ui.js';

export const MAX_IMAGE_MB = 10;
// Большие кадры (особенно скриншоты области в полном DPI-разрешении) тормозят
// Tesseract до минут. Сжимаем до этой ширины перед OCR — скорость растёт в разы,
// точность распознавания текста почти не страдает.
const OCR_MAX_WIDTH = 2400;
const OCR_MIN_WIDTH = 1200;

// Увеличить мелкий текст, повернуть кадр и усилить контраст локально.
function prepareOcrImage(dataUrl, mime, angle = 0, binary = false) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const sourceWidth = img.naturalWidth;
        const sourceHeight = img.naturalHeight;
        const targetWidth = Math.min(OCR_MAX_WIDTH, Math.max(OCR_MIN_WIDTH, sourceWidth));
        const scale = targetWidth / sourceWidth;
        const rotated = angle % 180 !== 0;
        const w = Math.max(32, Math.round((rotated ? sourceHeight : sourceWidth) * scale));
        const h = Math.max(32, Math.round((rotated ? sourceWidth : sourceHeight) * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.rotate(angle * Math.PI / 180);
        ctx.drawImage(img, -sourceWidth * scale / 2, -sourceHeight * scale / 2, sourceWidth * scale, sourceHeight * scale);
        ctx.restore();
        const pixels = ctx.getImageData(0, 0, w, h);
        for (let i = 0; i < pixels.data.length; i += 4) {
          const luminance = 0.299 * pixels.data[i] + 0.587 * pixels.data[i + 1] + 0.114 * pixels.data[i + 2];
          const contrast = Math.max(0, Math.min(255, (luminance - 128) * 1.35 + 128));
          const value = binary ? (contrast > 170 ? 255 : 0) : contrast;
          pixels.data[i] = value; pixels.data[i + 1] = value; pixels.data[i + 2] = value;
        }
        ctx.putImageData(pixels, 0, 0);
        resolve({ dataUrl: canvas.toDataURL('image/png'), mime: 'png', angle, binary });
      } catch (_) { resolve({ dataUrl, mime }); } // если не вышло — отдаём как есть
    };
    img.onerror = () => resolve({ dataUrl, mime });
    img.src = dataUrl;
  });
}

async function recognizeBestOcr(dataUrl) {
  const angles = [0, 90, 180, 270];
  let best = { text: '', confidence: 0, angle: 0 };
  for (const angle of angles) {
    const image = await prepareOcrImage(dataUrl, 'png', angle);
    const result = await Tesseract.recognize(image.dataUrl, 'rus+eng', TESSERACT_OPTIONS);
    const candidate = { text: (result.data.text || '').trim(), confidence: result.data.confidence || 0, angle };
    if (candidate.confidence > best.confidence || (!best.text && candidate.text)) best = candidate;
    if (best.confidence >= 75) break;
  }
  if (best.confidence < 70) {
    const image = await prepareOcrImage(dataUrl, 'png', best.angle, true);
    const result = await Tesseract.recognize(image.dataUrl, 'rus+eng', TESSERACT_OPTIONS);
    if ((result.data.confidence || 0) > best.confidence) {
      best = { text: (result.data.text || '').trim(), confidence: result.data.confidence || 0, angle: best.angle };
    }
  }
  return best;
}

// Локальный Tesseract: worker и wasm-ядро из vendor/. Языковые данные (rus+eng,
// ~15 МБ) скачиваются один раз и кэшируются в IndexedDB.
const VENDOR_URL = new URL('vendor/', document.baseURI);
const TESSERACT_OPTIONS = {
  workerPath: new URL('worker.min.js', VENDOR_URL).href,
  corePath: new URL('core/', VENDOR_URL).href,
  langPath: new URL('lang-data/', VENDOR_URL).href,
  workerBlobURL: false,
  logger: () => {} // отключаем спам в консоль
};

let pendingImage = null;       // прикреплённое изображение { base64, mime }
let pendingPreviewDiv = null;  // превью-строка в чате

export function hasPendingImage() { return !!pendingImage; }
export function getPendingImage() { return pendingImage; }

function clearImage() {
  pendingImage = null;
  if (pendingPreviewDiv) pendingPreviewDiv.remove();
  pendingPreviewDiv = null;
}

function setPendingImage(img) {
  pendingImage = img;
  if (pendingPreviewDiv) pendingPreviewDiv.remove();
  pendingPreviewDiv = null;
  if (img) {
    pendingPreviewDiv = addMsg('📷 Скриншот прикреплён — напиши вопрос (или просто отправь) и жми Enter', 'typing');
    $('input').focus();
  }
}

function handlePaste(e) {
  const items = e.clipboardData && e.clipboardData.items;
  if (!items) return;
  for (const item of items) {
    if (item.type && item.type.startsWith('image/')) {
      e.preventDefault();
      const file = item.getAsFile();
      if (!file) continue;
      if (file.size > MAX_IMAGE_MB * 1024 * 1024) { setStatus(`Картинка слишком большая (максимум ${MAX_IMAGE_MB} МБ)`); return; }
      const mime = item.type === 'image/jpg' ? 'image/jpeg' : item.type;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result);
        const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
        setPendingImage({ base64, mime: mime.replace('image/', '') });
      };
      reader.readAsDataURL(file);
      return;
    }
  }
}

// Отправка сообщения с изображением: OCR -> текст -> модель.
// Вызывается из main.js из общего send(), когда прикреплена картинка.
export async function handleImageSend(text) {
  const img = pendingImage;
  clearImage();
  $('input').value = '';
  addMsg(text ? `📷 ${text}` : '📷 Что на скриншоте?', 'user');
  setStatus('подготавливаю скриншот…');
  stream.setStreaming(true);
  try {
    let dataUrl = `data:image/${img.mime};base64,${img.base64}`;
    setStatus('OCR распознаёт текст…');
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('OCR не ответил за 180 сек')), 180000));
    const recognize = recognizeBestOcr(dataUrl);
    const ocr = await Promise.race([recognize, timeout]);

    if (!ocr.text) {
      setStatus('');
      addMsg('📷 На скриншоте не найден текст. Если там картинка без текста — этот режим её не разберёт.', 'error');
      $('input').focus();
      return;
    }

    setStatus('текст прочитан, Неко думает…');
    if (!(await window.api.confirmSensitive(ocr.text))) {
      setStatus('');
      addMsg('📷 Отправка отменена: в распознанном тексте могут быть секреты.', 'error');
      return;
    }
    const res = await window.api.sendImageText(text, ocr.text, ocr.confidence);
    setStatus('');
    if (res.ok) {
      let reply = res.reply;
      if (ocr.confidence < 60) {
        reply += `\n\n⚠️ *Скриншот распознан неуверенно (${Math.round(ocr.confidence)}%)* — проверь текст ниже и при необходимости пришли скрин покачественнее.`;
      }
      addMsg(reply, 'assistant');
      addOcrDetails(res.text);
    } else {
      addMsg('📷 Ошибка: ' + res.error, 'error');
    }
  } catch (err) {
    setStatus('');
    addMsg('📷 Ошибка распознавания: ' + err.message + (err.message.includes('OCR') ? '' : ' (нужен интернет для первой загрузки языков OCR)'), 'error');
  } finally {
    stream.setStreaming(false);
    $('input').focus();
  }
}

// Навешивает обработчики вставки из буфера и drag & drop.
// Скриншот области из main (Ctrl+Shift+S) -> сразу OCR без ручной вставки.
export function importScreenshot(dataUrl) {
  const base64 = String(dataUrl).slice(String(dataUrl).indexOf(',') + 1);
  setPendingImage({ base64, mime: 'png' });
  handleImageSend(''); // авто-отправка: распознать и спросить «что на скриншоте?»
}

export function initImageInputs() {
  $('input').addEventListener('paste', handlePaste);
  window.addEventListener('paste', handlePaste);
  const container = $('chatContainer');
  container.addEventListener('dragover', (e) => { e.preventDefault(); container.classList.add('drag-over'); });
  container.addEventListener('dragleave', () => container.classList.remove('drag-over'));
  container.addEventListener('drop', (e) => {
    e.preventDefault();
    container.classList.remove('drag-over');
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) { setStatus('Перетащи изображение'); return; }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) { setStatus(`Картинка слишком большая (максимум ${MAX_IMAGE_MB} МБ)`); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
      const mime = file.type === 'image/jpg' ? 'image/jpeg' : file.type;
      setPendingImage({ base64, mime: mime.replace('image/', '') });
      setStatus('');
    };
    reader.readAsDataURL(file);
  });
}