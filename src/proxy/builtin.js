// Встроенные прокси-серверы режима «Встроенный прокси».
// Сгенерировано scripts/encode-xray.js: XOR ('FloatAI-xray-v1') + base64.
// В этом файле НЕТ открытых адресов/UUID/паролей — расшифровка только в памяти при запуске Xray.
// ВАЖНО: это обфускация, а не шифрование — см. README (раздел «Встроенный прокси»).

const BUILTIN_XRAY_BLOB =
  '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';

function xorDecode(b64) {
  try {
    const buf = Buffer.from(b64, 'base64');
    const k = Buffer.from('FloatAI-xray-v1');
    const out = Buffer.alloc(buf.length);
    for (let i = 0; i < buf.length; i++) out[i] = buf[i] ^ k[i % k.length];
    const arr = JSON.parse(out.toString('utf8'));
    return Array.isArray(arr) && arr.length ? arr : [];
  } catch (_) { return []; }
}

function decodeBuiltinOutbounds() { return xorDecode(BUILTIN_XRAY_BLOB); }

module.exports = { decodeBuiltinOutbounds };
