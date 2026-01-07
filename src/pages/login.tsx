import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { API_BASE_URL } from '../constants/api'
import { getIsAuthenticated, setAuthToken } from '../constants/auth'
import './Login.css'

type AuthMode = 'login' | 'signup'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const redirectPath = useMemo(() => {
    const state = location.state as { from?: { pathname?: string } } | null
    return state?.from?.pathname || '/app'
  }, [location.state])

  useEffect(() => {
    if (getIsAuthenticated()) {
      navigate(redirectPath, { replace: true })
    }
  }, [navigate, redirectPath])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      if (mode === 'signup') {
        const signupResponse = await fetch(`${API_BASE_URL}/api/auth/signup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        })

        if (!signupResponse.ok) {
          const errorBody = await signupResponse.json().catch(() => null)
          throw new Error(errorBody?.message ?? 'Failed to sign up. Please try again.')
        }
      }

      const loginResponse = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      if (!loginResponse.ok) {
        const errorBody = await loginResponse.json().catch(() => null)
        throw new Error(errorBody?.message ?? 'Failed to log in. Please try again.')
      }

      const loginData: { token?: string } = await loginResponse.json()
      if (!loginData.token) {
        throw new Error('The server did not return a login token.')
      }

      setAuthToken(loginData.token)
      navigate(redirectPath, { replace: true })
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Unexpected authentication error.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const subtitle =
    mode === 'login'
      ? 'Sign in to continue previewing your fabrics.'
      : 'Create an account to start building your fabric library.'

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1 className="login-title">Pattern Visualizer</h1>
        <p className="login-subtitle">{subtitle}</p>

        <label className="login-label" htmlFor="login-email">
          Email
        </label>
        <input
          id="login-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete={mode === 'signup' ? 'email' : 'username'}
        />

        <label className="login-label" htmlFor="login-password">
          Password
        </label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
        />

        {error ? <div className="login-error">{error}</div> : null}

        <button type="submit" className="login-button" disabled={isSubmitting}>
          {isSubmitting ? (mode === 'login' ? 'Logging In…' : 'Signing Up…') : mode === 'login' ? 'Log In' : 'Sign Up'}
        </button>

        <div className="login-toggle" aria-live="polite">
          {mode === 'login' ? (
            <span>
              Need an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signup')
                  setError(null)
                }}
              >
                Sign up
              </button>
            </span>
          ) : (
            <span>
              Already registered?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login')
                  setError(null)
                }}
              >
                Log in
              </button>
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
