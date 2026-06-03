import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { format } from 'date-fns'

export default function ClaimStub() {
  const { id } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()
  const [order, setOrder] = useState(state?.order || null)
  const [loading, setLoading] = useState(!state?.order)

  useEffect(() => {
    if (!state?.order) {
      supabase
        .from('orders')
        .select('*, customers(name, contact_number)')
        .eq('id', id)
        .single()
        .then(({ data }) => {
          setOrder(data)
          setLoading(false)
        })
    }
  }, [id, state])

  if (loading) return (
    <div className="flex-center" style={{ minHeight: '100vh' }}>
      <div className="spinner" />
    </div>
  )

  if (!order) return (
    <div className="flex-center" style={{ minHeight: '100vh', flexDirection: 'column', gap: 16 }}>
      <p>Order not found.</p>
      <button className="btn btn-secondary" onClick={() => navigate('/staff')}>Back to Dashboard</button>
    </div>
  )

  const formatCurrency = v => `₱${parseFloat(v || 0).toFixed(2)}`
  const amountPaid = parseFloat(order.total_cost) - parseFloat(order.balance_due)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32 }}>

      {/* Action buttons — hidden on print */}
      <div className="claim-stub-actions no-print flex gap-3" style={{ marginBottom: 24 }}>
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>← Back</button>
        <button
          id="print-claim-stub-btn"
          className="btn btn-primary"
          onClick={() => window.print()}
        >
          🖨 Print Claim Stub
        </button>
        <button className="btn btn-secondary" onClick={() => navigate('/staff')}>Go to Dashboard</button>
      </div>

      {/* Claim Stub */}
      <div className="claim-stub">
        <div className="claim-stub-header">
          <div style={{ fontSize: 13, opacity: 0.8, fontWeight: 600, marginBottom: 4 }}>OFFICIAL CLAIM STUB</div>
          <h2>Digital Print Shop</h2>
          <div style={{ opacity: 0.75, fontSize: 13, marginTop: 4 }}>
            Keep this stub to claim your order
          </div>
          <div className="claim-stub-tracking-screen">{order.tracking_id}</div>
        </div>

        <div className="claim-stub-body">
          <div className="claim-stub-row">
            <span className="claim-stub-key">Customer Name</span>
            <span className="claim-stub-val">{order.customers?.name || '—'}</span>
          </div>
          <div className="claim-stub-row">
            <span className="claim-stub-key">Contact Number</span>
            <span className="claim-stub-val">{order.customers?.contact_number || '—'}</span>
          </div>
          <div className="claim-stub-row">
            <span className="claim-stub-key">Job Type</span>
            <span className="claim-stub-val">{order.job_type}</span>
          </div>
          <div className="claim-stub-row">
            <span className="claim-stub-key">Dimensions</span>
            <span className="claim-stub-val">{order.dimensions}</span>
          </div>
          <div className="claim-stub-row">
            <span className="claim-stub-key">Quantity</span>
            <span className="claim-stub-val">{order.quantity}</span>
          </div>
          <div className="claim-stub-row">
            <span className="claim-stub-key">Total Cost</span>
            <span className="claim-stub-val">{formatCurrency(order.total_cost)}</span>
          </div>
          <div className="claim-stub-row">
            <span className="claim-stub-key">Amount Paid</span>
            <span className="claim-stub-val" style={{ color: 'var(--color-success)' }}>{formatCurrency(amountPaid)}</span>
          </div>
          <div className="claim-stub-row">
            <span className="claim-stub-key">Balance Due</span>
            <span className={`claim-stub-val ${parseFloat(order.balance_due) > 0 ? 'claim-stub-balance-due' : ''}`}>
              {formatCurrency(order.balance_due)}
            </span>
          </div>
          <div className="claim-stub-row">
            <span className="claim-stub-key">Estimated Pickup</span>
            <span className="claim-stub-val">
              {order.estimated_pickup_date
                ? format(new Date(order.estimated_pickup_date), 'MMMM d, yyyy')
                : '—'}
            </span>
          </div>
          <div className="claim-stub-row">
            <span className="claim-stub-key">Date Created</span>
            <span className="claim-stub-val">{format(new Date(order.created_at), 'MMM d, yyyy h:mm a')}</span>
          </div>
        </div>

        <div style={{ padding: '16px 24px', background: 'var(--color-surface-2)', textAlign: 'center' }}>
          <p className="text-xs text-muted">
            Please present this stub when claiming your order.<br />
            Your Tracking ID: <strong style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>{order.tracking_id}</strong>
          </p>
        </div>
      </div>
    </div>
  )
}
