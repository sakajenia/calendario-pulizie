/* Comprime la build Vite in un singolo HTML pubblicabile come Artifact. */
import fs from 'node:fs'
import path from 'node:path'

const DIST = 'dist'
const OUT = process.argv[2] || '/tmp/ppm-artifact.html'

const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8')

const jsFiles = [...html.matchAll(/<script[^>]*src="([^"]+)"[^>]*>\s*<\/script>/g)]
const cssFiles = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)]

const read = (u) => fs.readFileSync(path.join(DIST, u.replace(/^\//, '')), 'utf8')

let css = cssFiles.map((m) => read(m[1])).join('\n')
const js = jsFiles.map((m) => read(m[1])).join('\n')

/*
 * Le @import di Google Fonts devono uscire dallo <style> inline, altrimenti il
 * browser le ignora (una @import deve stare in cima al foglio di stile).
 * Vite minifica sia `@import url("...")` sia `@import "..."`: gestiamo entrambe.
 */
const IMPORT_RE = /@import\s*(?:url\()?\s*(['"]?)(https:\/\/fonts\.googleapis\.com[^'")\s]+)\1\s*\)?\s*;?/g
const fontImports = [...css.matchAll(IMPORT_RE)].map((m) => m[2])
css = css.replace(IMPORT_RE, '')

const links = fontImports
  .map((href) => `<link rel="stylesheet" href="${href}">`)
  .join('\n')

const out = `<title>ProProManager</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${links}
<style>
html, body, #root { height: 100%; }
body { margin: 0; }
${css}
</style>
<div id="root"></div>
<script type="module">
${js}
</script>
`

fs.writeFileSync(OUT, out)
const kb = (fs.statSync(OUT).size / 1024).toFixed(0)
console.log(`artifact -> ${OUT} (${kb} KB)`)
