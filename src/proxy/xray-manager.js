// Менеджер встроенного VPN-прокси: ядро Xray + серверы из src/proxy/builtin.js.
// Локальный SOCKS на 127.0.0.1:18108 (не 10808/10809 — не конфликтует с Happ/v2rayN).
// Отказоустойчивость: в Xray-конфиге балансер leastLoad + burstObservatory —
// если сервер упал, трафик автоматически уходит на живой.
const { spawn } = require('child_process');
const net = require('net');
const fs = require('fs');
const os = require('os');
const path = require('path');
const log = require('../logger');
const { decodeBuiltinOutbounds } = require('./builtin');

const SOCKS_PORT = 18108;
const CORE_URL = 'https://github.com/XTLS/Xray-core/releases/latest/download/Xray-windows-64.zip';

let child = null;
let starting = null; // Promise текущего запуска (защита от параллельных ensureStarted)
let stopping = false;
let status = { running: false, servers: 0, port: SOCKS_PORT, error: null, startedAt: null };

function dataDir() {
  try {
    const { app } = require('electron');
    return path.join(app.getPath('userData'), 'xray');
  } catch (_) {
    return path.join(__dirname, '..', '..', 'logs', 'xray'); // вне Electron (тесты)
  }
}

function corePath() {
  const local = path.join(dataDir(), 'xray.exe');
  if (fs.existsSync(local)) return local;
  // Для dev: можно положить ядро руками в vendor/xray/xray.exe
  const vendor = path.join(__dirname, '..', '..', 'vendor', 'xray', 'xray.exe');
  if (fs.existsSync(vendor)) return vendor;
  return null;
}

// Собрать общий Xray-конфиг из встроенных серверов. Возвращает объект (не строку).
// Роутинг: домены заблокированных AI API (Groq/Cohere/...) идут ТОЛЬКО через
// зарубежные серверы (tag proxy-N); серверы с 🇷🇺 в remarks (tag rf-proxy-N) —
// для остального трафика. Балансер leastLoad + burstObservatory = автопереключение
// на живой сервер, если текущий упал.
const AI_DOMAINS = [
  'domain:groq.com',
  'domain:cohere.ai',
  'domain:openai.com',
  'domain:anthropic.com',
  'domain:mistral.ai',
  'domain:cerebras.ai',
  'domain:z.ai',
  'domain:openrouter.ai',
  'domain:unorouter.com',
  'domain:generativelanguage.googleapis.com'
];

function buildConfig(outbounds, port = SOCKS_PORT) {
  const proxies = outbounds.map((o, i) => ({
    ...o,
    tag: /🇷🇺|\brf\b/i.test(String(o.remarks || '')) ? `rf-proxy-${i}` : `proxy-${i}`
  }));
  return {
    log: { loglevel: 'warning' },
    inbounds: [{
      tag: 'socks-in',
      listen: '127.0.0.1',
      port,
      protocol: 'socks',
      settings: { udp: true },
      sniffing: { enabled: true, destOverride: ['http', 'tls', 'quic'] }
    }],
    outbounds: [...proxies, { protocol: 'freedom', tag: 'direct' }],
    routing: {
      balancers: [
        { tag: 'balancer-intl', selector: ['proxy-'], strategy: { type: 'leastLoad' } },
        { tag: 'balancer-all', selector: ['proxy-', 'rf-proxy-'], strategy: { type: 'leastLoad' } }
      ],
      rules: [
        { type: 'field', domain: AI_DOMAINS, balancerTag: 'balancer-intl' },
        { type: 'field', network: 'tcp,udp', balancerTag: 'balancer-all' }
      ]
    },
    burstObservatory: {
      subjectSelector: ['proxy-', 'rf-proxy-'],
      pingConfig: {
        destination: 'https://www.gstatic.com/generate_204',
        connectivity: 'http',
        interval: '1m',
        sampling: 2,
        timeout: '5s'
      }
    }
  };
}

