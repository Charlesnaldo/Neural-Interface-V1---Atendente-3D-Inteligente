import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const allowed = (process.env.ADMIN_EMAILS ?? '').split(',').map(email => email.trim().toLowerCase()).filter(Boolean)
  if (typeof body?.email !== 'string' || !allowed.includes(body.email.trim().toLowerCase()) || typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128) {
    return Response.json({ error: 'Não foi possível cadastrar o administrador.' }, { status: 400 })
  }
  const client = await createClient()
  const { data, error } = await client.auth.signUp({ email: body.email.trim(), password: body.password })
  if (error) return Response.json({ error: 'Não foi possível cadastrar o administrador.' }, { status: 400 })
  return Response.json({ signedIn: Boolean(data.session) })
}
