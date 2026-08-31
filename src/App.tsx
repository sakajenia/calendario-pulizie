import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { useCurrentUser } from '@/data/store'

import Login from '@/pages/Login'
import Calendario from '@/pages/Calendario'
import Richieste from '@/pages/Richieste'
import Appartamenti from '@/pages/Appartamenti'
import Dashboard from '@/pages/Dashboard'
import Utenti from '@/pages/Utenti'
import FogliDiLavoro from '@/pages/FogliDiLavoro'
import CatalogoTask from '@/pages/CatalogoTask'
import Extra from '@/pages/Extra'
import Magazzini from '@/pages/Magazzini'
import Notifiche from '@/pages/Notifiche'
import Impostazioni from '@/pages/Impostazioni'

function Protected({ children, adminOnly }: { children: JSX.Element; adminOnly?: boolean }) {
  const user = useCurrentUser()
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && user.role !== 'admin') return <Navigate to="/calendario" replace />
  return children
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <Protected>
              <AppShell />
            </Protected>
          }
        >
          <Route index element={<Navigate to="/calendario" replace />} />
          <Route path="/calendario" element={<Calendario />} />
          <Route path="/richieste" element={<Richieste />} />
          <Route path="/appartamenti" element={<Appartamenti />} />
          <Route path="/notifiche" element={<Notifiche />} />
          <Route path="/impostazioni" element={<Impostazioni />} />
          <Route path="/dashboard" element={<Protected adminOnly><Dashboard /></Protected>} />
          <Route path="/utenti" element={<Protected adminOnly><Utenti /></Protected>} />
          <Route path="/fogli-di-lavoro" element={<Protected adminOnly><FogliDiLavoro /></Protected>} />
          <Route path="/catalogo-task" element={<Protected adminOnly><CatalogoTask /></Protected>} />
          <Route path="/extra" element={<Protected adminOnly><Extra /></Protected>} />
          <Route path="/magazzini" element={<Protected adminOnly><Magazzini /></Protected>} />
        </Route>
        <Route path="*" element={<Navigate to="/calendario" replace />} />
      </Routes>
    </Router>
  )
}
