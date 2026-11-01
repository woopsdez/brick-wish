import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Kid } from './pages/Kid'
import { KidAll } from './pages/KidAll'
import { KidCart, KidSent } from './pages/KidCart'
import { Join } from './pages/Join'
import { KidHistory } from './pages/KidHistory'
import { Parent } from './pages/Parent'
import { ParentGate } from './pages/ParentGate'
import { ParentRequest } from './pages/ParentRequest'
import { ParentSettings } from './pages/ParentSettings'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/kid" replace />} />
        <Route path="/kid" element={<Kid />} />
        <Route path="/kid/cart" element={<KidCart />} />
        <Route path="/kid/sent" element={<KidSent />} />
        <Route path="/kid/history" element={<KidHistory />} />
        <Route path="/kid/all" element={<KidAll />} />
        <Route path="/join/:code" element={<Join />} />
        <Route element={<ParentGate />}>
          <Route path="/parent" element={<Parent />} />
          <Route path="/parent/request/:id" element={<ParentRequest />} />
          <Route path="/parent/settings" element={<ParentSettings />} />
        </Route>
        <Route path="*" element={<Navigate to="/kid" replace />} />
      </Routes>
    </HashRouter>
  )
}
