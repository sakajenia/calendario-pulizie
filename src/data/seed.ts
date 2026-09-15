import type {
  Apartment, AppNotification, CleaningRequest, ExtraCatalogItem, RequestStatus,
  TaskCatalogItem, User, Warehouse, WorkSheet, BedType, RequestBed,
  Inspection, InspectionTask, InspectorId, Intervention,
} from '@/types'

/** PRNG deterministico: il seed non deve cambiare fra un reload e l'altro. */
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(20260831)
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]
const int = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1))

/**
 * Riferimento temporale dell'app: il giorno corrente. Tutto il dataset si
 * dispone intorno a questa data, cosi' aprendo un calendario si atterra sul
 * mese in corso invece che su un mese storico.
 */
export const TODAY = (() => {
  const d = new Date()
  d.setHours(9, 0, 0, 0)
  return d
})()

const iso = (d: Date) => d.toISOString()
const day = (offset: number, h = 10, m = 0) => {
  const d = new Date(TODAY)
  d.setDate(d.getDate() + offset)
  d.setHours(h, m, 0, 0)
  return d
}

/** Ogni ditta di pulizie ha il proprio accesso e vede solo le proprie case. */
export const users: User[] = [
  { id: 'u-admin', name: 'ProProManager', email: 'm2ab.srl@gmail.com', phone: '+39 340 118 2277', role: 'admin', active: true, createdAt: iso(day(-420)) },
  { id: 'u-pulizie-comfy', name: 'Comfy', email: 'comfy@propromanager.it', phone: '+39 349 772 1188', role: 'operator', companyId: 'comfy', password: '123456', active: true, createdAt: iso(day(-260)) },
  { id: 'u-pulizie-angela', name: 'Angela', email: 'angela@propromanager.it', phone: '+39 348 551 9042', role: 'operator', companyId: 'angela', password: '123456', active: true, createdAt: iso(day(-255)) },
]

/** Chi prende in carico le pulizie di un appartamento: l'account della sua ditta. */
const CLEANER_BY_COMPANY = { comfy: 'u-pulizie-comfy', angela: 'u-pulizie-angela' } as const

const MATR: BedType = 'Letto Matrimoniale'
const SING: BedType = 'Letto Singolo'
const DIVM: BedType = 'Divano letto Matrimoniale'

/**
 * Gli 8 appartamenti in gestione, divisi fra le due ditte di pulizie.
 * `prices.base` e' la tariffa della pulizia; `perGuest` la sovrascrive solo
 * dove la tariffa cambia col numero di ospiti (per ora solo a 4 pax).
 */
