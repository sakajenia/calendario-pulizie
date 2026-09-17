/*
 * La rete di sicurezza contro la pagina bianca.
 *
 * Senza di questa, un errore dentro una pagina fa smontare tutta
 * l'applicazione: schermo bianco, nessuna spiegazione, nessun modo di capire
 * cosa sia successo da un telefono. Qui l'errore diventa invece una schermata
 * leggibile, con il motivo, la targa della build e i due modi per uscirne:
 * riprovare, oppure tornare al calendario.
 *
 * Il pulsante che svuota i dati del dispositivo e' l'ultima spiaggia e lo dice:
 * se l'archivio condiviso non e' collegato, quei dati non sono altrove.
 */
import React from 'react'

interface Stato {
  errore: Error | null
}

export class SchermoRotto extends React.Component<{ children: React.ReactNode }, Stato> {
  state: Stato = { errore: null }

  static getDerivedStateFromError(errore: Error): Stato {
    return { errore }
  }

  componentDidCatch(errore: Error, info: React.ErrorInfo) {
    /* In console resta tutto: serve quando si guarda da computer. */
    console.error('ProProManager, errore in pagina:', errore, info.componentStack)
  }

  private riprova = () => this.setState({ errore: null })

  private svuota = () => {
    const conferma = window.confirm(
      'Cancella i dati salvati su questo dispositivo e ricarica.\n\n' +
      'Se l’archivio condiviso non è collegato, le modifiche fatte solo qui andranno perse.',
    )
    if (!conferma) return
    try {
      localStorage.removeItem('propromanager-state')
    } catch {
      /* finestra privata: non c'era niente da cancellare */
    }
    window.location.href = '/'
  }

  render() {
    const { errore } = this.state
    if (!errore) return this.props.children

    const dettaglio = `${errore.name}: ${errore.message}`

    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
          <h1 className="text-base font-semibold">Questa pagina non si &egrave; aperta</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Il resto dell&rsquo;applicazione funziona. Qui sotto c&rsquo;&egrave; il motivo:
            copialo e mandalo, serve per correggerlo.
          </p>
          <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            {dettaglio}
          </pre>
          <p className="mt-2 text-[11px] text-muted-foreground">Build {__BUILD_ID__}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={this.riprova}
              className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
            >
              Riprova
            </button>
            <button
              type="button"
              onClick={() => { window.location.href = '/calendario' }}
              className="rounded-lg border border-border px-3 py-2 text-sm font-medium"
            >
              Torna al calendario
            </button>
            <button
              type="button"
              onClick={this.svuota}
              className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground"
            >
              Svuota i dati di questo dispositivo
            </button>
          </div>
        </div>
      </div>
    )
  }
}
