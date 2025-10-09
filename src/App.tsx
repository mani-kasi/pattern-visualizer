import { type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { getIsAuthenticated } from './constants/auth'
import LoginPage from './pages/Login'
import VisualizerPage from './pages/Visualizer'

type RequireAuthProps = {
  children: ReactNode
}

function RequireAuth({ children }: RequireAuthProps) {
  if (!getIsAuthenticated()) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

function RootRedirect() {
  return getIsAuthenticated() ? <Navigate to="/app" replace /> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/app"
          element={
            <RequireAuth>
              <VisualizerPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
