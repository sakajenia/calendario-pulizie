import type {
  Apartment, AppNotification, CleaningRequest, ExtraCatalogItem, RequestStatus,
  TaskCatalogItem, User, Warehouse, WorkSheet, BedType, RequestBed,
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

/** Riferimento temporale dell'app: la recon è stata fatta il 31-08-2026. */
export const TODAY = new Date(2026, 7, 31, 9, 0, 0)

const iso = (d: Date) => d.toISOString()
const day = (offset: number, h = 10, m = 0) => {
  const d = new Date(TODAY)
  d.setDate(d.getDate() + offset)
  d.setHours(h, m, 0, 0)
  return d
}

export const users: User[] = [
  { id: 'u-admin', name: 'Gianluca Biondi', email: 'aurea.consulting.marketing@gmail.com', phone: '+39 340 118 2277', role: 'admin', active: true, createdAt: iso(day(-420)) },
  { id: 'u-host-1', name: 'ProProManager Roma Centro', email: 'centro@propromanager.com', phone: '+39 06 4522 1180', role: 'host', active: true, createdAt: iso(day(-380)) },
  { id: 'u-host-2', name: 'ProProManager Prati', email: 'prati@propromanager.com', phone: '+39 06 3751 9040', role: 'host', active: true, createdAt: iso(day(-330)) },
  { id: 'u-op-1', name: 'Elena Marchetti', email: 'elena.marchetti@pulizie.it', phone: '+39 349 772 1188', role: 'operator', active: true, refHostId: 'u-host-1', createdAt: iso(day(-260)) },
  { id: 'u-op-2', name: 'Andrei Popescu', email: 'andrei.popescu@pulizie.it', phone: '+39 351 220 9034', role: 'operator', active: true, refHostId: 'u-host-1', createdAt: iso(day(-210)) },
  { id: 'u-op-3', name: 'Sara Conti', email: 'sara.conti@pulizie.it', phone: '+39 333 615 4471', role: 'operator', active: true, refHostId: 'u-host-2', createdAt: iso(day(-140)) },
  { id: 'u-op-4', name: 'Miriam Okafor', email: 'miriam.okafor@pulizie.it', phone: '+39 327 884 0192', role: 'operator', active: false, refHostId: 'u-host-2', createdAt: iso(day(-90)) },
]

const MATR: BedType = 'Letto Matrimoniale'
const SING: BedType = 'Letto Singolo'
const DIVM: BedType = 'Divano letto Matrimoniale'

/** I 6 appartamenti reali osservati nella tabella Appartamenti di ComfyHost. */
export const apartments: Apartment[] = [
  {
    id: 'ap-livraghi', name: 'Via Giovanni Livraghi 2', address: 'Via Giovanni Livraghi 2',
    district: 'Trastevere', city: 'Roma', ownerId: 'u-host-1', visibility: 'official', provider: 'guesty',
    providerListingId: 'GY-88213', beds: [
      { id: 'b-liv-1', type: MATR }, { id: 'b-liv-2', type: DIVM },
    ],
    notes: '- Accesso con chiavi nella keybox a destra del portone.\n- Codice cassetta pulizie: 1405\n- Piano 1, interno 3.',
    prices: { base: 45, min: 35, max: 70, perGuest: { 1: 40, 2: 45, 3: 52, 4: 60 } },
    cleaningFrequencyDays: 3, createdAt: iso(day(-360)),
  },
  {
    id: 'ap-consoli', name: 'Piazza dei Consoli, 51', address: 'Piazza dei Consoli, 50',
    district: 'Tuscolana', city: 'Roma', ownerId: 'u-host-1', visibility: 'official', provider: 'hostaway',
    providerListingId: 'HA-40917', beds: [
      { id: 'b-con-1', type: MATR }, { id: 'b-con-2', type: SING }, { id: 'b-con-3', type: SING },
    ],
    notes: 'Citofono "Consoli 51". Ascensore fino al piano 4.\nRifornimenti nel ripostiglio, lucchetto 0000.',
    prices: { base: 50, min: 40, max: 78, perGuest: { 1: 42, 2: 50, 3: 58, 4: 66, 5: 74 } },
    cleaningFrequencyDays: 4, createdAt: iso(day(-350)),
  },
  {
    id: 'ap-giuliana', name: 'Via della Giuliana 35', address: 'Via della Giuliana 35',
    district: 'Prati', city: 'Roma', ownerId: 'u-host-2', visibility: 'official', provider: 'guesty',
    providerListingId: 'GY-88240', beds: [
      { id: 'b-giu-1', type: MATR }, { id: 'b-giu-2', type: DIVM },
    ],
    notes: '1) Mettere di nostro:\n   Amenities, cialde (1 a persona).\n   Tutti i refill si trovano nel vostro armadio, codice 0000\n2) Controllare sempre le chiavi nelle rispettive keybox.',
    prices: { base: 48, min: 38, max: 72, perGuest: { 1: 42, 2: 48, 3: 55, 4: 63 } },
    cleaningFrequencyDays: 3, createdAt: iso(day(-320)),
  },
  {
    id: 'ap-labicana', name: 'Via di Porta Labicana 19', address: 'Via di Porta Labicana 19',
    district: 'San Giovanni', city: 'Roma', ownerId: 'u-host-1', visibility: 'official', provider: 'guesty',
    providerListingId: 'GY-88266', beds: [
      { id: 'b-lab-1', type: MATR }, { id: 'b-lab-2', type: MATR }, { id: 'b-lab-3', type: SING },
    ],
    notes: '1) Mettere di nostro:\n   Amenities\n   Cialde (1 a persona).\n   Tutti i refill si trovano nel vostro armadio, codice 0000\n\n2) Spegnere i riscaldamenti: nel corridoio, sul termostato premere OFF (IMPORTANTE)\n\n3) Controllare sempre se le chiavi sono nelle rispettive keybox\n   Cassetta ospiti: 2307 · Cassetta pulizie: 1405\n   NON scambiarle per favore.',
    prices: { base: 55, min: 45, max: 85, perGuest: { 1: 46, 2: 55, 3: 64, 4: 72, 5: 80 } },
    cleaningFrequencyDays: 2, createdAt: iso(day(-300)),
  },
  {
    id: 'ap-trionfale', name: 'Via Trionfale 20', address: 'Via Trionfale 20',
    district: 'Prati', city: 'Roma', ownerId: 'u-host-2', visibility: 'official', provider: 'hostaway',
    providerListingId: 'HA-40952', beds: [{ id: 'b-tri-1', type: MATR }],
    notes: '1) Mettere di nostro:\n   - la saponetta + shampoo\n   - carta igienica\n   - the vari e zucchero\n\n   Tutti i refill si trovano nel vostro armadietto, codice lucchetto 140.',
    prices: { base: 40, min: 32, max: 62, perGuest: { 1: 36, 2: 40 } },
    cleaningFrequencyDays: 3, createdAt: iso(day(-280)),
  },
  {
    id: 'ap-scala', name: 'Via della Scala 9', address: 'Via della Scala 9',
    district: 'Trastevere', city: 'Roma', ownerId: 'u-host-1', visibility: 'official', provider: 'guesty',
    providerListingId: 'GY-88301', beds: [
      { id: 'b-sca-1', type: MATR }, { id: 'b-sca-2', type: DIVM },
    ],
    notes: '- Accesso con chiavi, si trovano al portone esterno.\n- Codice cassetta superiore 1405 (nostre chiavi - pulizie)\n- Codice cassetta inferiore 2307 (controllare se ci sono chiavi ospiti)\n- Piano 2 Butterfly House',
    prices: { base: 52, min: 42, max: 80, perGuest: { 1: 44, 2: 52, 3: 60, 4: 68 } },
    cleaningFrequencyDays: 2, createdAt: iso(day(-250)),
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
        assigneeId: status === 'in_attesa' ? undefined : pick(['u-op-1', 'u-op-2', 'u-op-3'] as const),
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
