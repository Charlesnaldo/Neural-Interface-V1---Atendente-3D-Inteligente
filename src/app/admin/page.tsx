import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'
import AtendenteInterface from '@/components/AtendenteInterface'

export default async function AdminPage() {
  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()
  if (!isAdmin(user)) redirect('/login')
  return <AtendenteInterface userId={user!.id} />
}
