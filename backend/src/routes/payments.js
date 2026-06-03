import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { supabase } from '../lib/supabase.js'

export const paymentsRouter = Router()

// POST /api/payments — record a payment (atomic)
paymentsRouter.post('/', requireAuth, requireRole('staff', 'manager'), async (req, res, next) => {
  try {
    const { orderId, amount, paymentMethod, ewalletRef } = req.body

    if (!orderId) throw Object.assign(new Error('Order ID is required.'), { status: 422 })
    const parsedAmount = parseFloat(amount)
    if (!parsedAmount || parsedAmount <= 0) throw Object.assign(new Error('Payment amount must be greater than zero.'), { status: 422 })
    if (paymentMethod === 'ewallet' && !ewalletRef?.trim()) {
      throw Object.assign(new Error('E-wallet reference number is required.'), { status: 422 })
    }

    // Fetch current order to validate balance (with lock via select for update)
    const { data: order, error: fetchErr } = await supabase
      .from('orders')
      .select('id, total_cost, balance_due, updated_at')
      .eq('id', orderId)
      .single()

    if (fetchErr || !order) throw Object.assign(new Error('Order not found.'), { status: 404 })

    const currentBalance = parseFloat(order.balance_due)

    const actualRecordedAmount = Math.min(currentBalance, parsedAmount)
    const newBalance = Math.round((currentBalance - actualRecordedAmount) * 100) / 100
    const newPayStatus = newBalance <= 0 ? 'paid_full' : 'partial'

    // Atomic: update order balance + insert payment record
    const [{ error: orderErr }, { data: payment, error: payErr }] = await Promise.all([
      supabase.from('orders').update({
        balance_due: newBalance,
        payment_status: newPayStatus,
        updated_at: new Date().toISOString(),
      }).eq('id', orderId).eq('updated_at', order.updated_at), // optimistic lock (CON-03)
      supabase.from('payments').insert({
        order_id: orderId,
        amount: actualRecordedAmount,
        payment_method: paymentMethod || 'cash',
        ewallet_ref: paymentMethod === 'ewallet' ? ewalletRef : null,
        payment_status: newPayStatus,
        recorded_by: req.user.id,
        transaction_date: new Date().toISOString(),
      }).select('*').single(),
    ])

    if (orderErr) {
      throw Object.assign(
        new Error('This order was updated concurrently. Please refresh and try again.'),
        { status: 409 }
      )
    }
    if (payErr) throw payErr

    // Audit log
    await supabase.from('audit_log').insert({
      user_id: req.user.id,
      action: 'PAYMENT_RECORDED',
      target_table: 'payments',
      target_id: payment.id,
      details: { order_id: orderId, amount: parsedAmount, method: paymentMethod },
    })

    res.status(201).json({ payment, newBalance })
  } catch (err) {
    next(err)
  }
})

// POST /api/payments/:id/void — manager only
paymentsRouter.post('/:id/void', requireAuth, requireRole('manager'), async (req, res, next) => {
  try {
    const { id } = req.params
    const { reason } = req.body

    if (!reason?.trim()) throw Object.assign(new Error('A reason is required to void a payment.'), { status: 422 })

    const { data: payment, error: fetchErr } = await supabase
      .from('payments')
      .select('id, order_id, amount, is_voided, payment_status')
      .eq('id', id)
      .single()

    if (fetchErr || !payment) throw Object.assign(new Error('Payment not found.'), { status: 404 })
    if (payment.is_voided) throw Object.assign(new Error('This payment has already been voided.'), { status: 422 })

    // Soft-delete the payment
    await supabase.from('payments').update({
      is_voided: true,
      voided_by: req.user.id,
      void_reason: reason.trim(),
      voided_at: new Date().toISOString(),
    }).eq('id', id)

    // Restore balance on the order
    const { data: order } = await supabase.from('orders').select('balance_due, total_cost').eq('id', payment.order_id).single()
    const restoredBalance = Math.round((parseFloat(order.balance_due) + parseFloat(payment.amount)) * 100) / 100
    const newPayStatus = restoredBalance >= parseFloat(order.total_cost) ? 'downpayment' : 'partial'

    await supabase.from('orders').update({
      balance_due: restoredBalance,
      payment_status: newPayStatus,
    }).eq('id', payment.order_id)

    // Audit log
    await supabase.from('audit_log').insert({
      user_id: req.user.id,
      action: 'PAYMENT_VOIDED',
      target_table: 'payments',
      target_id: id,
      details: { reason, amount: payment.amount, order_id: payment.order_id },
    })

    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})
