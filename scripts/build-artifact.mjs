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

// Le @import di Google Fonts devono uscire dallo <style> inline: le promuoviamo a <link>.
const fontImports = [...css.matchAll(/@import url\((['"]?)(https:\/\/fonts\.googleapis\.com[^'")]+)\1\);?/g)]
css = css.replace(/@import url\((['"]?)https:\/\/fonts\.googleapis\.com[^'")]+\1\);?/g, '')

const links = fontImports
  .map((m) => `<link rel="stylesheet" href="${m[2]}">`)
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
