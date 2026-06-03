import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../lib/api'
import { useState } from 'react'

const StaffIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <rect x="3" y="3" width="18" height="18" rx="3"/>
    <path d="M3 9h18M9 21V9"/>
  </svg>
)

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="12" r="9"/>
    <path d="M12 8v8M8 12h8"/>
  </svg>
)

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <circle cx="11" cy="11" r="8"/>
    <path d="m21 21-4.35-4.35"/>
  </svg>
)

const QueueIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
  </svg>
)

const ChartIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M3 3v18h18"/>
    <path d="m7 16 4-4 4 4 5-5"/>
  </svg>
)

const PackageIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="m7.5 4.27 9 5.15M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
    <path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>
  </svg>
)

const UsersIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)

const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
)

const LogOutIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
  </svg>
)

export default function Sidebar() {
  const { user, role, signOut } = useAuth()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)

  const initials = user?.username
    ? user.username.substring(0, 2).toUpperCase()
    : '??'

  const [showPassModal, setShowPassModal] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [passError, setPassError] = useState('')
  const [passSuccess, setPassSuccess] = useState('')
  const [passLoading, setPassLoading] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  async function handlePasswordChange(e) {
    e.preventDefault()
    setPassError('')
    setPassSuccess('')
    if (newPassword.length < 8) {
      setPassError('Password must be at least 8 characters long.')
      return
    }
    setPassLoading(true)
    try {
      await api.patch(`/api/users/${user.id}`, { password: newPassword })
      setPassSuccess('Password updated successfully!')
      setNewPassword('')
      setTimeout(() => setShowPassModal(false), 1500)
    } catch (err) {
      setPassError(err.message || 'Failed to update password')
    } finally {
      setPassLoading(false)
    }
  }

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="mobile-topbar">
        <button className="hamburger-btn" onClick={() => setIsOpen(true)} aria-label="Open menu">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={24} height={24}>
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </svg>
        </button>
        <span className="mobile-logo-text">PAOTS</span>
        <div style={{ width: 24 }} /> {/* spacing spacer */}
      </div>

      {/* Sidebar Backdrop */}
      {isOpen && <div className="sidebar-backdrop" onClick={() => setIsOpen(false)} />}

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        {/* Close Button on Mobile */}
        <button className="sidebar-close-btn" onClick={() => setIsOpen(false)} aria-label="Close menu">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={20} height={20}>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="sidebar-logo">
          <div className="logo-mark">
            <div className="logo-icon">P</div>
            <div>
              <div className="logo-text">PAOTS</div>
              <div className="logo-sub">Order Tracking</div>
            </div>
          </div>
        </div>

      <nav className="sidebar-nav">
        {/* Staff navigation */}
        {(role === 'staff' || role === 'manager') && (
          <>
            <span className="nav-label">Counter</span>
            <NavLink to="/staff" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => setIsOpen(false)}>
              <StaffIcon /> Dashboard
            </NavLink>
            <NavLink to="/staff/orders/new" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => setIsOpen(false)}>
              <PlusIcon /> New Order
            </NavLink>
          </>
        )}

        {/* Designer navigation */}
        {(role === 'designer' || role === 'manager') && (
          <>
            <span className="nav-label">Production</span>
            <NavLink to="/designer" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => setIsOpen(false)}>
              <QueueIcon /> Design Queue
            </NavLink>
          </>
        )}

        {/* Manager navigation */}
        {role === 'manager' && (
          <>
            <span className="nav-label">Management</span>
            <NavLink to="/manager" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => setIsOpen(false)}>
              <ChartIcon /> Reports
            </NavLink>
            <NavLink to="/manager/inventory" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => setIsOpen(false)}>
              <PackageIcon /> Inventory
            </NavLink>
            <NavLink to="/manager/users" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => setIsOpen(false)}>
              <UsersIcon /> Users
            </NavLink>
          </>
        )}
      </nav>

      <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="user-info">
          <div className="user-avatar">{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="user-name">{user?.username || 'Unknown'}</div>
            <div className="user-role">{role}</div>
          </div>
        </div>
        <button className="nav-item" onClick={() => { setIsOpen(false); setPassError(''); setPassSuccess(''); setShowPassModal(true); }} style={{ border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
          <LockIcon /> Change Password
        </button>
        <button className="nav-item" onClick={() => { setIsOpen(false); handleSignOut(); }} style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
          <LogOutIcon /> Sign Out
        </button>
      </div>

      {showPassModal && (
        <div className="modal-overlay" onClick={() => setShowPassModal(false)} style={{ zIndex: 9999 }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Change Password</h3>
              <button className="btn btn-sm btn-secondary btn-icon" onClick={() => setShowPassModal(false)}>✕</button>
            </div>
            <form onSubmit={handlePasswordChange} className="flex-col gap-4">
              {passError && <div className="alert alert-error" style={{ fontSize: 13 }}>{passError}</div>}
              {passSuccess && <div className="alert alert-success" style={{ fontSize: 13 }}>{passSuccess}</div>}
              <div className="form-group">
                <label className="form-label required">New Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Minimum 8 characters"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  autoFocus
                />
              </div>
              <div className="flex gap-3 mt-2">
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowPassModal(false)}>Cancel</button>
                <button type="submit" className={`btn btn-primary ${passLoading ? 'btn-loading' : ''}`} style={{ flex: 1 }} disabled={passLoading}>
                  {!passLoading && 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </aside>
  </>
)
}
