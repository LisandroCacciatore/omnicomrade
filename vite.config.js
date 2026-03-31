const { defineConfig } = require('vite');
const { resolve } = require('path');
const fs = require('fs');

const htmlEntries = fs
  .readdirSync(process.cwd())
  .filter((name) => name.endsWith('.html'))
  .reduce((acc, file) => {
    acc[file.replace('.html', '')] = resolve(process.cwd(), file);
    return acc;
  }, {});

module.exports = defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: htmlEntries
    }
  }
});
