import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Sidebar from '../../components/Sidebar'
import StatusBadge, { PaymentBadge } from '../../components/StatusBadge'
import { format } from 'date-fns'

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
)

const STATUS_ORDER = ['received', 'designing', 'printing', 'ready', 'collected']

export default function StaffDashboard() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('active') // active | all
  const [stats, setStats] = useState({ total: 0, ready: 0, todayRevenue: 0, pending: 0 })
  const [online, setOnline] = useState(navigator.onLine)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      let customerIds = []
      const searchTerm = search.trim()
      if (searchTerm) {
        const { data: matchedCustomers } = await supabase
          .from('customers')
          .select('id')
          .ilike('name', `%${searchTerm}%`)
        if (matchedCustomers && matchedCustomers.length > 0) {
          customerIds = matchedCustomers.map(c => c.id)
        }
      }

      let query = supabase
        .from('orders')
        .select(`
          id, tracking_id, status, created_at, updated_at,
          total_cost, balance_due, estimated_pickup_date,
          job_type, dimensions, quantity,
          customers(name, contact_number),
          payments(payment_status)
        `)
        .order('created_at', { ascending: false })

      if (filter === 'active') {
        query = query.not('status', 'eq', 'collected')
      } else if (filter === 'ready') {
        query = query.eq('status', 'ready')
      }

      if (searchTerm) {
        if (customerIds.length > 0) {
          const orCond = `tracking_id.ilike.%${searchTerm}%,${customerIds.map(id => `customer_id.eq.${id}`).join(',')}`
          query = query.or(orCond)
        } else {
          query = query.ilike('tracking_id', `%${searchTerm}%`)
        }
      }

      const { data, error } = await query.limit(100)
      if (error) throw error
      setOrders(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [filter, search])

  // Daily stats
  const fetchStats = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10)

    const [{ count: total }, { count: ready }, { data: payments }] = await Promise.all([
      supabase.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', today),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'ready'),
      supabase.from('payments').select('amount').gte('created_at', today).eq('is_voided', false),
    ])

    const todayRevenue = (payments || []).reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)
    const pending = (orders || []).filter(o => ['received','designing','printing'].includes(o.status)).length

    setStats({ total: total || 0, ready: ready || 0, todayRevenue, pending })
  }, [orders])

  useEffect(() => { fetchOrders() }, [fetchOrders])
  useEffect(() => { fetchStats() }, [fetchStats])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders()
        fetchStats()
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [fetchOrders, fetchStats])

  // Online/offline banner
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const formatCurrency = (v) => `₱${parseFloat(v || 0).toFixed(2)}`
  const formatDate = (d) => d ? format(new Date(d), 'MMM d, h:mm a') : '—'

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        {!online && (
          <div className="connection-banner">
            Unable to connect to the server. Please check your internet connection and try again.
          </div>
        )}

        <div className="page-header">
          <div>
            <h1>Staff Dashboard</h1>
            <p className="subtitle">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
          </div>
          <Link to="/staff/orders/new" id="new-order-btn" className="btn btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M12 5v14M5 12h14"/>
            </svg>
            New Order
          </Link>
        </div>

        <div className="page-body">
          {/* Stats */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Orders Today</div>
              <div className="stat-value accent">{stats.total}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Ready for Collection</div>
              <div className="stat-value success">{stats.ready}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">In Production</div>
              <div className="stat-value warning">{stats.pending}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Revenue Today</div>
              <div className="stat-value">{formatCurrency(stats.todayRevenue)}</div>
            </div>
          </div>

          {/* Orders Table */}
          <div className="card">
            <div className="card-header">
              <h2>Orders</h2>
              <div className="flex gap-3" style={{ alignItems: 'center' }}>
                {/* Filter tabs */}
                <div className="flex" style={{ background: 'var(--color-surface-2)', borderRadius: 8, padding: 3, gap: 2 }}>
                  <button
                    className={`btn btn-sm ${filter === 'active' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ border: 'none' }}
                    onClick={() => setFilter('active')}
                  >
                    Active
                  </button>
                  <button
                    className={`btn btn-sm ${filter === 'ready' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ border: 'none' }}
                    onClick={() => setFilter('ready')}
                  >
                    Ready (Unclaimed)
                  </button>
                  <button
                    className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ border: 'none' }}
                    onClick={() => setFilter('all')}
                  >
                    All
                  </button>
                </div>

                {/* Search */}
                <div className="search-wrapper">
                  <SearchIcon />
                  <input
                    id="order-search"
                    type="text"
                    className="search-input"
                    placeholder="Search by name or Tracking ID…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="table-wrapper">
              {loading ? (
                <div className="flex-center" style={{ padding: '60px' }}>
                  <div className="spinner" />
                </div>
              ) : orders.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
                      <rect x="9" y="3" width="6" height="4" rx="1"/>
                    </svg>
                  </div>
                  <h3>
                    {search ? `No orders found matching "${search}"` : 'No orders yet'}
                  </h3>
                  <p>
                    {search
                      ? 'Check the spelling or try a Tracking ID search.'
                      : 'Create the first order using the New Order button above.'}
                  </p>
                </div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Tracking ID</th>
                      <th>Customer</th>
                      <th>Job Type</th>
                      <th>Status</th>
                      <th>Payment</th>
                      <th>Balance Due</th>
                      <th>Pickup Date</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(order => (
                      <tr
                        key={order.id}
                        onClick={() => navigate(`/staff/orders/${order.id}`)}
                      >
                        <td>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-primary)', fontSize: 13 }}>
                            {order.tracking_id}
                          </span>
                        </td>
                        <td>
                          <div className="font-semibold">{order.customers?.name || '—'}</div>
                          <div className="text-xs text-muted">{order.customers?.contact_number}</div>
                        </td>
                        <td>
                          <div className="text-sm">{order.job_type}</div>
                          <div className="text-xs text-muted">{order.dimensions} · qty {order.quantity}</div>
                        </td>
                        <td><StatusBadge status={order.status} /></td>
                        <td>
                          {order.payments?.[0] && <PaymentBadge status={order.payments[0].payment_status} />}
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, color: parseFloat(order.balance_due) > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                            {formatCurrency(order.balance_due)}
                          </span>
                        </td>
                        <td className="muted text-sm">
                          {order.estimated_pickup_date
                            ? format(new Date(order.estimated_pickup_date), 'MMM d, yyyy')
                            : '—'}
                        </td>
                        <td className="muted text-sm">{formatDate(order.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
