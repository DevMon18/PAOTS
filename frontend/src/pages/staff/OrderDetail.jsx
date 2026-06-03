import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import api from '../../lib/api'
import Sidebar from '../../components/Sidebar'
import StatusBadge, { PaymentBadge } from '../../components/StatusBadge'
import { useAuth } from '../../contexts/AuthContext'
import { format } from 'date-fns'

const STATUS_STEPS = ['received', 'designing', 'printing', 'ready', 'collected']

export default function OrderDetail({ designerView = false }) {
  const { id } = useParams()
  const { role } = useAuth()
  const navigate = useNavigate()
  const [order, setOrder] = useState(null)
  const [payments, setPayments] = useState([])
  const [statusHistory, setStatusHistory] = useState([])
  const [fileAttachments, setFileAttachments] = useState([])
  const [loading, setLoading] = useState(true)
  const [paymentModal, setPaymentModal] = useState(false)
  const [voidModal, setVoidModal] = useState(null)
  const [statusLoading, setStatusLoading] = useState(false)
  const [payForm, setPayForm] = useState({ amount: '', method: 'cash', ewalletRef: '' })
  const [payError, setPayError] = useState('')

  async function fetchOrder() {
    setLoading(true)
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *, customers(id, name, contact_number, email),
        users!orders_created_by_fkey(username)
      `)
      .eq('id', id)
      .single()
    if (error || !data) { navigate(-1); return }
    setOrder(data)

    // Fetch related data in parallel
    const [{ data: pays }, { data: history }, { data: files }] = await Promise.all([
      supabase.from('payments').select('*, users!payments_recorded_by_fkey(username)').eq('order_id', id).order('created_at'),
      supabase.from('status_history').select('*, users!status_history_changed_by_fkey(username)').eq('order_id', id).order('changed_at'),
      supabase.from('file_attachments').select('*').eq('order_id', id),
    ])
    setPayments(pays || [])
    setStatusHistory(history || [])
    setFileAttachments(files || [])
    setLoading(false)
  }

  useEffect(() => { fetchOrder() }, [id])

  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel(`order-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, () => fetchOrder())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [id])

  async function advanceStatus() {
    const nextMap = { received:'designing', designing:'printing', printing:'ready', ready:'collected' }
    const next = nextMap[order.status]
    if (!next) return
    setStatusLoading(true)
    try {
      await api.patch(`/api/orders/${id}/status`, { newStatus: next })
      await fetchOrder()
    } catch (err) {
      alert(err.message)
    } finally {
      setStatusLoading(false)
    }
  }

  async function handleCollect() {
    setStatusLoading(true)
    try {
      await api.patch(`/api/orders/${id}/status`, { newStatus: 'collected' })
      await fetchOrder()
    } catch (err) {
      alert(err.message)
    } finally {
      setStatusLoading(false)
    }
  }

  async function handlePayment(e) {
    e.preventDefault()
    setPayError('')
    const amount = parseFloat(payForm.amount)
    if (!amount || amount <= 0) { setPayError('Enter a valid amount'); return }
    if (amount > parseFloat(order.balance_due)) {
      setPayError(`Amount entered exceeds the outstanding balance of ₱${parseFloat(order.balance_due).toFixed(2)}. Please enter a valid amount.`)
      return
    }
    if (payForm.method === 'ewallet' && !payForm.ewalletRef.trim()) {
      setPayError('E-wallet reference number is required')
      return
    }
    try {
      await api.post('/api/payments', {
        orderId: id,
        amount,
        paymentMethod: payForm.method,
        ewalletRef: payForm.ewalletRef,
      })
      setPaymentModal(false)
      setPayForm({ amount: '', method: 'cash', ewalletRef: '' })
      await fetchOrder()
    } catch (err) {
      setPayError(err.message)
    }
  }

  async function handleVoid(paymentId, reason) {
    try {
      await api.post(`/api/payments/${paymentId}/void`, { reason })
      setVoidModal(null)
      await fetchOrder()
    } catch (err) {
      alert(err.message)
    }
  }

  async function downloadFile(attachment) {
    const { data } = await supabase.storage
      .from('order-files')
      .createSignedUrl(attachment.storage_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  if (loading) return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content flex-center" style={{ height: '100vh' }}>
        <div className="spinner" />
      </main>
    </div>
  )

  const formatCurrency = v => `₱${parseFloat(v || 0).toFixed(2)}`
  const formatDate = d => d ? format(new Date(d), 'MMM d, yyyy h:mm a') : '—'

  const currentStepIdx = STATUS_STEPS.indexOf(order.status)
  const canAdvance = !designerView && role === 'designer' && ['received','designing','printing'].includes(order.status)
  const canCollect = !designerView && role === 'staff' && order.status === 'ready'
  const canPay = !designerView && role === 'staff' && parseFloat(order.balance_due) > 0 && order.status !== 'collected'

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div>
            <h1 style={{ fontFamily: 'monospace', letterSpacing: 2 }}>{order.tracking_id}</h1>
            <div className="flex gap-3" style={{ marginTop: 4, alignItems: 'center' }}>
              <StatusBadge status={order.status} />
              <span className="text-sm text-muted">Created {formatDate(order.created_at)}</span>
            </div>
          </div>
          <div className="flex gap-3">
            {!designerView && (
              <button className="btn btn-secondary" onClick={() => navigate(`/staff/orders/${id}/claim-stub`)}>
                View Claim Stub
              </button>
            )}
            {canAdvance && (
              <button
                id="advance-status-btn"
                className={`btn btn-primary ${statusLoading ? 'btn-loading' : ''}`}
                onClick={advanceStatus}
                disabled={statusLoading}
              >
                {!statusLoading && `Mark as ${({received:'Designing',designing:'Printing',printing:'Ready'})[order.status]}`}
              </button>
            )}
            {canCollect && (
              <button
                id="collect-btn"
                className={`btn btn-success ${statusLoading ? 'btn-loading' : ''}`}
                onClick={handleCollect}
                disabled={statusLoading || parseFloat(order.balance_due) > 0}
                title={parseFloat(order.balance_due) > 0 ? 'Collect remaining balance first' : ''}
              >
                {!statusLoading && 'Mark as Collected'}
              </button>
            )}
            {canPay && (
              <button id="record-payment-btn" className="btn btn-primary" onClick={() => setPaymentModal(true)}>
                Record Payment
              </button>
            )}
          </div>
        </div>

        {/* Status Progress Bar */}
        <div style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', padding: '16px 32px' }}>
          <div className="progress-steps">
            {STATUS_STEPS.map((s, i) => (
              <div key={s} className={`step ${i < currentStepIdx ? 'completed' : ''} ${i === currentStepIdx ? 'active' : ''}`}>
                <div className="step-dot">
                  {i < currentStepIdx ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                      <path d="M20 6 9 17l-5-5"/>
                    </svg>
                  ) : i + 1}
                </div>
                <div className="step-label" style={{ textTransform: 'capitalize' }}>{s}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="page-body">
          <div className="grid-2">
            {/* Left column */}
            <div className="flex-col gap-5">
              {/* Customer */}
              <div className="card">
                <div className="card-header"><h2>Customer</h2></div>
                <div className="card-body flex-col gap-3">
                  <div className="flex-between">
                    <span className="text-sm text-muted">Name</span>
                    <span className="font-semibold">{order.customers?.name}</span>
                  </div>
                  <div className="flex-between">
                    <span className="text-sm text-muted">Contact</span>
                    <span className="font-semibold">{order.customers?.contact_number}</span>
                  </div>
                  {order.customers?.email && (
                    <div className="flex-between">
                      <span className="text-sm text-muted">Email</span>
                      <span className="font-semibold">{order.customers.email}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Job specs */}
              <div className="card">
                <div className="card-header"><h2>Job Specifications</h2></div>
                <div className="card-body flex-col gap-3">
                  {[
                    ['Job Type', order.job_type],
                    ['Dimensions', order.dimensions],
                    ['Material', order.material_type],
                    ['Quantity', order.quantity],
                    ['Pickup Date', order.estimated_pickup_date ? format(new Date(order.estimated_pickup_date), 'MMMM d, yyyy') : '—'],
                    ['Created by', order.users?.username],
                  ].map(([k, v]) => (
                    <div className="flex-between" key={k}>
                      <span className="text-sm text-muted">{k}</span>
                      <span className="font-semibold">{v || '—'}</span>
                    </div>
                  ))}
                  {order.notes && (
                    <div style={{ marginTop: 12, padding: 12, background: 'var(--color-surface-2)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--color-warning)' }}>
                      <div className="text-xs text-muted font-bold" style={{ textTransform: 'uppercase', marginBottom: 4 }}>Special Instructions</div>
                      <div className="text-sm font-medium" style={{ whiteSpace: 'pre-wrap' }}>{order.notes}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Files */}
              <div className="card">
                <div className="card-header"><h2>Layout File</h2></div>
                <div className="card-body">
                  {fileAttachments.length === 0 ? (
                    <div className="alert alert-warning">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                      </svg>
                      No file attached to this order — check with the counter staff.
                    </div>
                  ) : (
                    <div className="flex-col gap-3">
                      {fileAttachments.map(f => (
                        <div key={f.id} className="file-preview">
                          <div className="file-preview-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                              <polyline points="14 2 14 8 20 8"/>
                            </svg>
                          </div>
                          <div className="flex-col gap-1" style={{ flex: 1 }}>
                            <div className="text-sm font-semibold">{f.original_filename}</div>
                            <div className="text-xs text-muted">{(f.file_size_bytes / (1024*1024)).toFixed(1)} MB</div>
                          </div>
                          <button id="download-file-btn" className="btn btn-sm btn-secondary" onClick={() => downloadFile(f)}>
                            Download
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right column */}
            <div className="flex-col gap-5">
              {/* Payment summary */}
              <div className="card">
                <div className="card-header">
                  <h2>Payment Summary</h2>
                  {canPay && (
                    <button id="record-payment-btn-2" className="btn btn-sm btn-primary" onClick={() => setPaymentModal(true)}>
                      Record Payment
                    </button>
                  )}
                </div>
                <div className="card-body flex-col gap-4">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="flex-between">
                      <span className="text-sm text-muted">Total Cost</span>
                      <span className="font-bold" style={{ fontSize: 18 }}>{formatCurrency(order.total_cost)}</span>
                    </div>
                    <div className="flex-between">
                      <span className="text-sm text-muted">Total Paid</span>
                      <span className="font-semibold" style={{ color: 'var(--color-success)' }}>
                        {formatCurrency(parseFloat(order.total_cost) - parseFloat(order.balance_due))}
                      </span>
                    </div>
                    <div className="divider" style={{ margin: '4px 0' }} />
                    <div className="flex-between">
                      <span className="font-bold">Balance Due</span>
                      <span style={{
                        fontSize: 24,
                        fontWeight: 800,
                        color: parseFloat(order.balance_due) > 0 ? 'var(--color-warning)' : 'var(--color-success)'
                      }}>
                        {formatCurrency(order.balance_due)}
                      </span>
                    </div>
                  </div>

                  {/* Payment history */}
                  <div className="form-section-title">Payment History</div>
                  {payments.length === 0 ? (
                    <p className="text-sm text-muted">No payments recorded yet.</p>
                  ) : (
                    <div className="flex-col gap-2">
                      {payments.map(p => (
                        <div key={p.id} style={{
                          background: 'var(--color-surface-2)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '12px 16px',
                          opacity: p.is_voided ? 0.5 : 1,
                          textDecoration: p.is_voided ? 'line-through' : 'none',
                        }}>
                          <div className="flex-between">
                            <div>
                              <span className="font-bold">{formatCurrency(p.amount)}</span>
                              <span className="text-xs text-muted" style={{ marginLeft: 8 }}>
                                {p.payment_method === 'ewallet' ? `E-wallet · Ref: ${p.ewallet_ref || '—'}` : 'Cash'}
                              </span>
                              {p.is_voided && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--color-danger)' }}>VOIDED</span>}
                            </div>
                            <div className="flex gap-2" style={{ alignItems: 'center' }}>
                              <PaymentBadge status={p.payment_status} />
                              {role === 'manager' && !p.is_voided && (
                                <button
                                  className="btn btn-sm btn-danger"
                                  onClick={() => setVoidModal(p)}
                                >
                                  Void
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                            {formatDate(p.transaction_date)} · by {p.users?.username}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Status history */}
              <div className="card">
                <div className="card-header"><h2>Status History</h2></div>
                <div className="card-body">
                  {statusHistory.length === 0 ? (
                    <p className="text-sm text-muted">No status changes recorded.</p>
                  ) : (
                    <div className="flex-col" style={{ position: 'relative' }}>
                      {statusHistory.map((h, i) => (
                        <div key={h.id} style={{ display: 'flex', gap: 12, paddingBottom: 16, position: 'relative' }}>
                          <div style={{
                            width: 10, height: 10,
                            borderRadius: '50%',
                            background: 'var(--color-primary)',
                            marginTop: 5, flexShrink: 0,
                            zIndex: 1,
                          }} />
                          {i < statusHistory.length - 1 && (
                            <div style={{ position: 'absolute', left: 4.5, top: 14, bottom: 0, width: 1, background: 'var(--color-border)' }} />
                          )}
                          <div>
                            <div className="text-sm">
                              <span className="text-muted">{h.old_status || '—'}</span>
                              <span style={{ margin: '0 6px', color: 'var(--color-text-dim)' }}>→</span>
                              <StatusBadge status={h.new_status} />
                            </div>
                            <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                              {formatDate(h.changed_at)} · by {h.users?.username}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Modal */}
        {paymentModal && (
          <div className="modal-overlay" onClick={() => setPaymentModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Record Payment</h3>
                <button className="btn btn-sm btn-secondary btn-icon" onClick={() => setPaymentModal(false)}>✕</button>
              </div>

              <div style={{ marginBottom: 16, padding: 16, background: 'var(--color-surface-2)', borderRadius: 8 }}>
                <div className="flex-between">
                  <span className="text-sm text-muted">Balance Due</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-warning)' }}>{formatCurrency(order.balance_due)}</span>
                </div>
              </div>

              <form onSubmit={handlePayment} className="flex-col gap-4">
                {payError && <div className="alert alert-error" style={{ fontSize: 13 }}>{payError}</div>}

                <div className="form-group">
                  <label className="form-label required">Payment Amount (₱)</label>
                  <input
                    type="number" min="0.01" step="0.01"
                    className="form-input"
                    placeholder="0.00"
                    value={payForm.amount}
                    onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label className="form-label required">Payment Method</label>
                  <select
                    className="form-select"
                    value={payForm.method}
                    onChange={e => setPayForm(f => ({ ...f, method: e.target.value }))}
                  >
                    <option value="cash">Cash</option>
                    <option value="ewallet">E-wallet</option>
                  </select>
                </div>

                {payForm.method === 'ewallet' && (
                  <div className="form-group">
                    <label className="form-label required">E-wallet Reference Number</label>
                    <input
                      type="text" className="form-input"
                      placeholder="Transaction reference"
                      value={payForm.ewalletRef}
                      onChange={e => setPayForm(f => ({ ...f, ewalletRef: e.target.value }))}
                    />
                  </div>
                )}

                <div className="flex gap-3 mt-4">
                  <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setPaymentModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Confirm Payment</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Void Modal */}
        {voidModal && (
          <VoidModal payment={voidModal} onConfirm={handleVoid} onClose={() => setVoidModal(null)} />
        )}
      </main>
    </div>
  )
}

function VoidModal({ payment, onConfirm, onClose }) {
  const [reason, setReason] = useState('')
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Void Payment</h3>
          <button className="btn btn-sm btn-secondary btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="alert alert-warning" style={{ marginBottom: 16 }}>
          This action cannot be undone. The payment of ₱{parseFloat(payment.amount).toFixed(2)} will be marked as voided.
        </div>
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label required">Reason for voiding</label>
          <textarea className="form-textarea" value={reason} onChange={e => setReason(e.target.value)} placeholder="Explain why this payment is being voided…" />
        </div>
        <div className="flex gap-3">
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button
            className="btn btn-danger"
            style={{ flex: 1 }}
            disabled={!reason.trim()}
            onClick={() => onConfirm(payment.id, reason)}
          >
            Void Payment
          </button>
        </div>
      </div>
    </div>
  )
}