function waitForPort(port, timeoutMs = 15000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    (function probe() {
      const sock = net.connect(port, '127.0.0.1');
      sock.once('connect', () => { sock.destroy(); resolve(true); });
      sock.once('error', () => {
        sock.destroy();
        if (Date.now() - started > timeoutMs) reject(new Error('Xray не открыл порт ' + port));
        else setTimeout(probe, 300);
      });
    })();
  });
}

// Скачивание ядра Xray (бесплатно, MPL-2.0, github.com/XTLS/Xray-core)
async function downloadCore() {
  const dir = dataDir();
  fs.mkdirSync(dir, { recursive: true });
  const zip = path.join(dir, 'xray.zip');
  log.info('[proxy] скачиваю ядро Xray (~25 МБ, один раз)…');
  const res = await fetch(CORE_URL, { signal: AbortSignal.timeout(300000) });
  if (!res.ok) throw new Error('не скачал ядро: HTTP ' + res.status);
  fs.writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
  // Распаковка штатным PowerShell — без зависимостей
  await new Promise((resolve, reject) => {
    const ps = spawn('powershell.exe', [
      '-NoProfile', '-Command',
      `Expand-Archive -LiteralPath '${zip}' -DestinationPath '${dir}' -Force`
    ], { windowsHide: true });
    ps.once('exit', code => code === 0 ? resolve() : reject(new Error('Expand-Archive вернул ' + code)));
    ps.once('error', reject);
  });
  fs.rmSync(zip, { force: true });
  const exe = path.join(dir, 'xray.exe');
  if (!fs.existsSync(exe)) throw new Error('после распаковки нет xray.exe');
  return exe;
}

async function ensureStarted() {
  if (status.running) return true;
  if (starting) return starting;
  starting = (async () => {
    try {
      const outbounds = decodeBuiltinOutbounds();
      if (!outbounds.length) throw new Error('встроенные серверы не заданы (сгенерируй src/proxy/builtin.js)');
      status.servers = outbounds.length;

      let exe = corePath();
      if (!exe) exe = await downloadCore();

      // Расшифрованный конфиг живёт только во временном файле, удаляется при остановке
      const cfgFile = path.join(os.tmpdir(), `floatai-xray-${process.pid}.json`);
      fs.writeFileSync(cfgFile, JSON.stringify(buildConfig(outbounds)), 'utf8');

      child = spawn(exe, ['run', '-c', cfgFile], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout.on('data', () => {});
      child.stderr.on('data', d => log.warn('[proxy][xray]', String(d).trim().slice(0, 200)));
      const cleanup = () => { try { fs.rmSync(cfgFile, { force: true }); } catch (_) {} };
      child.once('exit', (code) => {
        cleanup();
        child = null;
        status.running = false;
        if (!stopping) {
          log.warn('[proxy] Xray завершился (код ' + code + '), перезапускаю через 3с');
          setTimeout(() => ensureStarted().catch(e => log.warn('[proxy] перезапуск не удался:', e.message)), 3000);
        }
      });

      await waitForPort(SOCKS_PORT);
      status.running = true;
      status.error = null;
      status.startedAt = new Date().toISOString();
      log.info(`[proxy] встроенный прокси запущен: socks5://127.0.0.1:${SOCKS_PORT} (${outbounds.length} сервер(ов), балансер leastLoad)`);
      return true;
    } catch (e) {
      status.error = e.message;
      log.warn('[proxy] встроенный прокси недоступен:', e.message);
      return false;
    } finally {
      starting = null;
    }
  })();
  return starting;
}

function stop() {
  stopping = true;
  try { if (child) child.kill(); } catch (_) {}
  child = null;
  status.running = false;
  stopping = false;
}

// Статус для диагностики — БЕЗ каких-либо сведений о серверах
function getStatus() {
  return { ...status };
}

module.exports = { ensureStarted, stop, getStatus, buildConfig, SOCKS_PORT };
