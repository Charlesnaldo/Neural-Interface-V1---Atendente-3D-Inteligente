'use client'

import { useEffect, useState, type RefObject } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { TrackedFace } from '@/hooks/useVision'

type Receipt = { id: string; secret: string }
const key = 'zord-photo-receipts-v1'

export function VisitorPhotoCapture({ videoRef, faces, active }: { videoRef: RefObject<HTMLVideoElement | null>; faces: TrackedFace[]; active: boolean }) {
  const [photo, setPhoto] = useState('')
  const [name, setName] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [receipts, setReceipts] = useState<Receipt[]>([])
  useEffect(() => {
    try { setReceipts(JSON.parse(localStorage.getItem(key) || '[]')) } catch { setMessage('Armazenamento do navegador indisponível; não será possível salvar.') }
  }, [])
  function preview() {
    const video = videoRef.current
    if (!video?.videoWidth || faces.length !== 1) { setMessage('Deixe somente seu rosto no enquadramento.'); return }
    const face = faces[0]
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 256
    const context = canvas.getContext('2d')
    if (!context) return
    const x = Math.max(0, face.x), y = Math.max(0, face.y)
    context.drawImage(video, x * video.videoWidth, y * video.videoHeight, Math.min(face.width, 1 - x) * video.videoWidth, Math.min(face.height, 1 - y) * video.videoHeight, 0, 0, 256, 256)
    setPhoto(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]); setConsent(false); setMessage('')
  }
  async function save() {
    if (!consent || !photo || busy || receipts.length >= 20) return
    setBusy(true)
    const secret = Array.from(crypto.getRandomValues(new Uint8Array(32)), value => value.toString(16).padStart(2, '0')).join('')
    try {
      // Persist the deletion capability before uploading, including uncertain network outcomes.
      const id = crypto.randomUUID()
      localStorage.setItem(key, JSON.stringify([...receipts, { id, secret }]))
      setReceipts([...receipts, { id, secret }])
      const { data, error } = await createClient().rpc('submit_visitor_photo', { p_photo: photo, p_name: name.trim(), p_secret: secret, p_consent: consent })
      if (error) throw error
      const next = [...receipts, { id: data as string, secret }]
      localStorage.setItem(key, JSON.stringify(next)); setReceipts(next)
      setPhoto(''); setName(''); setConsent(false); setMessage('Foto salva. Somente o administrador pode consultar. Você pode excluí-la aqui neste navegador.')
    } catch { setMessage('Não foi possível confirmar o salvamento. Tente novamente.'); }
    finally { setBusy(false) }
  }
  async function withdraw() {
    setBusy(true)
    try {
      for (const receipt of receipts) {
        const { error } = await createClient().rpc('withdraw_visitor_photo', { p_id: receipt.id, p_secret: receipt.secret })
        if (error) throw error
      }
      localStorage.removeItem(key); setReceipts([]); setMessage('Suas fotos deste navegador foram excluídas.')
    } catch { setMessage('Não foi possível excluir. Tente novamente.'); }
    finally { setBusy(false) }
  }
  return <div className="p-2 text-xs text-neutral-200">
    {active && <button type="button" onClick={preview} disabled={busy || faces.length !== 1 || receipts.length >= 20} className="rounded border border-cyan-400/50 p-2 disabled:opacity-40">Preparar minha foto</button>}
    {photo && <div role="dialog" aria-label="Autorizar foto" className="fixed inset-4 z-[100] m-auto h-fit max-h-[90vh] max-w-sm overflow-auto rounded-xl border border-cyan-700 bg-neutral-950 p-5 shadow-xl">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`data:image/jpeg;base64,${photo}`} alt="Prévia da sua foto" width={256} height={256} className="mx-auto" />
      <label className="my-3 block">Seu nome (opcional)<input maxLength={80} value={name} onChange={event => setName(event.target.value)} className="mt-1 w-full rounded bg-neutral-800 p-2" /></label>
      <label className="block"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} /> Sou a pessoa da foto e autorizo guardar esta imagem no banco do Zord, acessível apenas ao administrador, até sua exclusão. Posso revogar aqui neste navegador. Não há identificação pela internet.</label>
      <button type="button" disabled={!consent || busy} onClick={save} className="mt-4 rounded bg-cyan-900 p-3 disabled:opacity-40">{busy ? 'Salvando…' : 'Autorizar e salvar minha foto'}</button>
      <button type="button" disabled={busy} onClick={() => setPhoto('')} className="ml-3 p-2">Cancelar</button>
      {message && <p role="status">{message}</p>}
    </div>}
    {receipts.length > 0 && <button type="button" disabled={busy} onClick={withdraw} className="mt-2 block underline">Excluir minhas fotos deste navegador ({receipts.length})</button>}
    {message && <p role="status" className="mt-2">{message}</p>}
  </div>
}
