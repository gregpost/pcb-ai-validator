// file: vite.config.ts
// Configuration for Vite bundler with React and Tailwind support

import { defineConfig } from 'vite'; // defineConfig
import react from '@vitejs/plugin-react'; // react
import tailwindcss from '@tailwindcss/vite'; // tailwindcss

export default defineConfig({
  plugins: [
    react(), // react
    tailwindcss(), // tailwindcss
  ],
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
});