export const apartments: Apartment[] = [
  /* ---- Comfy Host ---- */
  {
    id: 'ap-giuliana', name: '3 minuti Vaticano', address: 'Via della Giuliana 35',
    district: 'Prati', city: 'Roma', ownerId: 'u-admin', companyId: 'comfy',
    visibility: 'official', provider: 'guesty', providerListingId: 'GY-88240',
    beds: [{ id: 'b-giu-1', type: MATR }, { id: 'b-giu-2', type: DIVM }],
    notes: '1) Mettere di nostro:\n   Amenities, cialde (1 a persona).\n   Tutti i refill si trovano nel vostro armadio, codice 0000\n2) Controllare sempre le chiavi nelle rispettive keybox.',
    prices: { base: 50, min: 50, max: 60, perGuest: { 4: 60 } },
    access: {
      entries: [
        { id: 'ac-giu-1', label: 'Accesso', value: 'App Vikey (senza codice)' },
        { id: 'ac-giu-2', label: 'Cassetta in casa', value: '1405' },
        { id: 'ac-giu-3', label: 'Stanza pulizie', value: 'Chiave nella cassetta 1405' },
      ],
    },
    cleaningFrequencyDays: 3, createdAt: iso(day(-320)),
  },
  {
    id: 'ap-trionfale', name: 'Green House in Vaticano', address: 'Via Trionfale 20',
    district: 'Prati', city: 'Roma', ownerId: 'u-admin', companyId: 'comfy',
    visibility: 'official', provider: 'hostaway', providerListingId: 'HA-40952',
    beds: [{ id: 'b-tri-1', type: MATR }],
    notes: '1) Mettere di nostro:\n   - la saponetta + shampoo\n   - carta igienica\n   - the vari e zucchero\n\n   Tutti i refill si trovano nel vostro armadietto, codice lucchetto 140.',
    prices: { base: 40, min: 40, max: 40 },
    access: {
      entries: [
        { id: 'ac-tri-1', label: 'Portone', value: 'App Vikey' },
        { id: 'ac-tri-2', label: 'Cassetta in casa (porta pulizie)', value: '1405' },
      ],
    },
    cleaningFrequencyDays: 3, createdAt: iso(day(-280)),
  },
  {
    id: 'ap-livraghi', name: 'Small Red House', address: 'Via Giovanni Livraghi 2',
    district: 'Trastevere', city: 'Roma', ownerId: 'u-admin', companyId: 'comfy',
    visibility: 'official', provider: 'guesty', providerListingId: 'GY-88213',
    beds: [{ id: 'b-liv-1', type: MATR }, { id: 'b-liv-2', type: DIVM }],
    notes: '- Accesso con chiavi nella keybox a destra del portone.\n- Codice cassetta pulizie: 1405\n- Piano 1, interno 3.',
    prices: { base: 50, min: 50, max: 50 },
    access: {
      entries: [
        { id: 'ac-liv-1', label: 'Portone', value: 'App Vikey' },
        { id: 'ac-liv-2', label: 'Cassetta inferiore (addetti pulizie)', value: '1405' },
        { id: 'ac-liv-3', label: 'Cassetta superiore (ospiti)', value: '2307' },
      ],
      notes: 'Le cassette sono davanti alla porta di casa.',
    },
    cleaningFrequencyDays: 3, createdAt: iso(day(-360)),
  },
  {
    id: 'ap-scala', name: 'Trastevere Butterfly', address: 'Via della Scala 9',
    district: 'Trastevere', city: 'Roma', ownerId: 'u-admin', companyId: 'comfy',
    visibility: 'official', provider: 'guesty', providerListingId: 'GY-88301',
    beds: [{ id: 'b-sca-1', type: MATR }, { id: 'b-sca-2', type: DIVM }],
    notes: '- Accesso con chiavi, si trovano al portone esterno.\n- Codice cassetta superiore 1405 (nostre chiavi - pulizie)\n- Codice cassetta inferiore 2307 (controllare se ci sono chiavi ospiti)\n- Piano 2 Butterfly House',
    prices: { base: 50, min: 50, max: 60, perGuest: { 4: 60 } },
    access: {
      entries: [
        { id: 'ac-sca-1', label: 'Cassetta inferiore (pulizie)', value: '1405' },
        { id: 'ac-sca-2', label: 'Cassetta superiore (ospiti)', value: '2307' },
        { id: 'ac-sca-3', label: 'Armadio pulizie in casa', value: 'Chiave nella cassetta 1405' },
      ],
    },
    cleaningFrequencyDays: 2, createdAt: iso(day(-250)),
  },

  /* ---- Angela ---- */
  {
    id: 'ap-marsi', name: 'KlaFrà', address: 'Via dei Marsi 10',
    district: 'San Giovanni', city: 'Roma', ownerId: 'u-admin', companyId: 'angela',
    visibility: 'official', provider: 'guesty', providerListingId: 'GY-88355',
    beds: [{ id: 'b-mar-1', type: MATR }, { id: 'b-mar-2', type: SING }],
    notes: 'Citofono KlaFrà. Chiavi nella keybox accanto al portone.',
    prices: { base: 55, min: 55, max: 55 },
    access: {
      entries: [
        { id: 'ac-mar-1', label: 'Cancello', value: '12786*1' },
        { id: 'ac-mar-2', label: 'Cassetta superiore (ospiti)', value: '2307' },
        { id: 'ac-mar-3', label: 'Cassetta inferiore (pulizie)', value: '1405' },
      ],
      notes: 'Le cassette sono davanti alla porta.',
    },
    cleaningFrequencyDays: 3, createdAt: iso(day(-340)),
  },
  {
    id: 'ap-consoli', name: 'Consoli', address: 'Piazza dei Consoli 50',
    district: 'Don Bosco', city: 'Roma', ownerId: 'u-admin', companyId: 'angela',
    visibility: 'official', provider: 'hostaway', providerListingId: 'HA-40917',
    beds: [{ id: 'b-con-1', type: MATR }, { id: 'b-con-2', type: SING }, { id: 'b-con-3', type: SING }],
    notes: 'Citofono "Consoli". Ascensore fino al piano 4.\nRifornimenti nel ripostiglio, lucchetto 0000.',
    prices: { base: 75, min: 75, max: 75 },
    access: {
      entries: [
        { id: 'ac-con-1', label: 'Citofono', value: 'Tasto 110 + OK' },
        { id: 'ac-con-2', label: 'Accesso', value: 'App Vikey' },
        { id: 'ac-con-3', label: 'Chiave porta pulizie', value: 'In cassetta 1405' },
      ],
      notes: 'Prima il tasto 110 sul citofono, poi si apre con l’app Vikey.',
    },
    cleaningFrequencyDays: 4, createdAt: iso(day(-350)),
  },
  {
    id: 'ap-labicana', name: 'Stazione Centrale Roma', address: 'Via di Porta Labicana 19',
    district: 'Termini', city: 'Roma', ownerId: 'u-admin', companyId: 'angela',
    visibility: 'official', provider: 'guesty', providerListingId: 'GY-88266',
    beds: [{ id: 'b-lab-1', type: MATR }, { id: 'b-lab-2', type: MATR }, { id: 'b-lab-3', type: SING }],
    notes: '1) Mettere di nostro:\n   Amenities\n   Cialde (1 a persona).\n   Tutti i refill si trovano nel vostro armadio, codice 0000\n\n2) Spegnere i riscaldamenti: nel corridoio, sul termostato premere OFF (IMPORTANTE)\n\n3) Controllare sempre se le chiavi sono nelle rispettive keybox\n   Cassetta ospiti: 2307 - Cassetta pulizie: 1405\n   NON scambiarle per favore.',
    prices: { base: 55, min: 55, max: 55 },
    access: {
      entries: [
        { id: 'ac-lab-1', label: 'Cancello', value: 'ON1357' },
        { id: 'ac-lab-2', label: 'Cassetta superiore (ospiti)', value: '2307' },
        { id: 'ac-lab-3', label: 'Cassetta inferiore (addetti pulizie)', value: '1405' },
        { id: 'ac-lab-4', label: 'Armadi (tutti)', value: '1405' },
      ],
      notes: 'Le cassette sono davanti alla porta di casa.',
    },
    cleaningFrequencyDays: 2, createdAt: iso(day(-300)),
  },
  {
    id: 'ap-appia', name: 'Villa di Prestigio', address: 'Via Appia Pignatelli 198',
    district: 'Appia', city: 'Roma', ownerId: 'u-admin', companyId: 'angela',
    visibility: 'official', provider: 'hostaway', providerListingId: 'HA-41020',
    beds: [
      { id: 'b-app-1', type: MATR }, { id: 'b-app-2', type: MATR },
      { id: 'b-app-3', type: SING }, { id: 'b-app-4', type: SING }, { id: 'b-app-5', type: DIVM },
    ],
    notes: 'Villa indipendente con giardino. Cancello con telecomando nel mobile d’ingresso.\nControllare la piscina solo a vista, la manutenzione è esterna.',
    prices: { base: 140, min: 140, max: 140 },
    access: {
      entries: [
        { id: 'ac-app-1', label: 'Check-in', value: 'Di persona' },
        { id: 'ac-app-2', label: 'Cancello', value: '1018' },
      ],
    },
    cleaningFrequencyDays: 4, createdAt: iso(day(-200)),
  },
]

