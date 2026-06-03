import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../../components/Sidebar'
import FileUploader from '../../components/FileUploader'
import { supabase } from '../../lib/supabase'
import api from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'
import { format, addDays } from 'date-fns'

const JOB_TYPES = ['Tarpaulin', 'Jersey', 'Intra-board', 'Sticker', 'Sintra Board', 'One-Way Vision', 'Canvas Print', 'Other']
const MATERIAL_TYPES = ['Standard', 'Premium', 'Backlit', 'Matte', 'Glossy', 'Fabric']
const PAYMENT_METHODS = [{ value: 'cash', label: 'Cash' }, { value: 'ewallet', label: 'E-wallet' }]

export default function NewOrder() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})

  // Form state
  const [form, setForm] = useState({
    customerName: '',
    contactNumber: '',
    email: '',
    jobType: '',
    dimensions: '',
    width: '',
    height: '',
    materialType: '',
    quantity: '',
    paymentType: 'full',      // full | downpayment
    paymentMethod: 'cash',
    paymentAmount: '',
    ewalletRef: '',
    estimatedPickupDate: format(addDays(new Date(), 3), 'yyyy-MM-dd'),
    notes: '',
    needsLayout: false,
  })
  const [file, setFile] = useState(null)
  const [computedPrice, setComputedPrice] = useState(null)
  const [priceError, setPriceError] = useState(null)
  const [priceLoading, setPriceLoading] = useState(false)
  const [existingCustomer, setExistingCustomer] = useState(null)
  const [customerChecked, setCustomerChecked] = useState(false)

  function setField(name, value) {
    setForm(f => ({ ...f, [name]: value }))
    setErrors(e => ({ ...e, [name]: '' }))
  }

  // Check for existing customer
  async function checkExistingCustomer() {
    if (!form.customerName.trim() || !form.contactNumber.trim()) return
    setCustomerChecked(false)
    const { data } = await supabase
      .from('customers')
      .select('id, name, contact_number, email')
      .ilike('name', form.customerName.trim())
      .eq('contact_number', form.contactNumber.trim())
      .limit(1)
    if (data && data.length > 0) {
      setExistingCustomer(data[0])
    } else {
      setExistingCustomer(null)
    }
    setCustomerChecked(true)
  }

  // Calculate price when specs change
  useEffect(() => {
    const { jobType, materialType, width, height, quantity, needsLayout } = form
    if (!jobType || !materialType || !width || !height || !quantity) {
      setComputedPrice(null)
      setPriceError(null)
      return
    }
    const timer = setTimeout(async () => {
      setPriceLoading(true)
      setPriceError(null)
      try {
        const { data } = await api.post('/api/pricing/calculate', {
          jobType, materialType,
          width: parseFloat(width),
          height: parseFloat(height),
          quantity: parseInt(quantity),
          needsLayout,
        })
        setComputedPrice(data.total_cost)
      } catch (err) {
        setComputedPrice(null)
        setPriceError(err.message || 'Cannot calculate price')
      } finally {
        setPriceLoading(false)
      }
    }, 600)
    return () => clearTimeout(timer)
  }, [form.jobType, form.materialType, form.width, form.height, form.quantity, form.needsLayout])

  function validate() {
    const e = {}
    if (!form.customerName.trim()) e.customerName = 'Customer name is required'
    if (!form.contactNumber.trim()) e.contactNumber = 'Contact number is required'
    if (!form.jobType) e.jobType = 'Job type is required'
    if (!form.materialType) e.materialType = 'Material type is required'
    if (!form.width || !form.height) e.dimensions = 'Width and height are required'
    if (!form.quantity || parseInt(form.quantity) < 1) e.quantity = 'Quantity must be at least 1'
    if (computedPrice === null) {
      e.price = priceError || 'Cannot calculate price — please enter all specifications'
    }
    if (!form.paymentAmount || parseFloat(form.paymentAmount) <= 0) e.paymentAmount = 'Payment amount is required'
    if (computedPrice !== null && parseFloat(form.paymentAmount) > computedPrice) {
      e.paymentAmount = `Amount entered exceeds the outstanding balance of ₱${computedPrice.toFixed(2)}. Please enter a valid amount.`
    }
    if (!file && !form.needsLayout) e.file = 'Please attach a layout file or mark as "File to be submitted later"'
    if (!form.estimatedPickupDate) e.estimatedPickupDate = 'Estimated pickup date is required'
    if (form.paymentMethod === 'ewallet' && !form.ewalletRef.trim()) e.ewalletRef = 'E-wallet reference number is required'
    return e
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      // Scroll to first error
      const firstErr = document.querySelector('.form-input.error, .form-select.error')
      firstErr?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    setLoading(true)
    try {
      // Prepare form data (multipart for file)
      const fd = new FormData()
      fd.append('customerName', form.customerName.trim())
      fd.append('contactNumber', form.contactNumber.trim())
      fd.append('email', form.email.trim())
      fd.append('existingCustomerId', existingCustomer?.id || '')
      fd.append('jobType', form.jobType)
      fd.append('dimensions', `${form.width}ft × ${form.height}ft`)
      fd.append('width', form.width)
      fd.append('height', form.height)
      fd.append('materialType', form.materialType)
      fd.append('quantity', form.quantity)
      fd.append('totalCost', computedPrice)
      fd.append('paymentType', form.paymentType)
      fd.append('paymentMethod', form.paymentMethod)
      fd.append('paymentAmount', form.paymentAmount)
      fd.append('ewalletRef', form.ewalletRef)
      fd.append('estimatedPickupDate', form.estimatedPickupDate)
      fd.append('notes', form.notes)
      if (file && file !== 'pending') fd.append('file', file)
      fd.append('filePending', file === 'pending' ? 'true' : 'false')
      fd.append('needsLayout', form.needsLayout ? 'true' : 'false')

      const { data } = await api.post('/api/orders', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      navigate(`/staff/orders/${data.order.id}/claim-stub`, { state: { order: data.order } })
    } catch (err) {
      setErrors({ submit: err.message })
    } finally {
      setLoading(false)
    }
  }

  const balanceDue = computedPrice !== null
    ? Math.max(0, computedPrice - parseFloat(form.paymentAmount || 0))
    : null

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div>
            <h1>New Order</h1>
            <p className="subtitle">Fill in the customer's order details below</p>
          </div>
          <button className="btn btn-secondary" onClick={() => navigate('/staff')}>Cancel</button>
        </div>

        <div className="page-body" style={{ maxWidth: 900 }}>
          <form onSubmit={handleSubmit} className="flex-col gap-6" noValidate>

            {errors.submit && (
              <div className="alert alert-error">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {errors.submit}
              </div>
            )}

            {/* Customer Information */}
            <div className="card">
              <div className="card-header"><h2>Customer Information</h2></div>
              <div className="card-body form-section">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label required" htmlFor="customer-name">Customer Name</label>
                    <input
                      id="customer-name"
                      type="text"
                      className={`form-input ${errors.customerName ? 'error' : ''}`}
                      placeholder="Full name"
                      value={form.customerName}
                      onChange={e => setField('customerName', e.target.value)}
                      onBlur={checkExistingCustomer}
                    />
                    {errors.customerName && <div className="form-error">{errors.customerName}</div>}
                  </div>
                  <div className="form-group">
                    <label className="form-label required" htmlFor="contact-number">Contact Number</label>
                    <input
                      id="contact-number"
                      type="tel"
                      className={`form-input ${errors.contactNumber ? 'error' : ''}`}
                      placeholder="09XX-XXX-XXXX"
                      value={form.contactNumber}
                      onChange={e => setField('contactNumber', e.target.value)}
                      onBlur={checkExistingCustomer}
                    />
                    {errors.contactNumber && <div className="form-error">{errors.contactNumber}</div>}
                  </div>
                </div>

                {existingCustomer && customerChecked && (
                  <div className="alert alert-info">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
                    </svg>
                    Existing customer found: <strong>{existingCustomer.name}</strong>. This order will be linked to their profile.
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" htmlFor="email">Email (optional)</label>
                  <input
                    id="email"
                    type="email"
                    className="form-input"
                    placeholder="customer@email.com"
                    value={form.email}
                    onChange={e => setField('email', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Job Specifications */}
            <div className="card">
              <div className="card-header"><h2>Job Specifications</h2></div>
              <div className="card-body form-section">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label required" htmlFor="job-type">Job Type</label>
                    <select
                      id="job-type"
                      className={`form-select ${errors.jobType ? 'error' : ''}`}
                      value={form.jobType}
                      onChange={e => setField('jobType', e.target.value)}
                    >
                      <option value="">Select job type…</option>
                      {JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {errors.jobType && <div className="form-error">{errors.jobType}</div>}
                  </div>
                  <div className="form-group">
                    <label className="form-label required" htmlFor="material-type">Material Type</label>
                    <select
                      id="material-type"
                      className={`form-select ${errors.materialType ? 'error' : ''}`}
                      value={form.materialType}
                      onChange={e => setField('materialType', e.target.value)}
                    >
                      <option value="">Select material…</option>
                      {MATERIAL_TYPES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    {errors.materialType && <div className="form-error">{errors.materialType}</div>}
                  </div>
                </div>

                <div className="form-section-title">Dimensions &amp; Quantity</div>
                <div className="form-row-3">
                  <div className="form-group">
                    <label className="form-label required" htmlFor="width">Width (feet)</label>
                    <input
                      id="width"
                      type="number"
                      min="0.01" step="0.01"
                      className={`form-input ${errors.dimensions ? 'error' : ''}`}
                      placeholder="e.g. 2"
                      value={form.width}
                      onChange={e => setField('width', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label required" htmlFor="height">Height (feet)</label>
                    <input
                      id="height"
                      type="number"
                      min="0.01" step="0.01"
                      className={`form-input ${errors.dimensions ? 'error' : ''}`}
                      placeholder="e.g. 3"
                      value={form.height}
                      onChange={e => setField('height', e.target.value)}
                    />
                    {errors.dimensions && <div className="form-error">{errors.dimensions}</div>}
                  </div>
                  <div className="form-group">
                    <label className="form-label required" htmlFor="quantity">Quantity</label>
                    <input
                      id="quantity"
                      type="number"
                      min="1" step="1"
                      className={`form-input ${errors.quantity ? 'error' : ''}`}
                      placeholder="1"
                      value={form.quantity}
                      onChange={e => setField('quantity', e.target.value)}
                    />
                    {errors.quantity && <div className="form-error">{errors.quantity}</div>}
                  </div>
                </div>

                {/* Price Display */}
                <div style={{
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius)',
                  padding: 'var(--space-5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <div>
                    <div className="text-xs text-muted font-semibold" style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Computed Total Cost
                    </div>
                    {(errors.price || priceError) && (
                      <div className="form-error" style={{ maxWidth: 400 }}>{errors.price || priceError}</div>
                    )}
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-primary)', letterSpacing: '-1px' }}>
                    {priceLoading ? (
                      <div className="spinner-sm" style={{ borderTopColor: 'var(--color-primary)', borderColor: 'var(--color-border)' }} />
                    ) : computedPrice !== null ? (
                      `₱${computedPrice.toFixed(2)}`
                    ) : (
                      <span style={{ fontSize: 14, color: 'var(--color-warning)', fontWeight: 500 }}>
                        {priceError ? 'Calculation Failed' : 'Enter specs to calculate'}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, marginBottom: 12 }}>
                  <input
                    type="checkbox"
                    id="needs-layout"
                    checked={form.needsLayout}
                    onChange={(e) => setField('needsLayout', e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                  />
                  <label htmlFor="needs-layout" className="text-sm font-semibold" style={{ cursor: 'pointer', color: 'var(--color-text)' }}>
                    No layout provided / Need layout creation (+₱180.00 flat fee)
                  </label>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="notes">Special Instructions (optional)</label>
                  <textarea
                    id="notes"
                    className="form-textarea"
                    placeholder="Any special instructions for the designer…"
                    value={form.notes}
                    onChange={e => setField('notes', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Layout File */}
            <div className="card">
              <div className="card-header"><h2>Layout File</h2></div>
              <div className="card-body">
                <FileUploader onFileSelect={setFile} error={errors.file} />
              </div>
            </div>

            {/* Payment */}
            <div className="card">
              <div className="card-header"><h2>Payment</h2></div>
              <div className="card-body form-section">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label required">Payment Type</label>
                    <div className="flex gap-3">
                      {[{v:'full',l:'Full Payment'},{v:'downpayment',l:'Downpayment'}].map(({v,l}) => (
                        <label key={v} style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', padding:'10px 16px', background: form.paymentType===v ? 'var(--color-primary-dim)' : 'var(--color-surface-2)', border:`1.5px solid ${form.paymentType===v ? 'var(--color-primary)' : 'var(--color-border)'}`, borderRadius:'var(--radius-sm)', flex:1 }}>
                          <input type="radio" name="paymentType" value={v} checked={form.paymentType===v} onChange={() => setField('paymentType', v)} style={{ accentColor: 'var(--color-primary)' }}/>
                          <span className="text-sm font-semibold">{l}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label required" htmlFor="payment-method">Payment Method</label>
                    <select
                      id="payment-method"
                      className="form-select"
                      value={form.paymentMethod}
                      onChange={e => setField('paymentMethod', e.target.value)}
                    >
                      {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                </div>

                {form.paymentMethod === 'ewallet' && (
                  <div className="form-group">
                    <label className="form-label required" htmlFor="ewallet-ref">E-wallet Reference Number</label>
                    <input
                      id="ewallet-ref"
                      type="text"
                      className={`form-input ${errors.ewalletRef ? 'error' : ''}`}
                      placeholder="Transaction reference number"
                      value={form.ewalletRef}
                      onChange={e => setField('ewalletRef', e.target.value)}
                    />
                    {errors.ewalletRef && <div className="form-error">{errors.ewalletRef}</div>}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label required" htmlFor="payment-amount">Amount Received (₱)</label>
                  <input
                    id="payment-amount"
                    type="number"
                    min="0" step="0.01"
                    className={`form-input ${errors.paymentAmount ? 'error' : ''}`}
                    placeholder="0.00"
                    value={form.paymentAmount}
                    onChange={e => setField('paymentAmount', e.target.value)}
                  />
                  {errors.paymentAmount && <div className="form-error">{errors.paymentAmount}</div>}
                </div>

                {/* Balance Summary */}
                {computedPrice !== null && (
                  <div style={{ background: 'var(--color-surface-2)', borderRadius: 'var(--radius)', padding: 'var(--space-5)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid var(--color-border)', marginBottom: 8 }}>
                      <span className="text-sm text-muted">Total Cost</span>
                      <span className="font-semibold">₱{computedPrice.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid var(--color-border)', marginBottom: 8 }}>
                      <span className="text-sm text-muted">Amount Paid</span>
                      <span className="font-semibold">₱{parseFloat(form.paymentAmount || 0).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="text-sm font-bold">Balance Due</span>
                      <span style={{ fontSize: 20, fontWeight: 800, color: balanceDue > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                        ₱{(balanceDue || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label required" htmlFor="pickup-date">Estimated Pickup Date</label>
                  <input
                    id="pickup-date"
                    type="date"
                    className={`form-input ${errors.estimatedPickupDate ? 'error' : ''}`}
                    value={form.estimatedPickupDate}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    onChange={e => setField('estimatedPickupDate', e.target.value)}
                  />
                  {errors.estimatedPickupDate && <div className="form-error">{errors.estimatedPickupDate}</div>}
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="form-actions flex gap-4" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary btn-lg" onClick={() => navigate('/staff')}>
                Cancel
              </button>
              <button
                id="confirm-order-btn"
                type="submit"
                className={`btn btn-primary btn-lg ${loading ? 'btn-loading' : ''}`}
                disabled={loading}
              >
                {!loading && (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <path d="M20 6 9 17l-5-5"/>
                    </svg>
                    Confirm Order
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
