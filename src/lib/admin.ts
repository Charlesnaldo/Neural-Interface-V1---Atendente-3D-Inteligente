import 'server-only'
import type { User } from '@supabase/supabase-js'

export function isAdmin(user: User | null): user is User {
  const emails = (process.env.ADMIN_EMAILS ?? '').split(',').map(email => email.trim().toLowerCase()).filter(Boolean)
  return Boolean(user?.email_confirmed_at && user.email && emails.includes(user.email.toLowerCase()))
}
