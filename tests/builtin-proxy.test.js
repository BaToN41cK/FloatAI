const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { decodeBuiltinOutbounds } = require('../src/proxy/builtin');
const { buildConfig, SOCKS_PORT } = require('../src/proxy/xray-manager');

const ROOT = path.join(__dirname, '..');

test('в исходниках нет открытых данных встроенных серверов', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'proxy', 'builtin.js'), 'utf8');
  assert.ok(!/158\.160\./.test(src), 'открытый адрес сервера в builtin.js');
  assert.ok(!/16bc17c2/i.test(src), 'открытый UUID в builtin.js');
  assert.ok(!/federal-usa/.test(src), 'открытый адрес trojan в builtin.js');
  assert.ok(!/GXxj_bqV/.test(src), 'открытый пароль в builtin.js');
  assert.ok(!/publicKey|serverName|shortId/.test(src), 'открытые streamSettings в builtin.js');
});

test('встроенные серверы декодируются в валидные outbounds', () => {
  const list = decodeBuiltinOutbounds();
  assert.equal(list.length, 3, 'должно быть 3 встроенных сервера');
  for (const o of list) {
    assert.ok(['vless', 'trojan'].includes(o.protocol), 'протокол ' + o.protocol);
    assert.match(o.tag, /^proxy-/);
    assert.ok(o.streamSettings && o.streamSettings.security === 'reality' || o.streamSettings?.security === 'tls');
  }
  const addrs = list.map(o => (o.settings.vnext || o.settings.servers)[0].address).sort();
  assert.deepEqual(addrs, ['158.160.160.162', '158.160.199.68', 'gr.federal-usa.com']);
});

test('buildConfig: локальный socks + два балансера + observatory', () => {
  const cfg = buildConfig(decodeBuiltinOutbounds());
  // Инбаунд — только localhost, чтобы не открывать прокси в сеть
  assert.equal(cfg.inbounds[0].listen, '127.0.0.1');
  assert.equal(cfg.inbounds[0].port, SOCKS_PORT);
  assert.equal(cfg.inbounds[0].protocol, 'socks');
  // Теги: серверы с 🇷🇺 в remarks получают префикс rf-proxy- (исключены из AI-доменов)
  const tags = cfg.outbounds.map(o => o.tag);
  assert.deepEqual(tags, ['rf-proxy-0', 'proxy-1', 'proxy-2', 'direct']);
  // Два балансера: balancer-intl (без РФ) для заблокированных AI API,
  // balancer-all (все серверы) для остального трафика
  const [intl, all] = cfg.routing.balancers;
  assert.equal(intl.tag, 'balancer-intl');
  assert.deepEqual(intl.selector, ['proxy-']);
  assert.equal(intl.strategy.type, 'leastLoad');
  assert.equal(all.tag, 'balancer-all');
  assert.deepEqual(all.selector, ['proxy-', 'rf-proxy-']);
  // Правила: сначала домены AI API -> balancer-intl, затем весь трафик -> balancer-all
  assert.equal(cfg.routing.rules[0].domain.includes('domain:groq.com'), true);
  assert.equal(cfg.routing.rules[0].balancerTag, 'balancer-intl');
  assert.equal(cfg.routing.rules[1].balancerTag, 'balancer-all');
  assert.equal(cfg.burstObservatory.subjectSelector.includes('proxy-'), true);
  assert.equal(cfg.burstObservatory.subjectSelector.includes('rf-proxy-'), true);
  // В конфиге есть plaintext-креды (Xray их требует), но файл временный и удаляется при остановке
  assert.ok(JSON.stringify(cfg).length > 100);
});

test('конфиг Xray валиден как JSON после сборки', () => {
  const cfg = buildConfig(decodeBuiltinOutbounds());
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(cfg)));
});
