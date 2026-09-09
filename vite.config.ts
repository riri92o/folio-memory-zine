import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';
export default defineConfig({
  // GitHub Pages sets this to /<repository>/. Other hosts keep the root path.
  base: process.env.VITE_BASE_PATH || '/',
  css: { postcss: { plugins: [tailwindcss()] } },
  server: { watch: { useFsEvents: false, usePolling: true } },
  plugins: [vinext()],
});
