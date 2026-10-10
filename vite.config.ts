import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build works from any folder or sub-path.
  base: './',
  build: {
    target: 'es2022',
    // three.js alone is ~600 kB minified; it's one chunk by design.
    chunkSizeWarningLimit: 900,
  },
});
