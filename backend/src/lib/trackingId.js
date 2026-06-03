import { nanoid } from 'nanoid'
import { supabase } from '../lib/supabase.js'
import { format } from 'date-fns'

/**
 * Generates a unique Tracking ID in format: YYYYMMDD-XXXXX
 * Verifies uniqueness against the database; retries up to 5 times.
 */
export async function generateTrackingId() {
  const datePrefix = format(new Date(), 'yyyyMMdd')
  let attempts = 0

  while (attempts < 5) {
    const suffix = nanoid(5).toUpperCase().replace(/[^A-Z0-9]/g, 'X')
    const trackingId = `${datePrefix}-${suffix}`

    const { count } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('tracking_id', trackingId)

    if (count === 0) return trackingId
    attempts++
  }

  throw new Error('Failed to generate a unique Tracking ID after 5 attempts.')
}
