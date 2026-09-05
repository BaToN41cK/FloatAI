const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('корневые файлы запуска должны существовать и вести на scripts/', () => {
  const vbsPath = path.join(root, 'start-ai-chat.vbs');
  const pyPath = path.join(root, 'start_chat.py');

  assert.equal(fs.existsSync(vbsPath), true, 'отсутствует root-level start-ai-chat.vbs');
  assert.equal(fs.existsSync(pyPath), true, 'отсутствует root-level start_chat.py');

  const vbsText = fs.readFileSync(vbsPath, 'utf8');
  const pyText = fs.readFileSync(pyPath, 'utf8');

  assert.match(vbsText, /scripts\\start-ai-chat\.vbs|scripts\/start-ai-chat\.vbs/i);
  assert.match(pyText, /scripts\\start_chat\.py|scripts\/start_chat\.py/i);
});
