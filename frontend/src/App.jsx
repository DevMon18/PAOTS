import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'

// Pages
import Login from './pages/Login'
import StaffDashboard from './pages/staff/StaffDashboard'
import NewOrder from './pages/staff/NewOrder'
import OrderDetail from './pages/staff/OrderDetail'
import ClaimStub from './pages/staff/ClaimStub'
import DesignerQueue from './pages/designer/DesignerQueue'
import ManagerDashboard from './pages/manager/ManagerDashboard'
import Inventory from './pages/manager/Inventory'
import UserManagement from './pages/manager/UserManagement'

function ProtectedRoute({ children, allowedRoles }) {
  const { session, role, loading } = useAuth()

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner" />
      <p>Loading PAOTS...</p>
    </div>
  )

  if (!session) return <Navigate to="/login" replace />
  if (session && !role) return (
    <div className="loading-screen">
      <div className="spinner" />
      <p>Loading Profile...</p>
    </div>
  )
  if (allowedRoles && !allowedRoles.includes(role)) return <Navigate to="/" replace />
  return children
}

function RoleRouter() {
  const { role } = useAuth()
  if (role === 'designer') return <Navigate to="/designer" replace />
  if (role === 'manager') return <Navigate to="/manager" replace />
  return <Navigate to="/staff" replace />
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Root redirect based on role */}
          <Route path="/" element={
            <ProtectedRoute>
              <RoleRouter />
            </ProtectedRoute>
          } />

          {/* Staff routes */}
          <Route path="/staff" element={
            <ProtectedRoute allowedRoles={['staff', 'manager']}>
              <StaffDashboard />
            </ProtectedRoute>
          } />
          <Route path="/staff/orders/new" element={
            <ProtectedRoute allowedRoles={['staff', 'manager']}>
              <NewOrder />
            </ProtectedRoute>
          } />
          <Route path="/staff/orders/:id" element={
            <ProtectedRoute allowedRoles={['staff', 'manager']}>
              <OrderDetail />
            </ProtectedRoute>
          } />
          <Route path="/staff/orders/:id/claim-stub" element={
            <ProtectedRoute allowedRoles={['staff', 'manager']}>
              <ClaimStub />
            </ProtectedRoute>
          } />

          {/* Designer routes */}
          <Route path="/designer" element={
            <ProtectedRoute allowedRoles={['designer', 'manager']}>
              <DesignerQueue />
            </ProtectedRoute>
          } />
          <Route path="/designer/orders/:id" element={
            <ProtectedRoute allowedRoles={['designer', 'manager']}>
              <OrderDetail designerView />
            </ProtectedRoute>
          } />

          {/* Manager routes */}
          <Route path="/manager" element={
            <ProtectedRoute allowedRoles={['manager']}>
              <ManagerDashboard />
            </ProtectedRoute>
          } />
          <Route path="/manager/inventory" element={
            <ProtectedRoute allowedRoles={['manager']}>
              <Inventory />
            </ProtectedRoute>
          } />
          <Route path="/manager/users" element={
            <ProtectedRoute allowedRoles={['manager']}>
              <UserManagement />
            </ProtectedRoute>
          } />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
