import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// On GitHub Pages the app lives at /pick-em-p9/; locally it stays at /. The usability builds live
// one level further down (/pick-em-p9/picks/, /pick-em-p9/night/) and say so through VITE_BASE.
export default defineConfig(({ command }) => ({
  base: process.env.VITE_BASE || (command === 'build' ? '/pick-em-p9/' : '/'),
  plugins: [react(), tailwindcss()],
  // the harness assigns the dev port through PORT; without this Vite would ignore it
  server: { port: process.env.PORT ? Number(process.env.PORT) : undefined, host: true },
}));
