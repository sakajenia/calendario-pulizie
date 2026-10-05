/* Chi puo' completare, annotare e rispondere a una pulizia. */
import { describe, expect, it } from 'vitest'
import {
  canAnnotateRequest, canCompleteRequest, canRespondToRequest,
} from '@/lib/permissions'
import { REQUEST_STATUSES, type RequestStatus } from '@/types'
import { casa, pulizia, utente } from './fixtures'

const manager = utente()
const ditta = utente({ id: 'u-pulizie-angela', role: 'operator', companyId: 'angela' })
const altraDitta = utente({ id: 'u-pulizie-altra', role: 'operator', companyId: 'altra' })
const apartments = [casa()]

describe('canCompleteRequest', () => {
  it('la ditta chiude solo le pulizie prese in carico delle sue case', () => {
    const atteso: Record<RequestStatus, boolean> = {
      in_attesa: false, accettata: true, in_corso: true, completata: false, cancellata: false,
    }
    for (const status of REQUEST_STATUSES) {
      expect(canCompleteRequest(ditta, pulizia({ status }), apartments), status).toBe(atteso[status])
    }
  })

  it('una pulizia cancellata non si chiude nemmeno se assegnata all\'addetto', () => {
    const r = pulizia({ status: 'cancellata', assigneeId: ditta.id })
    expect(canCompleteRequest(ditta, r, apartments)).toBe(false)
    expect(canCompleteRequest(ditta, r)).toBe(false)
    expect(canCompleteRequest(ditta, { ...r, status: 'accettata' })).toBe(true)
  })

  it('le case di un\'altra ditta restano fuori', () => {
    expect(canCompleteRequest(altraDitta, pulizia({ status: 'accettata' }), apartments)).toBe(false)
  })

  it('il manager porta la pulizia dove vuole', () => {
    for (const status of REQUEST_STATUSES) {
      expect(canCompleteRequest(manager, pulizia({ status }), apartments)).toBe(true)
    }
  })
})

describe('canAnnotateRequest', () => {
  it('note sulle pulizie prese in carico o completate, non su quelle annullate o in attesa', () => {
    const atteso: Record<RequestStatus, boolean> = {
      in_attesa: false, accettata: true, in_corso: true, completata: true, cancellata: false,
    }
    for (const status of REQUEST_STATUSES) {
      expect(canAnnotateRequest(ditta, pulizia({ status }), apartments), status).toBe(atteso[status])
    }
  })
})

describe('Accetta/Rifiuta e Completa', () => {
  it('per la ditta non valgono mai insieme', () => {
    for (const status of REQUEST_STATUSES) {
      for (const assigneeId of [undefined, ditta.id]) {
        const r = pulizia({ status, assigneeId })
        const entrambi = canRespondToRequest(ditta, r) && canCompleteRequest(ditta, r, apartments)
        expect(entrambi, `${status} ${assigneeId ?? ''}`).toBe(false)
      }
    }
  })
})
