/*
 * I due link di ogni casa nella pagina Accessi: come lasciare la casa e la
 * cartella con accessi e materiali.
 *
 * Stanno qui, nel codice, e non fra i dati salvati: cosi' sono gli stessi su
 * ogni telefono e computer, appena si apre l'app, senza aspettare l'archivio
 * condiviso e senza che una copia vecchia su un dispositivo li copra. Per
 * cambiarne uno si cambia questo file. Dove un link manca, vale quello messo
 * a mano dalla modifica della casa.
 *
 * Non toccano nient'altro: calendario, pulizie e codici restano come sono.
 */
import type { Apartment } from '@/types'

interface LinkCasa {
  /** Pagina con le foto e i controlli di come va lasciata la casa. */
  comeLasciare?: string
  /** Cartella Drive con accessi e materiali. */
  infoAccessi?: string
}

export const LINK_FISSI: Record<string, LinkCasa> = {
  /* 3 minuti Vaticano · Via della Giuliana 35 */
  'ap-giuliana': {
    comeLasciare: 'https://tools.affittibreviaroma.com/check-giuliana-35',
    infoAccessi: 'https://drive.google.com/drive/u/2/folders/1COqfpZdIcNuGxN2ko3IVf2-oZpeneJpt',
  },
  /* Green House in Vaticano · Via Trionfale 20 */
  'ap-trionfale': {
    comeLasciare: 'https://tools.affittibreviaroma.com/check-trionfale-20',
    infoAccessi: 'https://drive.google.com/drive/u/2/folders/1MeVVLNXnAvhS3_F6JsCIoj-5oVMx5ZdN',
  },
  /* Small Red House · Via Giovanni Livraghi 2 */
  'ap-livraghi': {
    comeLasciare: 'https://tools.affittibreviaroma.com/check-livraghi-2',
    infoAccessi: 'https://drive.google.com/drive/folders/1JsoKlQKNIyRhb_IkkQ7P_76sDDgdbT2h?usp=sharing',
  },
  /* Trastevere Butterfly · Via della Scala 9 */
  'ap-scala': {
    comeLasciare: 'https://tools.affittibreviaroma.com/check-trastevere-scala-9',
    infoAccessi: 'https://drive.google.com/drive/folders/1oUyLfxMKNYf3M32j76n1lh3h2lZDcxcD?usp=sharing',
  },
  /* KlaFrà · Via dei Marsi 10. "check-marsi-1" porta a pagina non trovata:
     quella giusta ha il civico intero. */
  'ap-marsi': {
    comeLasciare: 'https://tools.affittibreviaroma.com/check-marsi-10',
    infoAccessi: 'https://drive.google.com/drive/u/2/folders/1b0mqlTynQWiww8yRbqKvu-fb8DSxQ522',
  },
  /* Consoli · Piazza dei Consoli 50. "check-consoli-5" porta a pagina non
     trovata: quella giusta ha il civico intero. */
  'ap-consoli': {
    comeLasciare: 'https://tools.affittibreviaroma.com/check-consoli-50',
    infoAccessi: 'https://drive.google.com/drive/u/2/folders/1qfSnM4Qw8NfQjsDNsMkMJu7FzmH2-d8A',
  },
  /* Stazione Centrale Roma · Via di Porta Labicana 19. Link "come lasciare
     la casa" non ancora dato. */
  'ap-labicana': {
    infoAccessi: 'https://drive.google.com/drive/folders/1nfdd2tdzYd_5TanFMHZ2yPAqCbiNWbkp?usp=drive_link',
  },
  /* Villa di Prestigio · Via Appia Pignatelli 198. Link dettati cosi';
     la pagina "check-llabicana-19" porta il nome di Porta Labicana. */
  'ap-appia': {
    comeLasciare: 'https://tools.affittibreviaroma.com/check-llabicana-19',
    infoAccessi: 'https://drive.google.com/drive/folders/1L1pMBkaNfM5knj-qqvVyNZgSLu7LBnaF?usp=drive_link',
  },
}

/** I link da mostrare per una casa: quelli fissi prima, poi quelli salvati. */
export function linkDellaCasa(apartment: Apartment) {
  const fissi = LINK_FISSI[apartment.id] ?? {}
  return {
    comeLasciare: fissi.comeLasciare ?? apartment.access?.leaveGuideUrl,
    infoAccessi: fissi.infoAccessi ?? apartment.access?.infoSheetUrl,
    comeLasciareFisso: Boolean(fissi.comeLasciare),
    infoAccessiFisso: Boolean(fissi.infoAccessi),
  }
}
