import type {
  Apartment, AppNotification, CleaningCompanyId, CleaningRequest, ExtraCatalogItem, RequestStatus,
  TaskCatalogItem, User, Warehouse, WorkSheet, BedType, RequestBed,
  AdminExpense, Inspection, InspectionKind, InspectionTask, InspectorId, Intervention,
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
  { id: 'u-admin', name: 'ProProManager', email: 'm2ab.srl@gmail.com', phone: '+39 340 118 2277', role: 'admin', password: 'propromanager', active: true, createdAt: iso(day(-420)) },
  /* Le ditte accedono col nome utente, non con l'email: e' quello che sanno a
     memoria. L'email resta valida e serve a raggiungerle.
     L'account Comfy e' stato revocato: le sue case restano, ma nessuno entra
     piu' con quel nome (vedi ACCESSI_REVOCATI nel Worker). */
  { id: 'u-pulizie-angela', name: 'Angela', username: 'Angela', email: 'angela@propromanager.it', phone: '+39 348 551 9042', role: 'operator', companyId: 'angela', password: 'SHyA9onz$uM@i5cL', active: true, createdAt: iso(day(-255)) },
]

/** Chi prende in carico le pulizie di un appartamento: l'account della sua ditta. */
/*
 * Accessi revocati. Non basta toglierli dall'elenco qui sopra: chi li aveva
 * gia' sul dispositivo se li terrebbe, perche' un utente fuori dal seme viene
 * trattato come aggiunto a mano e quindi conservato. Vanno nominati.
 * Sparisce l'accesso, non il suo lavoro: case, pulizie e task restano.
 */
export const ACCESSI_REVOCATI = ['u-pulizie-comfy']

