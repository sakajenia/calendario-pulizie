/*
 * I link fissi della pagina Accessi. Oltre ai due link nuovi (Viale Quattro
 * Venti e il "come lasciare la casa" di Stazione Centrale Roma) controlla che
 * quelli di tutte le altre case siano rimasti identici.
 */
import { describe, expect, it } from 'vitest'
import { linkDellaCasa } from '@/data/linkAccessi'
import { casa } from './fixtures'

const QV_LASCIARE = 'https://tools.affittibreviaroma.com/quattro-venti'
const QV_INFO = 'https://drive.google.com/drive/folders/1w6zCU-WDmRGQPbnm0cv-hOMjNBVlK8b1?usp=sharing'

/* Com'erano prima di questa modifica, casa per casa. */
const PRIMA: Record<string, { comeLasciare: string | undefined; infoAccessi: string | undefined }> = {
  'ap-giuliana': { comeLasciare: 'https://tools.affittibreviaroma.com/check-giuliana-35', infoAccessi: 'https://drive.google.com/drive/u/2/folders/1COqfpZdIcNuGxN2ko3IVf2-oZpeneJpt' },
  'ap-trionfale': { comeLasciare: 'https://tools.affittibreviaroma.com/check-trionfale-20', infoAccessi: 'https://drive.google.com/drive/u/2/folders/1MeVVLNXnAvhS3_F6JsCIoj-5oVMx5ZdN' },
  'ap-livraghi': { comeLasciare: 'https://tools.affittibreviaroma.com/check-livraghi-2', infoAccessi: 'https://drive.google.com/drive/folders/1JsoKlQKNIyRhb_IkkQ7P_76sDDgdbT2h?usp=sharing' },
  'ap-scala': { comeLasciare: 'https://tools.affittibreviaroma.com/check-trastevere-scala-9', infoAccessi: 'https://drive.google.com/drive/folders/1oUyLfxMKNYf3M32j76n1lh3h2lZDcxcD?usp=sharing' },
  'ap-marsi': { comeLasciare: 'https://tools.affittibreviaroma.com/check-marsi-1', infoAccessi: 'https://drive.google.com/drive/u/2/folders/1b0mqlTynQWiww8yRbqKvu-fb8DSxQ522' },
  'ap-consoli': { comeLasciare: 'https://tools.affittibreviaroma.com/check-consoli-5', infoAccessi: 'https://drive.google.com/drive/u/2/folders/1qfSnM4Qw8NfQjsDNsMkMJu7FzmH2-d8A' },
  'ap-appia': { comeLasciare: undefined, infoAccessi: 'https://drive.google.com/drive/folders/1L1pMBkaNfM5knj-qqvVyNZgSLu7LBnaF?usp=drive_link' },
}

describe('link fissi di Accessi', () => {
  it('le altre case hanno gli stessi link di prima', () => {
    for (const [id, atteso] of Object.entries(PRIMA)) {
      /* Anche con link salvati a mano diversi, valgono quelli fissi come prima. */
      const l = linkDellaCasa(casa({ id, access: { entries: [], leaveGuideUrl: 'https://x.it/a', infoSheetUrl: 'https://x.it/b' } }))
      expect({ comeLasciare: l.comeLasciare, infoAccessi: l.infoAccessi }, id).toEqual(atteso)
    }
  })

  it('Stazione Centrale Roma: ora ha anche "come lasciare la casa", la cartella resta quella', () => {
    const l = linkDellaCasa(casa({ id: 'ap-labicana', name: 'Stazione Centrale Roma' }))
    expect(l.comeLasciare).toBe('https://tools.affittibreviaroma.com/check-llabicana-19')
    expect(l.infoAccessi).toBe('https://drive.google.com/drive/folders/1nfdd2tdzYd_5TanFMHZ2yPAqCbiNWbkp?usp=drive_link')
    expect(l.comeLasciareFisso && l.infoAccessiFisso).toBe(true)
  })

  it.each([
    ['Viale Quattro Venti', 'Via qualsiasi 1'],
    ['viale quattro venti', ''],
    ['VIALE DEI QUATTRO VENTI', ''],
    ['Viale Quattro-Venti, 12', ''],
    ['Casa Monteverde', 'Viale dei Quattro Venti 87'],
  ])('Viale Quattro Venti riconosciuta da nome/indirizzo: %s · %s', (name, address) => {
    const l = linkDellaCasa(casa({ id: 'ap-1792000000000-abcde', name, address }))
    expect(l.comeLasciare).toBe(QV_LASCIARE)
    expect(l.infoAccessi).toBe(QV_INFO)
  })

  it('una casa qualunque creata in app tiene i suoi link salvati', () => {
    const l = linkDellaCasa(casa({
      id: 'ap-1792000000000-zzzzz', name: 'Casa Prati', address: 'Via Cola di Rienzo 3',
      access: { entries: [], leaveGuideUrl: 'https://x.it/a', infoSheetUrl: 'https://x.it/b' },
    }))
    expect(l).toEqual({ comeLasciare: 'https://x.it/a', infoAccessi: 'https://x.it/b', comeLasciareFisso: false, infoAccessiFisso: false })
  })

  it('non modifica la casa che riceve', () => {
    const a = casa({ id: 'ap-1792000000000-abcde', name: 'Viale Quattro Venti', access: { entries: [], leaveGuideUrl: 'https://x.it/a' } })
    const prima = JSON.stringify(a)
    linkDellaCasa(Object.freeze(a))
    expect(JSON.stringify(a)).toBe(prima)
  })
})
