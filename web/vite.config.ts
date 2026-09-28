import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:8185', '/auth': 'http://localhost:8185' } },
  build: { sourcemap: false },
});
