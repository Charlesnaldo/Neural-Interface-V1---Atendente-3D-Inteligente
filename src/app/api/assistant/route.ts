import { createClient } from '@/lib/supabase/server'
import { parseStore, emptyStore } from '@/lib/assistant-store'
import { isAdmin } from '@/lib/admin'

export async function GET() {
  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()
  if (!isAdmin(user)) return Response.json({ error: 'Acesso administrativo necessário.' }, { status: 403 })
  const { data, error } = await client.from('zord_assistant_state').select('data, revision').eq('user_id', user.id).maybeSingle()
  if (error) return Response.json({ error: 'Não foi possível carregar seus dados.' }, { status: 503 })
  return Response.json({ store: data ? parseStore(data.data) : emptyStore(), revision: data?.revision ?? 0 }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function PUT(request: Request) {
  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()
  if (!isAdmin(user)) return Response.json({ error: 'Acesso administrativo necessário.' }, { status: 403 })
  const raw = await request.text()
  if (raw.length > 2000000) return Response.json({ error: 'Dados muito grandes.' }, { status: 413 })
  let body
  try { body = JSON.parse(raw) } catch { return Response.json({ error: 'Dados inválidos.' }, { status: 400 }) }
  if (!body || !Number.isSafeInteger(body.revision) || body.revision < 0 || body.store?.version !== 1) return Response.json({ error: 'Dados inválidos.' }, { status: 400 })
  const { data, error } = await client.rpc('save_zord_state', { p_data: parseStore(body.store), p_revision: body.revision })
  if (error) return Response.json({ error: 'Não foi possível salvar seus dados.' }, { status: 503 })
  if (data === null) return Response.json({ error: 'Dados alterados em outra aba ou aparelho. Recarregue antes de continuar.' }, { status: 409 })
  return Response.json({ revision: data }, { headers: { 'Cache-Control': 'private, no-store' } })
}
