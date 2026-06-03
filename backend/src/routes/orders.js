import { Router } from 'express'
import multer from 'multer'
import { createHash } from 'crypto'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { supabase } from '../lib/supabase.js'
import { generateTrackingId } from '../lib/trackingId.js'
import { calculatePrice } from '../lib/pricingEngine.js'

export const ordersRouter = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } })

const SUPPORTED_FORMATS = ['.pdf', '.psd', '.jpg', '.jpeg', '.png']
const SUPPORTED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/x-photoshop', 'application/photoshop', 'application/octet-stream']

// POST /api/orders — create order with tracking ID + file upload
ordersRouter.post('/', requireAuth, requireRole('staff', 'manager'), upload.single('file'), async (req, res, next) => {
  try {
    const {
      customerName, contactNumber, email, existingCustomerId,
      jobType, dimensions, width, height, materialType, quantity,
      paymentType, paymentMethod, paymentAmount, ewalletRef,
      estimatedPickupDate, notes, filePending, needsLayout
    } = req.body

    // Validate required fields
    if (!customerName?.trim()) throw Object.assign(new Error('Customer name is required'), { status: 422 })
    if (!contactNumber?.trim()) throw Object.assign(new Error('Contact number is required'), { status: 422 })
    if (!jobType) throw Object.assign(new Error('Job type is required'), { status: 422 })
    if (!materialType) throw Object.assign(new Error('Material type is required'), { status: 422 })

    // Validate numeric inputs defensively
    const parsedWidth = parseFloat(width)
    const parsedHeight = parseFloat(height)
    const parsedQuantity = parseInt(quantity)
    const parsedPaymentAmount = parseFloat(paymentAmount || 0)

    if (isNaN(parsedWidth) || parsedWidth <= 0) {
      throw Object.assign(new Error('Width must be a valid positive number'), { status: 422 })
    }
    if (isNaN(parsedHeight) || parsedHeight <= 0) {
      throw Object.assign(new Error('Height must be a valid positive number'), { status: 422 })
    }
    if (isNaN(parsedQuantity) || parsedQuantity < 1) {
      throw Object.assign(new Error('Quantity must be a valid integer >= 1'), { status: 422 })
    }
    if (isNaN(parsedPaymentAmount) || parsedPaymentAmount < 0) {
      throw Object.assign(new Error('Payment amount must be a valid non-negative number'), { status: 422 })
    }

    // Validate file if provided
    let fileBuffer = null
    let originalFilename = null
    let fileFormat = null
    let checksum = null

    if (req.file && filePending !== 'true') {
      const ext = '.' + req.file.originalname.split('.').pop().toLowerCase()
      if (!SUPPORTED_FORMATS.includes(ext)) {
        throw Object.assign(
          new Error(`This file type is not supported. Please upload a .pdf, .psd, .jpg, or .png file.`),
          { status: 422 }
        )
      }
      fileBuffer = req.file.buffer
      originalFilename = req.file.originalname
      fileFormat = ext
      // Compute SHA-256 checksum for integrity
      checksum = createHash('sha256').update(fileBuffer).digest('hex')
    }

    const parsedNeedsLayout = needsLayout === 'true' || needsLayout === true

    // Compute price server-side
    const totalCost = await calculatePrice({
      jobType, materialType,
      width: parsedWidth,
      height: parsedHeight,
      quantity: parsedQuantity,
      needsLayout: parsedNeedsLayout
    })

    if (totalCost >= 100000000) {
      throw Object.assign(
        new Error('Calculated total cost exceeds the maximum limit supported by the system (₱99,999,999.99).'),
        { status: 422 }
      )
    }

    if (parsedPaymentAmount > totalCost) {
      throw Object.assign(
        new Error(`Amount entered exceeds the outstanding balance of ₱${totalCost.toFixed(2)}. Please enter a valid amount.`),
        { status: 422 }
      )
    }
    const balanceDue = Math.round((totalCost - parsedPaymentAmount) * 100) / 100
    const payStatus = balanceDue === 0 ? 'paid_full' : parsedPaymentAmount > 0 ? 'downpayment' : 'downpayment'

    // Generate Tracking ID
    const trackingId = await generateTrackingId()

    // Upsert customer
    let customerId = existingCustomerId || null
    if (!customerId) {
      const { data: newCustomer, error: custErr } = await supabase
        .from('customers')
        .insert({ name: customerName.trim(), contact_number: contactNumber.trim(), email: email?.trim() || null })
        .select('id')
        .single()
      if (custErr) throw custErr
      customerId = newCustomer.id
    }

    // Create order
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        tracking_id: trackingId,
        customer_id: customerId,
        created_by: req.user.id,
        job_type: jobType,
        dimensions: dimensions || `${parsedWidth}ft × ${parsedHeight}ft`,
        width_m: parsedWidth,
        height_m: parsedHeight,
        material_type: materialType,
        quantity: parsedQuantity,
        total_cost: totalCost,
        downpayment_amount: parsedPaymentAmount,
        balance_due: balanceDue,
        payment_status: payStatus,
        status: 'received',
        estimated_pickup_date: estimatedPickupDate || null,
        notes: parsedNeedsLayout 
          ? `[Needs layout design (+₱180.00)]${notes ? '\n' + notes : ''}`
          : (notes || null),
      })
      .select('*')
      .single()
    if (orderErr) throw orderErr

    // Record initial status history
    await supabase.from('status_history').insert({
      order_id: order.id,
      old_status: null,
      new_status: 'received',
      changed_by: req.user.id,
    })

    // Record payment
    if (parsedPaymentAmount > 0) {
      await supabase.from('payments').insert({
        order_id: order.id,
        amount: parsedPaymentAmount,
        payment_method: paymentMethod || 'cash',
        ewallet_ref: paymentMethod === 'ewallet' ? ewalletRef : null,
        payment_status: payStatus,
        recorded_by: req.user.id,
        transaction_date: new Date().toISOString(),
      })
    }

    // Upload file to Supabase Storage
    if (fileBuffer && originalFilename) {
      const storedFilename = `${customerName.trim().replace(/\s+/g, '_')}_${trackingId}_${originalFilename}`
      const storagePath = `orders/${order.id}/${storedFilename}`

      const { error: uploadErr } = await supabase.storage
        .from('order-files')
        .upload(storagePath, fileBuffer, { contentType: req.file.mimetype, upsert: false })

      if (uploadErr) {
        // EH-01: File upload failed — log but don't block order creation
        console.error('[File Upload Error]', uploadErr)
        await supabase.from('audit_log').insert({
          user_id: req.user.id,
          action: 'FILE_UPLOAD_FAILED',
          target_table: 'file_attachments',
          target_id: order.id,
          details: { error: uploadErr.message },
        })
      } else {
        await supabase.from('file_attachments').insert({
          order_id: order.id,
          original_filename: originalFilename,
          stored_filename: storedFilename,
          storage_path: storagePath,
          file_size_bytes: fileBuffer.length,
          file_format: fileFormat,
          uploaded_by: req.user.id,
          checksum,
        })
      }
    }

    // Audit log
    await supabase.from('audit_log').insert({
      user_id: req.user.id,
      action: 'ORDER_CREATED',
      target_table: 'orders',
      target_id: order.id,
      details: { tracking_id: trackingId, customer: customerName },
    })

    res.status(201).json({ order })
  } catch (err) {
    next(err)
  }
})
