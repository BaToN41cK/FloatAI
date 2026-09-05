const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const root = path.join(__dirname, '..');
const source = path.join(root, 'app', 'vendor', 'lang-data');
const outputDir = path.join(root, 'dist');
const archive = path.join(outputDir, 'ocr-lang-data.zip');

if (!fs.existsSync(source)) throw new Error('Не найдены app/vendor/lang-data');
fs.mkdirSync(outputDir, { recursive: true });
if (fs.existsSync(archive)) fs.rmSync(archive, { force: true });

childProcess.execFileSync('tar', ['-a', '-c', '-f', archive, '-C', path.dirname(source), path.basename(source)], { stdio: 'inherit' });
console.log(`OCR optional package: ${archive}`);