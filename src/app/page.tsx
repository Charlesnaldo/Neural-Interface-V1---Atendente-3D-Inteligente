
import AtendenteInterface from '@/components/AtendenteInterface'
import { redirect } from 'next/navigation'
import { createClient, supabaseConfigured } from '@/lib/supabase/server'

export default async function Home() {
  if (!supabaseConfigured()) return <main className="p-8">Configure a conexão com o Supabase para acessar o Zord.</main>
  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) redirect('/login')
  return <AtendenteInterface userId={user.id} />
}
