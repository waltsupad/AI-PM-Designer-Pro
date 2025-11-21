import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // 重要：確保在 GitHub Pages 的子路徑下資源路徑正確
  // Removed 'define' to avoid conflicts with environment variables
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  }
});