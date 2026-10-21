import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const supabaseConfigured = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)

export async function createClient() {
  const jar = await cookies()
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        try { values.forEach(({ name, value, options }) => jar.set(name, value, options)) }
        catch { /* Server Components rely on proxy.ts to refresh cookies. */ }
      },
    },
  })
}
