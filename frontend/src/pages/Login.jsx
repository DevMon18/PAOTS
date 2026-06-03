import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/')
    } catch (err) {
      setError(err.message || 'Invalid email or password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-logo">
          <div className="logo-icon-lg">P</div>
          <h1>PAOTS</h1>
          <p>Process Automation &amp; Order Tracking System</p>
        </div>

        <form onSubmit={handleSubmit} className="flex-col gap-5">
          {error && (
            <div className="alert alert-error" role="alert">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="login-email" className="form-label required">Email Address</label>
            <input
              id="login-email"
              type="email"
              className={`form-input ${error ? 'error' : ''}`}
              placeholder="you@printshop.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password" className="form-label required">Password</label>
            <input
              id="login-password"
              type="password"
              className={`form-input ${error ? 'error' : ''}`}
              placeholder="Enter your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <button
            id="login-submit"
            type="submit"
            className={`btn btn-primary btn-lg w-full ${loading ? 'btn-loading' : ''}`}
            disabled={loading}
          >
            {!loading && 'Sign In'}
          </button>
        </form>

        <p className="text-xs text-muted text-center mt-6">
          Account locked? Contact your shop manager.
        </p>
      </div>
    </div>
  )
}