const CLEANER_BY_COMPANY: Partial<Record<CleaningCompanyId, string>> = { angela: 'u-pulizie-angela' }

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
    /* Quattro posti: due nel matrimoniale e uno per ciascun singolo. */
    beds: [{ id: 'b-lab-1', type: MATR }, { id: 'b-lab-2', type: SING }, { id: 'b-lab-3', type: SING }],
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
    /* Otto posti: quattro matrimoniali, due persone per letto. */
    beds: [
      { id: 'b-app-1', type: MATR }, { id: 'b-app-2', type: MATR },
      { id: 'b-app-3', type: MATR }, { id: 'b-app-4', type: MATR },
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

/*
 * Il calendario pulizie e' quello vero, non piu' generato a caso: per ogni casa
 * i giorni in cui si interviene, dettati uno per uno. Le case che non compaiono
 * qui non hanno pulizie, e non ce ne sono nei mesi prima o dopo.
 *
 * I giorni sono ancorati al mese corrente e non a settembre 2026: aprendo
 * l'app in un altro mese il calendario resta pieno invece di mostrarsi vuoto.
 */
const CLEANING_PLAN: Record<string, number[]> = {
  'ap-marsi': [6, 10, 13, 16, 18, 22, 24, 28],
  'ap-consoli': [2, 11, 14, 21, 29],
  'ap-labicana': [5, 8, 12, 14, 15, 17, 18, 20, 21, 22, 23, 25, 27, 30],
  'ap-appia': [3, 6, 11, 14, 18, 21, 27],
}

function buildRequests(): CleaningRequest[] {
  const out: CleaningRequest[] = []

  for (const [apartmentId, giorni] of Object.entries(CLEANING_PLAN)) {
    const ap = apartments.find((a) => a.id === apartmentId)
    if (!ap) continue

    for (const giorno of giorni) {
      const checkOut = new Date(TODAY.getFullYear(), TODAY.getMonth(), giorno, 10, 0, 0, 0)
      const checkIn = new Date(TODAY.getFullYear(), TODAY.getMonth(), giorno, 15, 0, 0, 0)
      const created = new Date(checkOut)
      created.setDate(created.getDate() - int(4, 12))
      created.setHours(int(9, 18), int(0, 59), 0, 0)

      /* Tutte in attesa: accettarle o rifiutarle spetta alla ditta, non al
         calendario che le propone. */
      const status: RequestStatus = 'in_attesa'

      const guests = int(1, Math.max(2, ap.beds.length * 2))
      out.push({
        id: `req-${apartmentId}-${giorno}`,
        apartmentId: ap.id,
        hostId: ap.ownerId,
        status,
        createdAt: iso(created),
        checkOutAt: iso(checkOut),
        checkInAt: iso(checkIn),
        checkOutPeople: int(1, guests),
        checkInPeople: guests,
        beds: bedsFor(ap, int(1, ap.beds.length)),
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
        workSheetId: 'ws-standard',
        assigneeId: pickAssignee(status, ap),
      })
    }
  }

  return out.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
}

export const requests: CleaningRequest[] = buildRequests()

/*
 * Nessuna notifica salvata: si deducono dallo stato delle richieste e del
 * calendario (vedi lib/notifications.ts). Resta l'elenco vuoto perche' lo
 * store continua a esporre il campo.
 */
export const notifications: AppNotification[] = []

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
const inspectionTasks = (names: string[], doneCount: number, at: Date, createdAt?: string): InspectionTask[] =>
  names.map((name, i) => ({
    id: `it-${dayKeyOf(at)}-${i}`,
    name,
    done: i < doneCount,
    doneAt: i < doneCount ? iso(at) : undefined,
    createdAt,
  }))

/*
 * I controlli sul posto, quelli veri: giorno del mese, casa e chi li ha fatti.
 * Non c'e' piu' niente di generato a caso - in calendario restano solo questi e
 * le scadenze fisse della squadra.
 */
/**
 * Il calendario del team, riga per riga, com'e' davvero: controlli sul posto,
 * task operative e voci di gestione interna. Non e' piu' un esempio - e'
 * l'elenco che il responsabile tiene aggiornato, e da qui arriva a ogni
 * dispositivo che apre l'app.
 */
interface VoceSeed {
  /** Giorno del mese corrente. */
  day: number
  hour: number
  kind: InspectionKind
  /** Obbligatorio sui controlli, facoltativo sulle task, assente sulla gestione. */
  apartmentId?: string
  inspectorId: InspectorId
  /** Sui controlli vale il nome della casa; altrove e' il titolo della voce. */
  title?: string
  tasks?: string[]
  /** Quante verifiche sono gia' spuntate, dall'alto. */
  doneCount?: number
  notes?: string
}

const VOCI_PLAN: VoceSeed[] = [
  /* ---- lunedi' 13: il giro di apertura settimana, gia' chiuso ---- */
  { day: 13, hour: 10, kind: 'controllo', apartmentId: 'ap-giuliana', inspectorId: 'manuel', doneCount: 3 },
  { day: 13, hour: 12, kind: 'controllo', apartmentId: 'ap-scala', inspectorId: 'manuel', doneCount: 3 },
  { day: 13, hour: 16, kind: 'controllo', apartmentId: 'ap-livraghi', inspectorId: 'manuel', doneCount: 3 },

  /* ---- martedi' 15: tre controlli, tutti chiusi ---- */
  {
    day: 15, hour: 9, kind: 'controllo', apartmentId: 'ap-labicana', inspectorId: 'mark',
    tasks: [
      'Verificare la chiusura di finestre e persiane',
      'Controllare che il frigo sia vuoto e pulito',
      'Provare il condizionatore e il telecomando',
    ],
    doneCount: 3,
  },
  {
    day: 15, hour: 12, kind: 'controllo', apartmentId: 'ap-consoli', inspectorId: 'mark',
    tasks: [
      'Controllare che non ci siano formiche',
      'Verificare che il bagno sia asciutto e senza aloni',
      'Controllare le scorte di carta igienica',
    ],
    doneCount: 3,
  },
  {
    day: 15, hour: 16, kind: 'controllo', apartmentId: 'ap-trionfale', inspectorId: 'manuel',
    tasks: ['Metti Cosino Verde', 'Verifica tutto sia perfetto rispetto video di Michelle'],
    doneCount: 2,
  },

  /* ---- mercoledi' 16 ---- */
  {
    day: 16, hour: 9, kind: 'gestione_interna', inspectorId: 'gianluca',
    title: 'Chiamare per acquisizione Conca D’oro',
  },
  {
    day: 16, hour: 9, kind: 'task_operativa', apartmentId: 'ap-consoli', inspectorId: 'manuel',
    title: 'Lampadina e mensola per Consoli',
    tasks: [
      'Organizzarsi su quando portare lampadina e mensola a Consoli',
      'Segnare la consegna in task calendario',
    ],
  },
  {
    day: 16, hour: 10, kind: 'controllo', apartmentId: 'ap-marsi', inspectorId: 'manuel',
    tasks: [
      'Verificare situazione lavandini e sistemare',
      'Cambiare password internet',
      'Check stato casa pulizie',
    ],
  },
  { day: 16, hour: 10, kind: 'gestione_interna', inspectorId: 'michelle', title: 'Conteggi Società' },
  {
    day: 16, hour: 12, kind: 'gestione_interna', inspectorId: 'michelle',
    title: 'Mandare Dashboard a Commercialista',
  },

  /* ---- giovedi' 17 ---- */
  {
    day: 17, hour: 9, kind: 'task_operativa', apartmentId: 'ap-marsi', inspectorId: 'mark',
    title: 'Ricordati di farti lasciare per domani avvitatore e punte mattonelle da Manuel',
    notes: 'Domani c’è da montare la maniglia doccia (la maniglia sta al tabacchi di Via della Giuliana vedi se vuoi prenderla oggi insieme alle punte da Manuel)',
  },
  {
    day: 17, hour: 9, kind: 'task_operativa', inspectorId: 'michelle',
    title: 'Consegne alla squadra',
    tasks: [
      'Portare la carta aziendale a Mark',
      'Portare a Manuel la carta da parati rossa per Via Giovanni Livraghi',
      'Portare a Manuel il dispenser per Mark',
    ],
  },
  {
    day: 17, hour: 10, kind: 'task_operativa', inspectorId: 'gianluca',
    title: 'Appuntamento attivazione KrossBooking',
  },
  {
    day: 17, hour: 10, kind: 'controllo', apartmentId: 'ap-livraghi', inspectorId: 'manuel',
    tasks: [
      'Mettere adesivo rosso dentro i cassetti rovinati',
      'Prendere al tabacchi cuscino rosso e copertina rossa e portarli a Livraghi',
      'Riportare a Mark il trapano e le punte: il 18 monta la maniglia a Via dei Marsi 10',
    ],
  },
  { day: 17, hour: 16, kind: 'controllo', apartmentId: 'ap-giuliana', inspectorId: 'gianluca', tasks: [] },

  /* ---- venerdi' 18 ---- */
  {
    day: 18, hour: 11, kind: 'task_operativa', inspectorId: 'mark',
    title: 'Passare Tabacchi Via della Giuliana',
    tasks: ['Prendere la coperta rosa', 'Prendere la maniglia nera'],
  },
  {
    day: 18, hour: 12, kind: 'controllo', apartmentId: 'ap-marsi', inspectorId: 'mark',
    tasks: [
      'Montare la maniglia',
      'Verificare eventuali perdite siano ok',
      'Cambiare password internet',
      'Controllo stato pulizia',
    ],
  },
  {
    day: 18, hour: 15, kind: 'controllo', apartmentId: 'ap-labicana', inspectorId: 'mark',
    tasks: [
      'Mettere la coperta rosa della Giuliana sul letto matrimoniale',
      'Prendere i bicchieri rosa da Manuel e portarli in casa',
      'Controllo stato pulizia',
    ],
  },
  {
    day: 18, hour: 17, kind: 'task_operativa', inspectorId: 'michelle',
    title: 'Avviamento Burocratico Trastevere',
  },

  /* ---- domenica 20 ---- */
  { day: 20, hour: 11, kind: 'controllo', apartmentId: 'ap-trionfale', inspectorId: 'mark', doneCount: 0 },
]

const plannedInspections: Inspection[] = VOCI_PLAN.map((row, i) => {
  const at = new Date(TODAY.getFullYear(), TODAY.getMonth(), row.day, row.hour, 0, 0, 0)
  /* Un controllo senza elenco proprio prende le verifiche di routine; le task
     e la gestione interna, se non hanno verifiche, restano senza: sono voci
     che dicono cosa fare gia' nel titolo. */
  const names = row.tasks ?? (row.kind === 'controllo' ? INSPECTION_TASKS.slice(i % 4, (i % 4) + 3) : [])
  const createdAt = new Date(at)
  createdAt.setDate(createdAt.getDate() - 5)
  createdAt.setHours(9, 0, 0, 0)
  return {
    id: `insp-${row.kind === 'controllo' ? row.apartmentId : `${row.kind}-${row.inspectorId}`}-${row.day}-${row.hour}`,
    kind: row.kind,
    apartmentId: row.kind === 'gestione_interna' ? undefined : row.apartmentId,
    title: row.title,
    inspectorId: row.inspectorId,
    scheduledAt: iso(at),
    tasks: inspectionTasks(names, row.doneCount ?? 0, at, iso(createdAt)),
    notes: row.notes,
    createdAt: iso(createdAt),
  }
})

/* ------------------------------------------- scadenze fisse del mese ---- */

/**
 * Le scadenze che tornano ogni mese: compilare le spese, i bonifici, l'F24, i
 * pagamenti alla ditta, le chiusure contabili. Non si inseriscono a mano - si
 * generano dal calendario, con un identificativo costruito sul mese, cosi' che
 * rigenerarle non crei doppioni e spuntarle resti valido.
 */
interface RecurringRule {
  /** Entra nell'id: cambiarlo scollega le voci gia' spuntate. */
  slug: string
  inspectorId: InspectorId
  title: string
  tasks: string[]
  hour: number
  /** Il giorno del mese su cui cade la scadenza. */
  when: (month: Date) => Date
}

const dayOfMonth = (month: Date, n: number) =>
  new Date(month.getFullYear(), month.getMonth(), n)

const lastDayOfMonth = (month: Date) =>
  new Date(month.getFullYear(), month.getMonth() + 1, 0)

/** L'ultimo venerdi' del mese: si parte dall'ultimo giorno e si torna indietro. */
const lastFriday = (month: Date) => {
  const d = lastDayOfMonth(month)
  while (d.getDay() !== 5) d.setDate(d.getDate() - 1)
  return d
}

export const RECURRING_RULES: RecurringRule[] = [
  {
    slug: 'spese-amministrative',
    inspectorId: 'manuel',
    title: 'Compila Spese Amministrative',
    tasks: ['Raccogli scontrini e fatture del mese', 'Classifica Aircover o Spese Extra'],
    hour: 17,
    when: lastDayOfMonth,
  },
  {
    slug: 'amministrazione-proprietari',
    inspectorId: 'michelle',
    title: 'Amministrazione Proprietari',
    tasks: ['Creazione Dashboard', 'Contabilità', 'Bilanci mese'],
    hour: 10,
    when: lastFriday,
  },
  {
    slug: 'bonifici',
    inspectorId: 'michelle',
    title: 'Bonifici mensili',
    tasks: ['Prepara la distinta', 'Invia i bonifici'],
    hour: 10,
    when: (m) => dayOfMonth(m, 3),
  },
  {
    slug: 'comfy-6',
    inspectorId: 'michelle',
    title: 'Pagamento Comfy Host',
    tasks: ['Controlla il conteggio dei compensi', 'Esegui il pagamento'],
    hour: 10,
    when: (m) => dayOfMonth(m, 6),
  },
  {
    slug: 'f24',
    inspectorId: 'michelle',
    title: 'Pagamento F24',
    tasks: ['Verifica gli importi', 'Esegui il pagamento'],
    hour: 10,
    when: (m) => dayOfMonth(m, 15),
  },
  {
    slug: 'comfy-16',
    inspectorId: 'michelle',
    title: 'Pagamento Comfy Host',
    tasks: ['Controlla il conteggio dei compensi', 'Esegui il pagamento'],
    hour: 10,
    when: (m) => dayOfMonth(m, 16),
  },
]

const monthKey = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`

/**
 * Scadenze spostate a mano dal responsabile in un mese preciso: il calendario
 * del team e' quello vero, non quello teorico della regola. La chiave e' lo
 * stesso identificativo della voce, cosi' lo spostamento vale per quel mese e
 * non si ripete su tutti gli altri.
 */
const SPOSTAMENTI: Record<string, { day: number; hour: number; tasks?: string[] }> = {
  'ric-f24-202609': {
    day: 16, hour: 10,
    tasks: ['Verifica gli importi', 'Esegui il pagamento', 'Pagamento Cedolare Secca'],
  },
  'ric-comfy-16-202609': { day: 18, hour: 10 },
}

/**
 * Le voci ricorrenti da `back` mesi indietro a `ahead` mesi avanti rispetto al
 * giorno indicato. L'id nasce da slug e mese: ricalcolarle ridà le stesse.
 */
export function recurringInspections(from: Date, back = 3, ahead = 12): Inspection[] {
  const out: Inspection[] = []
  for (let k = -back; k <= ahead; k += 1) {
    const month = new Date(from.getFullYear(), from.getMonth() + k, 1)
    for (const rule of RECURRING_RULES) {
      const id = `ric-${rule.slug}-${monthKey(month)}`
      const spostata = SPOSTAMENTI[id]
      const at = spostata
        ? new Date(month.getFullYear(), month.getMonth(), spostata.day)
        : rule.when(month)
      at.setHours(spostata?.hour ?? rule.hour, 0, 0, 0)
      const createdAt = new Date(month)
      createdAt.setHours(9, 0, 0, 0)
      out.push({
        id,
        kind: 'task_operativa',
        title: rule.title,
        inspectorId: rule.inspectorId,
        scheduledAt: iso(at),
        recurring: true,
        tasks: (spostata?.tasks ?? rule.tasks).map((name, i) => ({
          id: `${id}-t${i}`,
          name,
          done: false,
          createdAt: iso(createdAt),
        })),
        createdAt: iso(createdAt),
      })
    }
  }
  return out
}

export const inspections: Inspection[] = [
  ...plannedInspections,
  ...recurringInspections(TODAY),
]

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

/* -------------------------------------------- spese amministrative ---- */

/**
 * Spese anticipate dall'amministrazione nel mese corrente. Quelle coperte da
 * Aircover restano a noi e non arrivano al proprietario; le altre entrano nei
 * costi extra del foglio di fine mese di quella casa.
 */
const EXPENSE_PLAN: [
  apartmentId: string, dayOffset: number, title: string, amount: number,
  place: string, classification: 'aircover' | 'extra',
][] = [
  ['ap-marsi', -12, 'Tubo flessibile lavatrice', 18.9, 'Amazon', 'extra'],
  ['ap-marsi', -8, 'Termostato frigorifero', 34.5, 'Amazon', 'extra'],
  ['ap-labicana', -11, 'Trattamento antiformiche', 22, 'Negozio fisico', 'extra'],
  ['ap-labicana', -6, 'Set di bicchieri sostitutivi', 26.4, 'Amazon', 'aircover'],
  ['ap-labicana', -3, 'Tastierino serratura di ricambio', 59, 'Amazon', 'extra'],
  ['ap-appia', -5, 'Tende soggiorno', 78.5, 'Negozio fisico', 'extra'],
  ['ap-trionfale', -4, 'Materasso matrimoniale', 199, 'Amazon', 'extra'],
  ['ap-scala', -7, 'Piumone danneggiato dagli ospiti', 45, 'Amazon', 'aircover'],
  ['ap-livraghi', -2, 'Amenities e cialde caffè', 31.2, 'Amazon', 'extra'],
]

export const adminExpenses: AdminExpense[] = EXPENSE_PLAN.map(
  ([apartmentId, dayOffset, title, amount, place, classification], i) => ({
    id: `spe-${i}`,
    apartmentId,
    at: iso(day(dayOffset, 12)),
    title,
    amount,
    place,
    classification,
    createdAt: iso(day(dayOffset, 19)),
    createdById: 'u-admin',
  }),
)

/* ------------------------------------------- identificativi dei dati ---- */

/**
 * Tutto quello che nasce da questo file. Serve all'allineamento di avvio: cio'
 * che una volta veniva da qui e adesso non c'e' piu' va tolto, altrimenti sul
 * dispositivo di chi aveva gia' aperto l'app resterebbe accanto ai dati nuovi -
 * due calendari sovrapposti, uno vecchio e uno buono.
 */
export const SEED_IDS: string[] = [
  ...users.map((u) => u.id),
  ...apartments.map((a) => a.id),
  ...requests.map((r) => r.id),
  ...inspections.map((i) => i.id),
  ...interventions.map((i) => i.id),
  ...adminExpenses.map((e) => e.id),
  ...taskCatalog.map((t) => t.id),
  ...workSheets.map((w) => w.id),
  ...extraCatalog.map((e) => e.id),
  ...warehouses.map((w) => w.id),
]
