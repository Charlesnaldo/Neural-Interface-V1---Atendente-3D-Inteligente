import Link from 'next/link'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'

export const dynamic = 'force-dynamic'

async function removePhoto(form: FormData) {
  'use server'
  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()
  if (!isAdmin(user)) redirect('/login')
  const id = String(form.get('id') || '')
  if (!/^[a-f0-9-]{36}$/i.test(id)) throw new Error('Foto inválida')
  const { error } = await client.from('zord_visitor_photos').delete().eq('id', id)
  if (error) throw new Error('Não foi possível excluir a foto')
  revalidatePath('/admin/photos')
}

export default async function PhotosPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()
  if (!isAdmin(user)) redirect('/login')
  const params = await searchParams
  const page = Math.min(49, Math.max(0, Number.parseInt(params.page || '0', 10) || 0))
  const { data, error, count } = await client.from('zord_visitor_photos').select('id,visitor_name,photo_base64,created_at', { count: 'exact' }).order('created_at', { ascending: false }).range(page * 20, page * 20 + 19)
  return <main className="min-h-screen bg-neutral-950 p-6 text-neutral-100">
    <Link href="/admin" className="text-cyan-300">← Assistente</Link>
    <h1 className="mt-5 text-2xl">Fotos autorizadas</h1>
    <p className="my-3 text-sm text-neutral-400">Galeria privada do administrador. Apenas fotos enviadas voluntariamente. Nomes são informados pelo visitante, sem verificação de identidade.</p>
    {error ? <p role="alert">Não foi possível carregar as fotos.</p> : <p>{count || 0} foto(s)</p>}
    <div className="my-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {data?.map(photo => <article key={photo.id} className="rounded-xl border border-neutral-700 p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`data:image/jpeg;base64,${photo.photo_base64}`} alt="Foto enviada com autorização" width={256} height={256} className="mx-auto rounded" />
        <p className="mt-3 break-words">{photo.visitor_name || 'Nome não informado'}</p>
        <p className="text-xs text-neutral-400">{new Date(photo.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
        <form action={removePhoto} className="mt-3"><input type="hidden" name="id" value={photo.id} /><label className="block text-xs"><input type="checkbox" required /> Confirmo a exclusão definitiva</label><button className="mt-2 rounded border border-red-700 px-3 py-1">Excluir foto</button></form>
      </article>)}
    </div>
    <nav className="flex gap-5" aria-label="Páginas">{page > 0 && <Link href={`/admin/photos?page=${page - 1}`}>Anterior</Link>}{(count || 0) > (page + 1) * 20 && <Link href={`/admin/photos?page=${page + 1}`}>Próxima</Link>}</nav>
  </main>
}
