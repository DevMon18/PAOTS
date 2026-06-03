import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

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

const LogOutIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
  </svg>
)

export default function Sidebar() {
  const { user, role, signOut } = useAuth()
  const navigate = useNavigate()

  const initials = user?.username
    ? user.username.substring(0, 2).toUpperCase()
    : '??'

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <aside className="sidebar">
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
            <NavLink to="/staff" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <StaffIcon /> Dashboard
            </NavLink>
            <NavLink to="/staff/orders/new" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <PlusIcon /> New Order
            </NavLink>
          </>
        )}

        {/* Designer navigation */}
        {(role === 'designer' || role === 'manager') && (
          <>
            <span className="nav-label">Production</span>
            <NavLink to="/designer" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <QueueIcon /> Design Queue
            </NavLink>
          </>
        )}

        {/* Manager navigation */}
        {role === 'manager' && (
          <>
            <span className="nav-label">Management</span>
            <NavLink to="/manager" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <ChartIcon /> Reports
            </NavLink>
            <NavLink to="/manager/inventory" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <PackageIcon /> Inventory
            </NavLink>
            <NavLink to="/manager/users" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <UsersIcon /> Users
            </NavLink>
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">{initials}</div>
          <div>
            <div className="user-name">{user?.username || 'Unknown'}</div>
            <div className="user-role">{role}</div>
          </div>
        </div>
        <button className="nav-item" onClick={handleSignOut} style={{ color: '#ef4444' }}>
          <LogOutIcon /> Sign Out
        </button>
      </div>
    </aside>
  )
}
