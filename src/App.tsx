import { type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { getIsAuthenticated } from './constants/auth'
import LoginPage from './pages/login'
import SharedPresetPage from './pages/SharedPreset'
import VisualizerPage from './pages/Visualizer'

type RequireAuthProps = {
  children: ReactNode
}

function RequireAuth({ children }: RequireAuthProps) {
  const location = useLocation()
  if (!getIsAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return <>{children}</>
}

function RootRedirect() {
  return <Navigate to="/app" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/s/:slug" element={<SharedPresetPage />} />
        <Route
          path="/app/*"
          element={
            <RequireAuth>
              <VisualizerPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
