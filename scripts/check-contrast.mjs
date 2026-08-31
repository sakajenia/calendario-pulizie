/*
 * Audit di contrasto WCAG su app in esecuzione, in tema chiaro e scuro.
 *
 *   npm run dev            # in un altro terminale
 *   node scripts/check-contrast.mjs
 *
 * Richiede playwright installato (non e' una dipendenza del progetto:
 *   npm i -D playwright && npx playwright install chromium
 * ). Gli sfondi traslucidi vengono composti su cio' che sta sotto, altrimenti
 * ogni superficie tinta risulterebbe un falso positivo.
 */
import { chromium } from 'playwright'
const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173'
const b = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})
const page = await (await b.newContext({viewport:{width:1500,height:950},locale:'it-IT'})).newPage()
await page.goto(`${BASE}/login`,{waitUntil:'networkidle',timeout:60000})
await page.getByRole('button',{name:'Accedi'}).click(); await page.waitForTimeout(2500)

const audit = async (theme) => {
  await page.evaluate((t)=>{document.documentElement.classList.toggle('dark', t==='dark')}, theme)
  const out = []
  for (const p of ['/calendario','/richieste','/dashboard','/utenti','/extra','/impostazioni']) {
    await page.goto(BASE + p,{waitUntil:'networkidle'}).catch(()=>{})
    await page.evaluate((t)=>{document.documentElement.classList.toggle('dark', t==='dark')}, theme)
    await page.waitForTimeout(1200)
    const bad = await page.evaluate(() => {
      const lum = (c) => {
        const [r,g,bl] = c.map(v => { v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4) })
        return 0.2126*r + 0.7152*g + 0.0722*bl
      }
      const parseRGBA = (s) => {
        const m = s.match(/[\d.]+/g)
        if (!m) return null
        const [r,g,b] = m.slice(0,3).map(Number)
        const a = m.length > 3 ? Number(m[3]) : 1
        return { rgb:[r,g,b], a }
      }
      const parse = (s) => { const p = parseRGBA(s); return p ? p.rgb : null }
      /* Gli sfondi traslucidi vanno COMPOSTI su cio' che sta sotto: leggere il
         solo rgb di un bg-primary/10 falsa completamente il rapporto. */
      const bgOf = (el) => {
        const stack = []
        let n = el
        while (n && n !== document.documentElement) {
          const p = parseRGBA(getComputedStyle(n).backgroundColor)
          if (p && p.a > 0) { stack.push(p); if (p.a >= 0.999) break }
          n = n.parentElement
        }
        let base = [255,255,255]
        for (let i = stack.length - 1; i >= 0; i--) {
          const { rgb, a } = stack[i]
          base = base.map((c, k) => Math.round(rgb[k] * a + c * (1 - a)))
        }
        return base
      }
      const ratio = (a,b) => { const l1=lum(a),l2=lum(b); const [hi,lo]=l1>l2?[l1,l2]:[l2,l1]; return (hi+0.05)/(lo+0.05) }
      const res = []
      for (const el of document.querySelectorAll('body *')) {
        if (el.children.length) continue
        const txt = (el.textContent||'').trim()
        if (txt.length < 2) continue
        const cs = getComputedStyle(el)
        if (cs.visibility==='hidden'||cs.display==='none'||+cs.opacity===0) continue
        const fg = parse(cs.color); if (!fg) continue
        const size = parseFloat(cs.fontSize)
        const bold = +cs.fontWeight >= 700
        const large = size >= 24 || (size >= 18.66 && bold)
        const need = large ? 3 : 4.5
        const r = ratio(fg, bgOf(el))
        if (r < need) res.push({ t: txt.slice(0,42), r: +r.toFixed(2), need, size: Math.round(size), cls:(el.className||'').toString().slice(0,44) })
      }
      return res
    })
    bad.forEach(x => out.push({ page:p, ...x }))
  }
  return out
}

let failures = 0
for (const theme of ['light', 'dark']) {
  const bad = await audit(theme)
  failures += bad.length
  const uniq = [...new Map(bad.map((x) => [x.cls + x.r, x])).values()]
  console.log(`\n=== ${theme.toUpperCase()} · sotto soglia: ${bad.length} (unici: ${uniq.length}) ===`)
  uniq.slice(0, 20).forEach((x) =>
    console.log(`  ${String(x.r).padStart(5)} / ${x.need}  ${x.size}px  "${x.t}"  [${x.cls}]`))
}
await b.close()

if (failures) {
  console.log(`\n\u2717 ${failures} elementi sotto la soglia WCAG AA.`)
  process.exit(1)
}
console.log('\n\u2713 Contrasto AA rispettato in tema chiaro e scuro.')