export const warehouses: Warehouse[] = [
  { id: 'wh-trastevere', name: 'Magazzino Trastevere', address: 'Vicolo del Cinque 12, Roma', code: '1405', notes: 'Armadio grande a sinistra. Lenzuola e amenities.' },
  { id: 'wh-prati', name: 'Magazzino Prati', address: 'Via Candia 88, Roma', code: '0140', notes: 'Armadietto metallico, lucchetto 140.' },
  { id: 'wh-tuscolana', name: 'Magazzino Tuscolana', address: 'Via dei Consoli 50, Roma', code: '0000', notes: 'Ripostiglio al piano -1.' },
]

export const extraCatalog: ExtraCatalogItem[] = [
  { id: 'ex-asc-viso', name: 'Asciugamano Viso', scope: 'person', unitCost: 0.9, warehouseId: 'wh-trastevere' },
  { id: 'ex-asc-bidet', name: 'Asciugamano Bidet', scope: 'person', unitCost: 0.6, warehouseId: 'wh-trastevere' },
  { id: 'ex-asc-corpo', name: 'Asciugamano Corpo', scope: 'person', unitCost: 1.2, warehouseId: 'wh-trastevere' },
  { id: 'ex-cialde', name: 'Cialde caffè', scope: 'person', unitCost: 0.35, warehouseId: 'wh-prati' },

  { id: 'ex-lenz-matr', name: 'Lenzuola matrimoniali', scope: 'bed', bedTypes: ['Letto Matrimoniale', 'Divano letto Matrimoniale'], unitCost: 2.4, warehouseId: 'wh-trastevere' },
  { id: 'ex-lenz-sing', name: 'Lenzuola singole', scope: 'bed', bedTypes: ['Letto Singolo', 'Divano letto Singolo'], unitCost: 1.8, warehouseId: 'wh-trastevere' },
  { id: 'ex-federe', name: 'Federe', scope: 'bed', bedTypes: ['Letto Matrimoniale', 'Divano letto Matrimoniale', 'Letto Singolo'], unitCost: 0.7, warehouseId: 'wh-trastevere' },
  { id: 'ex-shampoo', name: 'Doccia/Shampoo Sydey', scope: 'bed', bedTypes: ['Letto Matrimoniale', 'Divano letto Matrimoniale', 'Letto Singolo'], unitCost: 0.5, warehouseId: 'wh-prati' },
  { id: 'ex-saponetta', name: 'Saponetta Arisma', scope: 'bed', bedTypes: ['Letto Matrimoniale', 'Divano letto Matrimoniale', 'Letto Singolo'], unitCost: 0.4, warehouseId: 'wh-prati' },

  { id: 'ex-carta', name: 'Carta igienica', scope: 'apartment', unitCost: 0.55, warehouseId: 'wh-prati' },
  { id: 'ex-detersivi', name: 'Kit detersivi', scope: 'apartment', unitCost: 3.2, warehouseId: 'wh-tuscolana' },
  { id: 'ex-sacchi', name: 'Sacchi immondizia', scope: 'apartment', unitCost: 0.25, warehouseId: 'wh-tuscolana' },
]

