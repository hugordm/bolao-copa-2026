import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Authorizes sync/admin route handlers: accepts either a valid
 * `Authorization: Bearer ${CRON_SECRET}` header (Vercel Cron / server-to-server)
 * or a logged-in user with `is_admin = true` (Admin UI).
 */
export async function authorizeAdminRequest(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  return !!data?.is_admin
}
