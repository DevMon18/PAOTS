import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Sidebar from '../../components/Sidebar'
import StatusBadge from '../../components/StatusBadge'
import api from '../../lib/api'
import { format, formatDistanceToNow } from 'date-fns'

export default function DesignerQueue() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState(null)

  const NEXT_STATUS = { received: 'Designing', designing: 'Printing', printing: 'Ready' }

  const fetchQueue = useCallback(async () => {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id, tracking_id, status, created_at, job_type, dimensions, material_type, quantity, notes,
        customers(name, contact_number),
        file_attachments(id, original_filename, storage_path)
      `)
      .in('status', ['received', 'designing', 'printing'])
      .order('created_at', { ascending: true }) // oldest first
    if (!error) setOrders(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchQueue() }, [fetchQueue])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('designer-queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchQueue)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [fetchQueue])

  async function advanceStatus(e, order) {
    e.stopPropagation()
    const next = NEXT_STATUS[order.status]
    if (!next) return
    setUpdatingId(order.id)
    try {
      await api.patch(`/api/orders/${order.id}/status`, { newStatus: next.toLowerCase() })
      await fetchQueue()
    } catch (err) {
      alert(err.message)
    } finally {
      setUpdatingId(null)
    }
  }

  const byStatus = {
    received: orders.filter(o => o.status === 'received'),
    designing: orders.filter(o => o.status === 'designing'),
    printing: orders.filter(o => o.status === 'printing'),
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div>
            <h1>Design Queue</h1>
            <p className="subtitle">{orders.length} active order{orders.length !== 1 ? 's' : ''} · sorted oldest first</p>
          </div>
          <div className="flex gap-3">
            <div style={{ padding: '8px 16px', background: 'rgba(124,58,237,0.15)', borderRadius: 8, color: '#a78bfa', fontSize: 13, fontWeight: 600 }}>
              {byStatus.received.length} Received
            </div>
            <div style={{ padding: '8px 16px', background: 'rgba(37,99,235,0.15)', borderRadius: 8, color: '#60a5fa', fontSize: 13, fontWeight: 600 }}>
              {byStatus.designing.length} Designing
            </div>
            <div style={{ padding: '8px 16px', background: 'rgba(217,119,6,0.15)', borderRadius: 8, color: '#fbbf24', fontSize: 13, fontWeight: 600 }}>
              {byStatus.printing.length} Printing
            </div>
          </div>
        </div>

        <div className="page-body">
          {loading ? (
            <div className="flex-center" style={{ padding: 80 }}><div className="spinner" /></div>
          ) : orders.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
                  <rect x="9" y="3" width="6" height="4" rx="1"/>
                  <path d="m9 12 2 2 4-4"/>
                </svg>
              </div>
              <h3>No orders in queue</h3>
              <p>All orders have been completed. Great work! New orders will appear here in real time.</p>
            </div>
          ) : (
            <div className="flex-col gap-3" id="designer-queue-list">
              {orders.map(order => {
                const hasFile = order.file_attachments?.length > 0
                const isOld = (Date.now() - new Date(order.created_at)) > 24 * 60 * 60 * 1000

                return (
                  <div
                    key={order.id}
                    className={`order-queue-item ${isOld && order.status === 'received' ? 'urgent' : ''}`}
                    onClick={() => navigate(`/designer/orders/${order.id}`)}
                  >
                    {/* Status indicator */}
                    <div style={{
                      width: 4, height: 60, borderRadius: 4, flexShrink: 0,
                      background: {received:'#7c3aed',designing:'#2563eb',printing:'#d97706'}[order.status],
                    }} />

                    {/* Main info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="flex gap-3" style={{ alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-primary)', fontSize: 13 }}>
                          {order.tracking_id}
                        </span>
                        <StatusBadge status={order.status} />
                        {isOld && order.status === 'received' && (
                          <span style={{ background: 'rgba(217,119,6,0.15)', color: '#fbbf24', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
                            WAITING {formatDistanceToNow(new Date(order.created_at))}
                          </span>
                        )}
                      </div>
                      <div className="font-semibold">{order.customers?.name}</div>
                      <div className="text-sm text-muted">
                        {order.job_type} · {order.dimensions} · qty {order.quantity} · {order.material_type}
                      </div>
                      {order.notes && (
                        <div className="text-xs" style={{ marginTop: 4, color: 'var(--color-warning)', fontStyle: 'italic' }}>
                          ⚠ {order.notes}
                        </div>
                      )}
                    </div>

                    {/* File status */}
                    <div className="flex-col" style={{ alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      <div style={{
                        width: 36, height: 36,
                        borderRadius: 8,
                        background: hasFile ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: hasFile ? '#22c55e' : '#ef4444',
                      }}>
                        {hasFile ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                            <path d="M20 6 9 17l-5-5"/>
                          </svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        )}
                      </div>
                      <span className="text-xs text-muted">{hasFile ? 'File ready' : 'No file'}</span>
                    </div>

                    {/* Advance button */}
                    {NEXT_STATUS[order.status] && (
                      <button
                        className={`btn btn-primary btn-sm ${updatingId === order.id ? 'btn-loading' : ''}`}
                        onClick={e => advanceStatus(e, order)}
                        disabled={updatingId === order.id}
                        style={{ flexShrink: 0 }}
                      >
                        {updatingId !== order.id && `→ ${NEXT_STATUS[order.status]}`}
                      </button>
                    )}

                    {/* Timestamp */}
                    <div className="text-xs text-muted" style={{ flexShrink: 0, textAlign: 'right', minWidth: 80 }}>
                      {format(new Date(order.created_at), 'MMM d')}<br/>
                      {format(new Date(order.created_at), 'h:mm a')}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