export const taskCatalog: TaskCatalogItem[] = [
  { id: 'tk-bagno', name: 'Pulizia bagno completa', description: 'Sanitari, doccia, specchi, pavimento. Attenzione a calcare e muffa nella doccia.', estimateMin: 25 },
  { id: 'tk-cucina', name: 'Pulizia cucina', description: 'Piano cottura, lavello, frigo, elettrodomestici, svuotamento rifiuti.', estimateMin: 30 },
  { id: 'tk-letti', name: 'Rifacimento letti', description: 'Cambio lenzuola e federe secondo le tipologie indicate nella richiesta.', estimateMin: 15 },
  { id: 'tk-pavimenti', name: 'Pavimenti e superfici', description: 'Aspirazione e lavaggio. Pulire anche sotto i letti.', estimateMin: 25 },
  { id: 'tk-amenities', name: 'Rifornimento amenities', description: 'Saponette, shampoo, carta igienica, cialde (1 a persona).', estimateMin: 10 },
  { id: 'tk-keybox', name: 'Verifica keybox e chiavi', description: 'Controllare che le chiavi siano nelle rispettive keybox. NON scambiare quelle ospiti con quelle pulizie.', estimateMin: 5 },
  { id: 'tk-impianti', name: 'Controllo impianti', description: 'Spegnere riscaldamento/climatizzazione, verificare luci e serrande.', estimateMin: 8 },
  { id: 'tk-foto', name: 'Foto di fine intervento', description: 'Scatti di ogni ambiente a lavoro completato.', estimateMin: 6 },
]

