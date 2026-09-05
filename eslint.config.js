const globals = require('globals');

const sharedRules = {
  'no-unused-vars': 'off',
  'no-console': 'off',
  'no-undef': 'off',
  'no-prototype-builtins': 'off'
};

module.exports = [
  {
    ignores: ['app/vendor/**', 'app/dist/**', 'node_modules/**'],
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'commonjs', globals: { ...globals.node, ...globals.browser } },
    rules: sharedRules
  },
  {
    // Renderer-модули — ESM (import/export), плюс глобалы vendor (Tesseract, marked)
    files: ['app/js/**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.browser, Tesseract: 'readonly', marked: 'readonly' } },
    rules: sharedRules
  }
];
