import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Sidebar from '../../components/Sidebar'

export default function Inventory() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState(null)
  const [addModal, setAddModal] = useState(false)
  const [form, setForm] = useState({ material_type: '', current_stock: '', threshold_level: '', unit: '' })
  const [saving, setSaving] = useState(false)

  async function fetchInventory() {
    const { data } = await supabase.from('inventory').select('*').order('material_type')
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchInventory() }, [])

  async function saveItem() {
    setSaving(true)
    if (editId) {
      await supabase.from('inventory').update({
        current_stock: parseFloat(form.current_stock),
        threshold_level: parseFloat(form.threshold_level),
        unit: form.unit,
        last_updated: new Date().toISOString(),
      }).eq('id', editId)
    } else {
      await supabase.from('inventory').insert({
        material_type: form.material_type,
        current_stock: parseFloat(form.current_stock),
        threshold_level: parseFloat(form.threshold_level),
        unit: form.unit,
      })
    }
    setEditId(null)
    setAddModal(false)
    setForm({ material_type: '', current_stock: '', threshold_level: '', unit: '' })
    await fetchInventory()
    setSaving(false)
  }

  function startEdit(item) {
    setEditId(item.id)
    setForm({
      material_type: item.material_type,
      current_stock: item.current_stock,
      threshold_level: item.threshold_level,
      unit: item.unit,
    })
    setAddModal(true)
  }

  async function deleteItem(id) {
    if (!confirm('Remove this inventory item?')) return
    await supabase.from('inventory').delete().eq('id', id)
    await fetchInventory()
  }

  const lowStock = items.filter(i => parseFloat(i.current_stock) <= parseFloat(i.threshold_level))

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div>
            <h1>Inventory</h1>
            <p className="subtitle">Track consumable materials and set low-stock alerts</p>
          </div>
          <button id="add-inventory-btn" className="btn btn-primary" onClick={() => { setEditId(null); setForm({ material_type: '', current_stock: '', threshold_level: '', unit: '' }); setAddModal(true) }}>
            + Add Material
          </button>
        </div>

        <div className="page-body">
          {/* Alerts */}
          {lowStock.length > 0 && (
            <div className="alert alert-warning mb-6">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <div>
                <strong>Low stock alert:</strong> {lowStock.map(i => i.material_type).join(', ')} — please reorder soon.
              </div>
            </div>
          )}

          <div className="card">
            <div className="table-wrapper">
              {loading ? (
                <div className="flex-center" style={{ padding: 60 }}><div className="spinner" /></div>
              ) : items.length === 0 ? (
                <div className="empty-state">
                  <h3>No inventory items</h3>
                  <p>Add your first material to start tracking stock levels.</p>
                </div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th>Current Stock</th>
                      <th>Alert Threshold</th>
                      <th>Unit</th>
                      <th>Status</th>
                      <th>Last Updated</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => {
                      const isLow = parseFloat(item.current_stock) <= parseFloat(item.threshold_level)
                      return (
                        <tr key={item.id}>
                          <td className="font-semibold">{item.material_type}</td>
                          <td style={{ fontWeight: 700, color: isLow ? 'var(--color-warning)' : 'var(--color-success)', fontSize: 16 }}>
                            {item.current_stock}
                          </td>
                          <td className="text-muted">{item.threshold_level}</td>
                          <td className="text-muted">{item.unit}</td>
                          <td>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '4px 10px',
                              borderRadius: 20,
                              fontSize: 12,
                              fontWeight: 700,
                              background: isLow ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                              color: isLow ? '#ef4444' : '#22c55e',
                            }}>
                              {isLow ? '⚠ Low Stock' : '✓ OK'}
                            </span>
                          </td>
                          <td className="muted text-sm">
                            {item.last_updated ? new Date(item.last_updated).toLocaleDateString() : '—'}
                          </td>
                          <td>
                            <div className="flex gap-2">
                              <button className="btn btn-sm btn-secondary" onClick={() => startEdit(item)}>Edit</button>
                              <button className="btn btn-sm btn-danger" onClick={() => deleteItem(item.id)}>Remove</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
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
                <h3>{editId ? 'Update Material' : 'Add Material'}</h3>
                <button className="btn btn-sm btn-secondary btn-icon" onClick={() => setAddModal(false)}>✕</button>
              </div>
              <div className="flex-col gap-4">
                <div className="form-group">
                  <label className="form-label required">Material Type</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g., Tarpaulin Roll"
                    value={form.material_type}
                    onChange={e => setForm(f => ({ ...f, material_type: e.target.value }))}
                    disabled={!!editId}
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label required">Current Stock</label>
                    <input
                      type="number" min="0" step="0.1"
                      className="form-input"
                      placeholder="0"
                      value={form.current_stock}
                      onChange={e => setForm(f => ({ ...f, current_stock: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label required">Alert Threshold</label>
                    <input
                      type="number" min="0" step="0.1"
                      className="form-input"
                      placeholder="0"
                      value={form.threshold_level}
                      onChange={e => setForm(f => ({ ...f, threshold_level: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label required">Unit</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g., rolls, meters, liters"
                    value={form.unit}
                    onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                  />
                </div>
                <div className="flex gap-3 mt-2">
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setAddModal(false)}>Cancel</button>
                  <button
                    className={`btn btn-primary ${saving ? 'btn-loading' : ''}`}
                    style={{ flex: 1 }}
                    disabled={saving || !form.material_type || !form.current_stock || !form.threshold_level || !form.unit}
                    onClick={saveItem}
                  >
                    {!saving && (editId ? 'Update' : 'Add Material')}
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