export const workSheets: WorkSheet[] = [
  { id: 'ws-standard', name: 'Pulizia Standard', description: 'Turnover ordinario fra due soggiorni.', taskIds: ['tk-bagno', 'tk-cucina', 'tk-letti', 'tk-pavimenti', 'tk-amenities', 'tk-keybox'] },
  { id: 'ws-rapida', name: 'Pulizia Rapida', description: 'Check-in ravvicinato, intervento essenziale.', taskIds: ['tk-bagno', 'tk-letti', 'tk-amenities'] },
  { id: 'ws-profonda', name: 'Pulizia Profonda', description: 'Intervento mensile con controllo impianti e documentazione fotografica.', taskIds: ['tk-bagno', 'tk-cucina', 'tk-letti', 'tk-pavimenti', 'tk-amenities', 'tk-keybox', 'tk-impianti', 'tk-foto'] },
]

/* ---- generazione richieste ---- */

const BED_EXTRAS: Record<string, { name: string; qty: number }[]> = {
  'Letto Matrimoniale': [
    { name: 'Lenzuola matrimoniali', qty: 2 }, { name: 'Federe', qty: 2 },
    { name: 'Doccia/Shampoo Sydey', qty: 4 }, { name: 'Saponetta Arisma', qty: 1 },
  ],
  'Divano letto Matrimoniale': [
    { name: 'Lenzuola matrimoniali', qty: 2 }, { name: 'Federe', qty: 2 },
    { name: 'Doccia/Shampoo Sydey', qty: 4 }, { name: 'Saponetta Arisma', qty: 1 },
  ],
  'Letto Singolo': [
    { name: 'Lenzuola singole', qty: 1 }, { name: 'Federe', qty: 1 },
    { name: 'Doccia/Shampoo Sydey', qty: 2 }, { name: 'Saponetta Arisma', qty: 1 },
  ],
}

const REQUEST_NOTES = [
  '1) Controllare sempre che ci siano le chiavi dentro le keybox e NON scambiarle con quelle delle pulizie (vostre)\n\n2) Attenzione al soffione della doccia e alla muffa nella doccia.\n\n3) Pulire bene anche sotto i letti\n\nCodice cassetta pulizie: 1405\nCodice cassetta ospiti: 2307',
  '1) Mettere di nostro:\n   - la saponetta + shampoo\n   - carta igienica\n   - the vari e zucchero\n\nTutti i refill si trovano nel vostro armadietto, codice lucchetto 140',
  '1) Mettere di nostro:\n   Amenities\n   Cialde (1 a persona).\n\nTutti i refill si trovano nel vostro armadio, codice 0000\n\n2) Spegnere i riscaldamenti, nel corridoio sul termostato premere OFF (IMPORTANTE)',
  'Portare nuovo mocio. Penale 30 euro giorno di intervento saltato.',
  '',
]

function bedsFor(ap: Apartment, count: number): RequestBed[] {
  return ap.beds.slice(0, Math.max(1, Math.min(count, ap.beds.length))).map((b) => ({
    bedId: b.id, type: b.type, extras: BED_EXTRAS[b.type] ?? [],
  }))
}

/** Un turno preso in carico va all'account della ditta che segue quella casa. */
function pickAssignee(status: RequestStatus, ap: Apartment): string | undefined {
  return status === 'in_attesa' ? undefined : CLEANER_BY_COMPANY[ap.companyId]
}

