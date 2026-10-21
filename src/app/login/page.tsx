import { redirect } from 'next/navigation'
import { createClient, supabaseConfigured } from '@/lib/supabase/server'
import { LoginForm } from './LoginForm'
import { isAdmin } from '@/lib/admin'

export default async function LoginPage() {
  if (!supabaseConfigured()) return <main className="p-8">Configure a conexão com o Supabase para acessar o Zord.</main>
  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()
  if (isAdmin(user)) redirect('/admin')
  return <LoginForm />
}
