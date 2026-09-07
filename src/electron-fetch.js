// Единая точка выбора fetch: в Electron main — net.fetch (Chromium, уважает proxy-server),
// в обычном Node — глобальный fetch. Используется client, web-tools и main.
let _fetch = global.fetch;
try {
  const electron = require('electron');
  if (electron && electron.net && electron.net.fetch) _fetch = electron.net.fetch.bind(electron.net);
} catch (_) { /* обычный Node */ }

const doFetch = (...args) => _fetch(...args);

module.exports = { doFetch };