function buildRequests(): CleaningRequest[] {
  const out: CleaningRequest[] = []
  /*
   * Da 120 giorni fa a 25 avanti: lo storico profondo serve alla dashboard, che
   * confronta il periodo selezionato con quello precedente. Con una finestra
   * corta ogni confronto risulterebbe "da zero".
   */
  for (let offset = -120; offset <= 25; offset++) {
    const count = offset < -30 ? int(0, 2) : offset < 0 ? int(0, 2) : int(0, 3)
    for (let k = 0; k < count; k++) {
      const ap = pick(apartments)
      const guests = int(1, Math.max(2, ap.beds.length * 2))
      const bedsToDo = int(1, ap.beds.length)
      const checkOut = day(offset, 10, 0)
      const checkIn = day(offset, 15, 0)
      const created = new Date(checkOut)
      created.setDate(created.getDate() - int(3, 14))
      created.setHours(int(9, 18), int(0, 59), 0, 0)

      let status: RequestStatus
      if (offset < -1) status = rnd() < 0.9 ? 'completata' : 'cancellata'
      else if (offset <= 0) status = pick(['in_corso', 'da_verificare', 'completata'] as const)
      else if (offset <= 3) status = pick(['accettata', 'accettata', 'in_attesa'] as const)
      else status = rnd() < 0.15 ? 'accettata' : 'in_attesa'

      /* Intorno a oggi la prima pulizia del giorno e' gia' presa in carico:
         l'account pulizie deve sempre trovare qualcosa da completare. */
      if (offset >= -3 && offset <= 3 && k === 0 && status === 'in_attesa') status = 'accettata'

      out.push({
        id: `req-${offset + 40}-${k}`,
        apartmentId: ap.id,
        hostId: ap.ownerId,
        status,
        createdAt: iso(created),
        checkOutAt: iso(checkOut),
        checkInAt: iso(checkIn),
        checkOutPeople: int(1, guests),
        checkInPeople: guests,
        beds: bedsFor(ap, bedsToDo),
        perPersonExtras: [
          { name: 'Asciugamano Viso', qty: guests },
          { name: 'Asciugamano Bidet', qty: guests },
          { name: 'Asciugamano Corpo', qty: guests },
        ],
        apartmentExtras: [
          { name: 'Carta igienica', qty: 2 },
          { name: 'Sacchi immondizia', qty: 3 },
        ],
        notes: pick(REQUEST_NOTES),
        workSheetId: rnd() < 0.75 ? 'ws-standard' : pick(['ws-rapida', 'ws-profonda'] as const),
        assigneeId: pickAssignee(status, ap),
      })
    }
  }
  return out.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
}

export const requests: CleaningRequest[] = buildRequests()

export const notifications: AppNotification[] = [
  { id: 'n-1', kind: 'cleaningCreated', title: 'Nuova richiesta di pulizia', body: 'Via della Scala 9 · check-out 03-09-2026 10:00', createdAt: iso(day(0, 8, 12)), read: false, requestId: requests[0]?.id },
  { id: 'n-2', kind: 'cleaningChanged', title: 'Richiesta aggiornata', body: 'Via Trionfale 20 · ospiti in arrivo passati da 2 a 3', createdAt: iso(day(-1, 17, 40)), read: false, requestId: requests[1]?.id },
  { id: 'n-3', kind: 'cleaningCancelled', title: 'Richiesta cancellata da Guesty', body: 'Piazza dei Consoli, 51 · prenotazione annullata dall’ospite', createdAt: iso(day(-2, 11, 5)), read: true },
  { id: 'n-4', kind: 'system', title: 'Scorte in esaurimento', body: 'Magazzino Prati: lenzuola matrimoniali sotto la soglia minima', createdAt: iso(day(-3, 9, 30)), read: true },
]

/* ------------------------------------------------- controlli interni ---- */

/** Verifiche ricorrenti: la lista da cui si pesca per popolare un controllo. */
const INSPECTION_TASKS = [
  'Controllare che non ci siano formiche',
  'Verificare che il bagno sia asciutto e senza aloni',
  'Controllare le scorte di carta igienica',
  'Verificare la chiusura di finestre e persiane',
  'Controllare che il frigo sia vuoto e pulito',
  'Provare il condizionatore e il telecomando',
  'Verificare che i letti siano rifatti a regola d\'arte',
  'Controllare la keybox e il numero di chiavi',
  'Verificare che non ci siano oggetti dimenticati',
  'Controllare che lo scarico della doccia non sia ostruito',
]

