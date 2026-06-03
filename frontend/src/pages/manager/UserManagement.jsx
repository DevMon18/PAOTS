import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import api from '../../lib/api'
import Sidebar from '../../components/Sidebar'
import { useAuth } from '../../contexts/AuthContext'

const ROLES = ['staff', 'designer', 'manager']

export default function UserManagement() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [addModal, setAddModal] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [deleteModal, setDeleteModal] = useState(null) // user object to delete
  const [form, setForm] = useState({ email: '', username: '', password: '', role: 'staff' })
  const [editForm, setEditForm] = useState({ id: '', username: '', role: 'staff', isActive: true, password: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function fetchUsers() {
    const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false })
    setUsers(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchUsers() }, [])

  async function createUser(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await api.post('/api/users', form)
      setAddModal(false)
      setForm({ email: '', username: '', password: '', role: 'staff' })
      await fetchUsers()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleEditUser(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await api.patch(`/api/users/${editForm.id}`, {
        username: editForm.username,
        role: editForm.role,
        isActive: editForm.isActive,
        password: editForm.password ? editForm.password : undefined,
      })
      setEditModal(false)
      await fetchUsers()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteUser(userId) {
    setError('')
    setSaving(true)
    try {
      await api.delete(`/api/users/${userId}`)
      setDeleteModal(null)
      await fetchUsers()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const roleColors = { staff: '#4f6ef7', designer: '#8b5cf6', manager: '#16a34a' }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div>
            <h1>User Management</h1>
            <p className="subtitle">Manage staff accounts and role assignments</p>
          </div>
          <button id="add-user-btn" className="btn btn-primary" onClick={() => { setError(''); setAddModal(true) }}>
            + Add User
          </button>
        </div>

        <div className="page-body">
          <div className="card">
            <div className="table-wrapper">
              {loading ? (
                <div className="flex-center" style={{ padding: 60 }}><div className="spinner" /></div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => (
                      <tr key={user.id}>
                        <td>
                          <div className="flex gap-3" style={{ alignItems: 'center' }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: '50%',
                              background: `${roleColors[user.role]}30`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontWeight: 700, fontSize: 12, color: roleColors[user.role],
                            }}>
                              {user.username.substring(0, 2).toUpperCase()}
                            </div>
                            <span className="font-semibold">{user.username}</span>
                          </div>
                        </td>
                        <td>
                          <span style={{
                            padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                            background: `${roleColors[user.role]}20`, color: roleColors[user.role],
                            textTransform: 'capitalize',
                          }}>
                            {user.role}
                          </span>
                        </td>
                        <td>
                          <span style={{
                            padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                            background: user.is_active ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                            color: user.is_active ? '#22c55e' : '#ef4444',
                          }}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="muted text-sm">{new Date(user.created_at).toLocaleDateString()}</td>
                        <td>
                          <div className="flex gap-2">
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => {
                                setError('')
                                setEditForm({
                                  id: user.id,
                                  username: user.username,
                                  role: user.role,
                                  isActive: user.is_active,
                                  password: '',
                                })
                                setEditModal(true)
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => {
                                setError('')
                                setDeleteModal(user)
                              }}
                              disabled={user.id === currentUser?.id}
                              title={user.id === currentUser?.id ? 'You cannot delete yourself' : ''}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {addModal && (
          <div className="modal-overlay" onClick={() => setAddModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Add New User</h3>
                <button className="btn btn-sm btn-secondary btn-icon" onClick={() => setAddModal(false)}>✕</button>
              </div>
              <form onSubmit={createUser} className="flex-col gap-4">
                {error && <div className="alert alert-error" style={{ fontSize: 13 }}>{error}</div>}
                <div className="form-group">
                  <label className="form-label required">Email Address</label>
                  <input type="email" className="form-input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label required">Username</label>
                  <input type="text" className="form-input" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label required">Temporary Password</label>
                  <input type="password" className="form-input" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required minLength={8} />
                </div>
                <div className="form-group">
                  <label className="form-label required">Role</label>
                  <select className="form-select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                    {ROLES.map(r => <option key={r} value={r} style={{ textTransform: 'capitalize' }}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                  </select>
                </div>
                <div className="flex gap-3 mt-2">
                  <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setAddModal(false)}>Cancel</button>
                  <button type="submit" className={`btn btn-primary ${saving ? 'btn-loading' : ''}`} style={{ flex: 1 }} disabled={saving}>
                    {!saving && 'Create User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {editModal && (
          <div className="modal-overlay" onClick={() => setEditModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Edit User</h3>
                <button className="btn btn-sm btn-secondary btn-icon" onClick={() => setEditModal(false)}>✕</button>
              </div>
              <form onSubmit={handleEditUser} className="flex-col gap-4">
                {error && <div className="alert alert-error" style={{ fontSize: 13 }}>{error}</div>}
                <div className="form-group">
                  <label className="form-label required">Username</label>
                  <input type="text" className="form-input" value={editForm.username} onChange={e => setEditForm(f => ({ ...f, username: e.target.value }))} required />
                </div>
                {editForm.id === currentUser?.id && (
                  <div className="form-group">
                    <label className="form-label">New Password (leave blank to keep current)</label>
                    <input type="password" className="form-input" placeholder="Min. 8 characters" value={editForm.password} onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))} minLength={8} />
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label required">Role</label>
                  <select className="form-select" value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}>
                    {ROLES.map(r => <option key={r} value={r} style={{ textTransform: 'capitalize' }}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label required">Status</label>
                  <select className="form-select" value={editForm.isActive ? 'active' : 'inactive'} onChange={e => setEditForm(f => ({ ...f, isActive: e.target.value === 'active' }))}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="flex gap-3 mt-2">
                  <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEditModal(false)}>Cancel</button>
                  <button type="submit" className={`btn btn-primary ${saving ? 'btn-loading' : ''}`} style={{ flex: 1 }} disabled={saving}>
                    {!saving && 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {deleteModal && (
          <div className="modal-overlay" onClick={() => setDeleteModal(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Delete User</h3>
                <button className="btn btn-sm btn-secondary btn-icon" onClick={() => setDeleteModal(null)}>✕</button>
              </div>
              <div className="flex-col gap-4">
                {error && <div className="alert alert-error" style={{ fontSize: 13 }}>{error}</div>}
                <div className="alert alert-warning" style={{ margin: 0 }}>
                  Are you sure you want to delete the user account for <strong>{deleteModal.username}</strong>? This action is permanent and cannot be undone.
                </div>
                <div className="flex gap-3 mt-2">
                  <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setDeleteModal(null)}>Cancel</button>
                  <button
                    className={`btn btn-danger ${saving ? 'btn-loading' : ''}`}
                    style={{ flex: 1 }}
                    disabled={saving}
                    onClick={() => handleDeleteUser(deleteModal.id)}
                  >
                    {!saving && 'Delete Account'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
