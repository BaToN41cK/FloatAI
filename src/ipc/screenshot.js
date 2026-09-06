// IPC handlers для скриншотов: оверлей выделения, захват экрана, кроп.
const { screen, desktopCapturer } = require('electron');
const log = require('../logger');
const { t } = require('../i18n');

let chatWindow = null;
let shotSelector = null;

function setChatWindow(win) { chatWindow = win; }

function closeShotSelector() {
  if (shotSelector) { shotSelector.close(); shotSelector = null; }
}

// Открыть оверлей выделения области экрана
function openShotSelector() {
  if (!chatWindow) return;
  const { BrowserWindow } = require('electron');
  const display = screen.getPrimaryDisplay();
  chatWindow.hide();
  shotSelector = new BrowserWindow({
    fullscreen: true, frame: false, transparent: true,
    alwaysOnTop: true, skipTaskbar: true, show: false,
    x: display.bounds.x, y: display.bounds.y,
    width: display.bounds.width, height: display.bounds.height,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  shotSelector.setIgnoreMouseEvents(false);
  // Оверлей выделения: минимальный HTML без сетевых ресурсов, чтобы не ждать
  // загрузки и не светить лишний раз оверлей при снимке.
  const overlayHtml = [
    '<!DOCTYPE html><html><body style="margin:0;background:rgba(0,0,0,0.3);position:fixed;top:0;left:0;width:100vw;height:100vh">',
    '<div id="sel" style="position:fixed;display:none;border:2px solid #7c5cff;background:rgba(124,92,255,0.12)"></div>',
    `<div id="tip" style="position:fixed;top:12px;left:50%;transform:translateX(-50%);color:#fff;background:rgba(0,0,0,0.65);padding:6px 14px;border-radius:8px;font:14px sans-serif">${t('screenshot.select')}</div>`,
    '<script>',
    'const { ipcRenderer } = require("electron");',
    'let sx=0,sy=0,drag=false;',
    'const sel=document.getElementById("sel");',
    'addEventListener("keydown",e=>{if(e.key==="Escape")ipcRenderer.send("screenshot:cancel");});',
    'addEventListener("mousedown",e=>{drag=true;sx=e.clientX;sy=e.clientY;sel.style.display="block";sel.style.left=sx+"px";sel.style.top=sy+"px";sel.style.width="0";sel.style.height="0";});',
    'addEventListener("mousemove",e=>{if(!drag)return;sel.style.left=Math.min(sx,e.clientX)+"px";sel.style.top=Math.min(sy,e.clientY)+"px";sel.style.width=Math.abs(e.clientX-sx)+"px";sel.style.height=Math.abs(e.clientY-sy)+"px";});',
    'addEventListener("mouseup",e=>{',
      'if(!drag)return;drag=false;',
      'const r={x:Math.min(sx,e.clientX),y:Math.min(sy,e.clientY),width:Math.abs(e.clientX-sx),height:Math.abs(e.clientY-sy)};',
      'sel.style.display="none";',
      'if(r.width>8&&r.height>8)ipcRenderer.send("screenshot:select",r);else ipcRenderer.send("screenshot:cancel");',
    '});',
    '</script></body></html>'
  ].join('');
  shotSelector.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(overlayHtml))
    .catch(e => log.warn('[shot] load failed:', e.message));
  shotSelector.once('ready-to-show', () => shotSelector.show());
}

// Обработка выбранной области
function handleSelection(r) {
  const finish = (png) => {
    closeShotSelector();
    if (chatWindow) { chatWindow.show(); chatWindow.focus(); }
    if (png && chatWindow) chatWindow.webContents.send('app:screenshot', png);
  };
  try {
    closeShotSelector();
    const display = screen.getPrimaryDisplay();
    const scaleFactor = display.scaleFactor;
    setTimeout(() => {
      desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: display.size.width * scaleFactor, height: display.size.height * scaleFactor }
      }).then(sources => {
        if (!sources.length) { finish(null); return; }
        const img = sources[0].thumbnail;
        const rect = {
          x: Math.round(r.x * scaleFactor), y: Math.round(r.y * scaleFactor),
          width: Math.round(r.width * scaleFactor), height: Math.round(r.height * scaleFactor)
        };
        finish(img.crop(rect).toDataURL());
      }).catch(e => {
        log.warn('[shot] crop failed:', e.message);
        finish(null);
      });
    }, 150);
  } catch (e) {
    log.warn('[shot] selection error:', e.message);
    finish(null);
  }
}

function handleCancel() {
  closeShotSelector();
  if (chatWindow) { chatWindow.show(); chatWindow.focus(); }
}

function register(ipcMain) {
  ipcMain.on('screenshot:select', (_e, r) => handleSelection(r));
  ipcMain.on('screenshot:cancel', () => handleCancel());
}

module.exports = { setChatWindow, openShotSelector, register, handleSelection, handleCancel };
