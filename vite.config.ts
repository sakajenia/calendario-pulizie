import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: { host: true, port: 5173 },
  /*
   * Output solo ASCII: i caratteri non ASCII escono come escape \uXXXX.
   * Serve perche' il bundle viene anche incorporato in un HTML singolo, dove
   * un charset mancante trasformerebbe accenti e frecce in mojibake.
   */
  esbuild: { charset: 'ascii' },
})