const dayKeyOf = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`

/** Giorno + ora del controllo, a partire dallo scarto in giorni da TODAY. */
const inspectionTasks = (names: string[], doneCount: number, at: Date): InspectionTask[] =>
  names.map((name, i) => ({
    id: `it-${dayKeyOf(at)}-${i}`,
    name,
    done: i < doneCount,
    doneAt: i < doneCount ? iso(at) : undefined,
  }))

/**
 * Un controllo per riga: giorno rispetto a oggi, appartamento, chi controlla,
 * quante verifiche e quante gia' spuntate. Le quattro persone della squadra
 * compaiono tutte, e su oggi ce ne sono tre - una chiusa - per vedere subito
 * il cuore accanto ai pallini.
 */
const INSPECTION_PLAN: [offset: number, hour: number, apartmentId: string, inspectorId: InspectorId, taskCount: number, doneCount: number][] = [
  [-13, 10, 'ap-livraghi', 'manuel', 4, 4],
  [-11, 15, 'ap-consoli', 'mark', 3, 3],
  [-9, 11, 'ap-giuliana', 'michelle', 4, 2],
  [-7, 16, 'ap-labicana', 'gianluca', 3, 3],
  [-5, 9, 'ap-marsi', 'mark', 3, 1],
  [-3, 14, 'ap-scala', 'michelle', 4, 4],
  [-1, 10, 'ap-appia', 'gianluca', 3, 0],
  /* oggi */
  [0, 9, 'ap-labicana', 'manuel', 4, 4],
  [0, 12, 'ap-giuliana', 'mark', 3, 1],
  [0, 16, 'ap-trionfale', 'michelle', 3, 0],
  [2, 10, 'ap-scala', 'gianluca', 4, 0],
  [4, 15, 'ap-consoli', 'manuel', 3, 0],
  [7, 11, 'ap-marsi', 'michelle', 4, 0],
  [10, 10, 'ap-livraghi', 'mark', 3, 0],
  [13, 16, 'ap-appia', 'gianluca', 4, 0],
]

export const inspections: Inspection[] = INSPECTION_PLAN.map(
  ([offset, hour, apartmentId, inspectorId, taskCount, doneCount], i) => {
    const at = day(offset, hour)
    const names = INSPECTION_TASKS.slice(i % 4, (i % 4) + taskCount)
    return {
      id: `insp-${i}`,
      apartmentId,
      inspectorId,
      scheduledAt: iso(at),
      tasks: inspectionTasks(names, doneCount, at),
      createdAt: iso(day(offset - 7, 9)),
    }
  },
)

/* ------------------------------------------------ interventi sul posto ---- */

/**
 * Problemi risolti in casa nel mese corrente. I costi non sono stati ancora
 * comunicati, quindi restano vuoti: il report li segnala come da valorizzare
 * invece di inventare una cifra. L'unico noto e' quello coperto da Aircover,
 * che e' zero.
 */
const INTERVENTION_PLAN: [apartmentId: string, dayOffset: number, title: string, cost: number | undefined, coveredBy: string | undefined][] = [
  ['ap-marsi', -12, 'Sistemato allagamento lavatrice', undefined, undefined],
  ['ap-marsi', -10, 'Sistemato tubo del lavandino', undefined, undefined],
  ['ap-marsi', -8, 'Sistemato frigo in blocco', undefined, undefined],
  ['ap-marsi', -5, 'Intervento per internet non funzionante', undefined, undefined],
  ['ap-marsi', -2, 'Risolto problema di accesso degli ospiti', undefined, undefined],

  ['ap-labicana', -11, 'Intervento per formiche', undefined, undefined],
  ['ap-labicana', -9, 'Intervento per doccia rotta', undefined, undefined],
  ['ap-labicana', -6, 'Sostituzione bicchieri rotti', 0, 'Aircover'],
  ['ap-labicana', -3, 'Sistemato accesso ospiti: tastierino non funzionante', undefined, undefined],
]

export const interventions: Intervention[] = INTERVENTION_PLAN.map(
  ([apartmentId, dayOffset, title, cost, coveredBy], i) => ({
    id: `int-${i}`,
    apartmentId,
    at: iso(day(dayOffset, 11)),
    title,
    cost,
    coveredBy,
    createdAt: iso(day(dayOffset, 18)),
    createdById: 'u-admin',
  }),
)
