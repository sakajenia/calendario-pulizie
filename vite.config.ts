import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { execSync } from 'node:child_process'

/*
 * Targa della build: commit e data. Serve a rispondere a colpo d'occhio alla
 * domanda "sto guardando la versione aggiornata o una copia vecchia?", sia in
 * Impostazioni sia in fondo alla schermata di accesso.
 */
function buildId(): string {
  let commit = 'locale'
  try {
    commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim()
  } catch {
    /* fuori da un repo (o build senza git): resta "locale" */
  }
  const giorno = new Date().toISOString().slice(0, 16).replace('T', ' ')
  return `${commit} · ${giorno} UTC`
}

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
  define: { __BUILD_ID__: JSON.stringify(buildId()) },
})
