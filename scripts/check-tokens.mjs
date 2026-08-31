/*
 * Lint del design system: nessun colore fuori dai token semantici.
 * Fallisce se trova hex, rgb()/hsl() letterali o classi Tailwind di palette
 * (bg-blue-500, text-red-600, ...) nel codice sorgente dell'app.
 */
import fs from 'node:fs'
import path from 'node:path'

const SRC = 'src'
/* index.css definisce i token: è l'unico posto dove i colori letterali sono leciti.
   Logo.tsx porta i colori del marchio, che per definizione non seguono il tema. */
const ALLOW_FILES = new Set(['src/index.css', 'src/components/brand/Logo.tsx'])

const PALETTES = 'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'
const RULES = [
  { name: 'hex letterale', re: /#[0-9a-fA-F]{3,8}\b/g },
  { name: 'rgb()/hsl() letterale', re: /\b(?:rgba?|hsla?)\(\s*\d/g },
  {
    name: 'classe Tailwind di palette',
    re: new RegExp(`\\b(?:bg|text|border|ring|from|via|to|fill|stroke|shadow|divide|outline|decoration|accent|caret)-(?:${PALETTES})-\\d{2,3}\\b`, 'g'),
  },
]

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    return e.isDirectory() ? walk(p) : /\.(tsx?|css)$/.test(e.name) ? [p] : []
  })

let violations = 0
for (const file of walk(SRC)) {
  if (ALLOW_FILES.has(file)) continue
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    for (const rule of RULES) {
      rule.re.lastIndex = 0
      const hits = line.match(rule.re)
      if (!hits) continue
      violations += hits.length
      console.log(`${file}:${i + 1}  ${rule.name}: ${hits.join(', ')}`)
      console.log(`    ${line.trim().slice(0, 120)}`)
    }
  })
}

if (violations) {
  console.log(`\n✗ ${violations} violazioni del design system.`)
  process.exit(1)
}
console.log('✓ Nessun colore fuori dai token semantici.')
