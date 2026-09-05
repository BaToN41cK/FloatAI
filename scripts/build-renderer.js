// Сборка renderer в один файл через esbuild (для продакшена/упаковки).
// Dev-режим (npm start) работает на исходных ESM-модулях app/js между собой.
const esbuild = require('esbuild');

esbuild.buildSync({
  entryPoints: ['app/js/main.js'],
  bundle: true,
  format: 'iife',
  outfile: 'app/dist/renderer.js',
  minify: true,
  sourcemap: false,
  target: ['chrome120'],
  define: { 'process.env.NODE_ENV': '"production"' }
});

console.log('✓ renderer собраны в app/dist/renderer.js');