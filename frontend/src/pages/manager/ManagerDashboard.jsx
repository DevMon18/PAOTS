import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Sidebar from '../../components/Sidebar'
import StatusBadge from '../../components/StatusBadge'
import { format, startOfDay, endOfDay, subDays } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

const STATUS_COLORS = {
  received: '#7c3aed', designing: '#2563eb', printing: '#d97706', ready: '#16a34a', collected: '#64748b'
}

export default function ManagerDashboard() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [orders, setOrders] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [chartData, setChartData] = useState([])

  async function fetchData(date) {
    setLoading(true)
    const start = startOfDay(new Date(date)).toISOString()
    const end = endOfDay(new Date(date)).toISOString()

    const [{ data: ordersData }, { data: paymentsData }] = await Promise.all([
      supabase
        .from('orders')
        .select('id, tracking_id, status, total_cost, balance_due, created_at, job_type, customers(name)')
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false }),
      supabase
        .from('payments')
        .select('id, amount, payment_method, payment_status, transaction_date, is_voided, orders(tracking_id, customers(name))')
        .gte('transaction_date', start)
        .lte('transaction_date', end)
        .eq('is_voided', false),
    ])

    setOrders(ordersData || [])
    setPayments(paymentsData || [])

    // Build 7-day chart
    const last7 = await Promise.all(
      Array.from({ length: 7 }).map(async (_, i) => {
        const d = subDays(new Date(date), 6 - i)
        const s = startOfDay(d).toISOString()
        const e = endOfDay(d).toISOString()
        const { data } = await supabase.from('payments').select('amount').gte('transaction_date', s).lte('transaction_date', e).eq('is_voided', false)
        const rev = (data || []).reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)
        return { day: format(d, 'EEE'), revenue: rev }
      })
    )
    setChartData(last7)
    setLoading(false)
  }

  useEffect(() => { fetchData(selectedDate) }, [selectedDate])

  // Auto-refresh every 60 seconds (FR-10)
  useEffect(() => {
    const interval = setInterval(() => fetchData(selectedDate), 60000)
    return () => clearInterval(interval)
  }, [selectedDate])

  const totalRevenue = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)
  const byStatus = orders.reduce((acc, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc }, {})
  const statusChartData = Object.entries(byStatus).map(([status, count]) => ({ status, count }))

  function exportPDF() {
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text(`PAOTS Daily Report — ${format(new Date(selectedDate), 'MMMM d, yyyy')}`, 14, 20)
    doc.setFontSize(11)
    doc.text(`Total Orders: ${orders.length}   Total Revenue: ₱${totalRevenue.toFixed(2)}`, 14, 30)

    autoTable(doc, {
      startY: 38,
      head: [['Tracking ID', 'Customer', 'Job Type', 'Status', 'Total', 'Balance']],
      body: orders.map(o => [
        o.tracking_id,
        o.customers?.name || '—',
        o.job_type,
        o.status.charAt(0).toUpperCase() + o.status.slice(1),
        `₱${parseFloat(o.total_cost).toFixed(2)}`,
        `₱${parseFloat(o.balance_due).toFixed(2)}`,
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [79, 110, 247] },
    })

    doc.save(`PAOTS_Report_${selectedDate}.pdf`)
  }

  function exportExcel() {
    const ws = XLSX.utils.json_to_sheet(orders.map(o => ({
      'Tracking ID': o.tracking_id,
      'Customer': o.customers?.name || '—',
      'Job Type': o.job_type,
      'Status': o.status,
      'Total Cost': parseFloat(o.total_cost).toFixed(2),
      'Balance Due': parseFloat(o.balance_due).toFixed(2),
      'Created': format(new Date(o.created_at), 'yyyy-MM-dd HH:mm'),
    })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Orders')

    const wsP = XLSX.utils.json_to_sheet(payments.map(p => ({
      'Order': p.orders?.tracking_id,
      'Customer': p.orders?.customers?.name,
      'Amount': parseFloat(p.amount).toFixed(2),
      'Method': p.payment_method,
      'Status': p.payment_status,
      'Date': format(new Date(p.transaction_date), 'yyyy-MM-dd HH:mm'),
    })))
    XLSX.utils.book_append_sheet(wb, wsP, 'Payments')
    XLSX.writeFile(wb, `PAOTS_Report_${selectedDate}.xlsx`)
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div>
            <h1>Manager Dashboard</h1>
            <p className="subtitle">Daily operations overview &amp; reporting</p>
          </div>
          <div className="flex gap-3" style={{ alignItems: 'center' }}>
            <input
              type="date"
              className="form-input"
              style={{ width: 'auto' }}
              value={selectedDate}
              max={format(new Date(), 'yyyy-MM-dd')}
              onChange={e => setSelectedDate(e.target.value)}
            />
            <button id="export-pdf-btn" className="btn btn-secondary" onClick={exportPDF}>📄 PDF</button>
            <button id="export-excel-btn" className="btn btn-secondary" onClick={exportExcel}>📊 Excel</button>
          </div>
        </div>

        <div className="page-body">
          {loading ? (
            <div className="flex-center" style={{ padding: 80 }}><div className="spinner" /></div>
          ) : (
            <>
              {/* Stats */}
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">Total Orders</div>
                  <div className="stat-value accent">{orders.length}</div>
                  <div className="stat-sub">for {format(new Date(selectedDate), 'MMM d')}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Revenue Collected</div>
                  <div className="stat-value success">₱{totalRevenue.toFixed(2)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Ready for Pickup</div>
                  <div className="stat-value warning">{byStatus.ready || 0}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Completed</div>
                  <div className="stat-value">{byStatus.collected || 0}</div>
                </div>
              </div>

              <div className="grid-2 mb-6">
                {/* Revenue chart */}
                <div className="card">
                  <div className="card-header"><h2>7-Day Revenue</h2></div>
                  <div className="card-body">
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={chartData} barSize={28}>
                        <XAxis dataKey="day" tick={{ fill: '#9098b5', fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#9098b5', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₱${v}`} />
                        <Tooltip
                          contentStyle={{ background: '#1a1d27', border: '1px solid #363b52', borderRadius: 8, fontSize: 13 }}
                          formatter={v => [`₱${v.toFixed(2)}`, 'Revenue']}
                          cursor={{ fill: 'rgba(79,110,247,0.08)' }}
                        />
                        <Bar dataKey="revenue" fill="#4f6ef7" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Orders by status */}
                <div className="card">
                  <div className="card-header"><h2>Orders by Status</h2></div>
                  <div className="card-body">
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={statusChartData} barSize={32}>
                        <XAxis dataKey="status" tick={{ fill: '#9098b5', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#9098b5', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{ background: '#1a1d27', border: '1px solid #363b52', borderRadius: 8, fontSize: 13 }}
                          cursor={{ fill: 'rgba(79,110,247,0.08)' }}
                        />
                        <Bar dataKey="count" radius={[4,4,0,0]}>
                          {statusChartData.map((entry) => (
                            <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || '#4f6ef7'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Orders Table */}
              <div className="card">
                <div className="card-header">
                  <h2>Orders — {format(new Date(selectedDate), 'MMMM d, yyyy')}</h2>
                </div>
                <div className="table-wrapper">
                  {orders.length === 0 ? (
                    <div className="empty-state">
                      <h3>No orders for this date</h3>
                      <p>Select a different date to view orders.</p>
                    </div>
                  ) : (
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Tracking ID</th>
                          <th>Customer</th>
                          <th>Job Type</th>
                          <th>Status</th>
                          <th>Total</th>
                          <th>Balance</th>
                          <th>Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.map(o => (
                          <tr key={o.id} onClick={() => window.open(`/staff/orders/${o.id}`, '_blank')}>
                            <td><span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-primary)', fontSize: 13 }}>{o.tracking_id}</span></td>
                            <td className="font-semibold">{o.customers?.name}</td>
                            <td>{o.job_type}</td>
                            <td><StatusBadge status={o.status} /></td>
                            <td className="font-semibold">₱{parseFloat(o.total_cost).toFixed(2)}</td>
                            <td style={{ color: parseFloat(o.balance_due) > 0 ? 'var(--color-warning)' : 'var(--color-success)', fontWeight: 700 }}>
                              ₱{parseFloat(o.balance_due).toFixed(2)}
                            </td>
                            <td className="muted text-sm">{format(new Date(o.created_at), 'h:mm a')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Quick links */}
              <div className="flex gap-4 mt-6">
                <Link to="/manager/inventory" className="btn btn-secondary">📦 Manage Inventory</Link>
                <Link to="/manager/users" className="btn btn-secondary">👥 Manage Users</Link>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
