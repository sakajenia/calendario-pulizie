import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { SchermoRotto } from '@/components/feedback/SchermoRotto'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Ultima rete: se l'errore e' fuori dalle pagine (accesso, guscio),
        resta comunque una schermata che dice cosa e' successo. */}
    <SchermoRotto>
      <App />
    </SchermoRotto>
  </React.StrictMode>,
)
