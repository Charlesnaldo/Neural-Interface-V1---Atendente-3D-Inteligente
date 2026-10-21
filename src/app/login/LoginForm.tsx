'use client'
import { useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [signup, setSignup] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      const client = createClient()
      const { data, error } = signup
        ? await client.auth.signUp({ email, password })
        : await client.auth.signInWithPassword({ email, password })
      if (error) { setMessage(signup ? 'Não foi possível criar a conta. Verifique os dados ou tente novamente mais tarde.' : 'Não foi possível entrar. Verifique email e senha e confirme seu email.'); return }
      if (data.session) { window.location.assign('/'); return }
      setMessage('Confira seu email para confirmar a conta. Depois volte aqui e entre com sua senha.')
    } catch { setMessage('Falha de conexão. Tente novamente.') }
    finally { setBusy(false) }
  }
  return <main className="flex min-h-dvh items-center justify-center bg-neutral-950 p-6 text-neutral-200">
    <section className="w-full max-w-sm rounded-3xl border border-cyan-400/20 bg-neutral-900/50 p-7 shadow-2xl">
      <p className="text-xs tracking-[0.35em] text-cyan-300">ZORD · ASSISTENTE PESSOAL</p>
      <h1 className="mt-5 text-2xl font-semibold text-white">{signup ? 'Crie sua conta' : 'Seu espaço, protegido'}</h1>
      <p className="mt-2 text-sm text-neutral-400">Converse e acesse suas memórias, tarefas e rostos cadastrados.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-sm">Email<input type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-black/50 p-3" /></label>
        <label className="block text-sm">Senha<input type="password" minLength={8} maxLength={128} required autoComplete={signup ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-black/50 p-3" /></label>
        {signup && <p className="text-xs text-neutral-400">Use pelo menos 8 caracteres. Você receberá um email de confirmação.</p>}
        <button disabled={busy} className="w-full rounded-xl bg-cyan-300 p-3 font-medium text-black disabled:opacity-50">{busy ? 'Aguarde…' : signup ? 'Criar conta' : 'Entrar'}</button>
      </form>
      {message && <p role="status" className="mt-4 text-sm text-cyan-100">{message}</p>}
      <button disabled={busy} onClick={() => { setSignup(value => !value); setMessage('') }} className="mt-5 text-sm text-neutral-300 underline underline-offset-4">{signup ? 'Já tenho uma conta' : 'Criar minha conta'}</button>
    </section>
  </main>
}
