import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { supabase } from '../lib/supabase.js'

export const statusRouter = Router()

// Valid status transition sequence
const STATUS_SEQUENCE = ['received', 'designing', 'printing', 'ready', 'collected']
const DESIGNER_CAN_SET = ['designing', 'printing', 'ready']
const STAFF_CAN_SET = ['collected']

// PATCH /api/orders/:id/status — validated status transition
statusRouter.patch('/:id/status', requireAuth, requireRole('designer', 'staff', 'manager'), async (req, res, next) => {
  try {
    const { id } = req.params
    const { newStatus } = req.body

    if (!newStatus || !STATUS_SEQUENCE.includes(newStatus)) {
      throw Object.assign(new Error(`Invalid status. Valid statuses: ${STATUS_SEQUENCE.join(', ')}`), { status: 422 })
    }

    // Fetch current order (with optimistic locking via updated_at)
    const { data: order, error: fetchErr } = await supabase
      .from('orders')
      .select('id, status, updated_at')
      .eq('id', id)
      .single()

    if (fetchErr || !order) throw Object.assign(new Error('Order not found.'), { status: 404 })

    const currentIdx = STATUS_SEQUENCE.indexOf(order.status)
    const nextIdx = STATUS_SEQUENCE.indexOf(newStatus)

    // Enforce sequential transitions (EH-05)
    if (nextIdx !== currentIdx + 1) {
      const expectedNext = STATUS_SEQUENCE[currentIdx + 1]
      throw Object.assign(
        new Error(`Invalid status change. The next valid status is "${expectedNext}".`),
        { status: 422 }
      )
    }

    // Role restrictions
    const userRole = req.userRole
    if (userRole === 'designer' && !DESIGNER_CAN_SET.includes(newStatus)) {
      throw Object.assign(new Error('Designers can only set status to Designing, Printing, or Ready.'), { status: 403 })
    }
    if (userRole === 'staff' && !STAFF_CAN_SET.includes(newStatus)) {
      throw Object.assign(new Error('Staff can only mark orders as Collected.'), { status: 403 })
    }

    // Atomic update with conflict detection (CON-01, CON-02)
    const { data: updated, error: updateErr } = await supabase
      .from('orders')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('updated_at', order.updated_at) // optimistic lock
      .select('id, status, updated_at')
      .single()

    if (updateErr || !updated) {
      // EH-06: Concurrent update detected
      throw Object.assign(
        new Error('This order was updated by someone else just now. Please refresh to see the latest status before continuing.'),
        { status: 409 }
      )
    }

    // Record status history
    await supabase.from('status_history').insert({
      order_id: id,
      old_status: order.status,
      new_status: newStatus,
      changed_by: req.user.id,
    })

    // Audit log
    await supabase.from('audit_log').insert({
      user_id: req.user.id,
      action: 'STATUS_CHANGED',
      target_table: 'orders',
      target_id: id,
      details: { from: order.status, to: newStatus },
    })

    res.json({ order: updated })
  } catch (err) {
    next(err)
  }
})
