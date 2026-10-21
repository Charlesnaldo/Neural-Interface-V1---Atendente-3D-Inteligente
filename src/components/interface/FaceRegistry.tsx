'use client'

import { useState } from 'react'
import type { SavedFace } from '@/hooks/useVision'

interface Props {
  faces: SavedFace[]
  online: boolean
  cameraEnabled: boolean
  recognitionAvailable: boolean
  autoCapture: boolean
  onAutoCapture: (value: boolean) => void
  onCamera: () => void
  command: (action: string, values?: Record<string, string>) => void
  error: string
}

export function FaceRegistry(props: Props) {
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editedName, setEditedName] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  return <aside aria-label="Banco de rostos" className="absolute bottom-28 left-4 right-4 top-28 z-40 flex flex-col rounded-2xl border border-white/10 bg-neutral-950/95 p-4 text-sm text-neutral-200 shadow-2xl sm:left-auto sm:w-96">
    <h2 className="text-lg font-semibold text-white">Rostos conhecidos</h2>
    <p className="mt-1 text-xs text-neutral-400">Fotos privadas da sua conta no Supabase. Cadastre pessoas que autorizaram a captura. O reconhecimento é uma estimativa.</p>
    <button type="button" onClick={props.onCamera} className="my-3 rounded-lg border border-white/20 p-2">{props.cameraEnabled ? 'Desligar câmera' : 'Acionar câmera'}</button>
    <p role="status" className="mb-2 text-xs text-cyan-200">{props.online ? 'Câmera e serviço conectados' : props.cameraEnabled ? 'Aguardando câmera e serviço de visão…' : 'Câmera desligada'}</p>
    {props.online && !props.recognitionAvailable && <p className="mb-2 text-xs text-amber-200">Reconhecimento indisponível. Verifique os modelos faciais no serviço de visão.</p>}
    <label className="mb-3 flex items-start gap-2"><input type="checkbox" checked={props.autoCapture} disabled={!props.online || !props.recognitionAvailable} onChange={event => props.onAutoCapture(event.target.checked)} className="mt-1 accent-cyan-400" /><span>Registrar rostos vistos automaticamente<span className="block text-xs text-neutral-400">A cada 5 segundos, com apenas um rosto visível. Rostos novos recebem um nome de visitante.</span></span></label>
    <form className="mb-3 flex gap-2" onSubmit={event => { event.preventDefault(); props.command('capture_face', { name }) }}>
      <input aria-label="Nome do rosto" value={name} onChange={event => setName(event.target.value)} maxLength={80} placeholder="Nome (opcional)" className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black p-2" />
      <button disabled={!props.online} className="rounded-lg bg-cyan-400 px-3 text-black disabled:opacity-40">Fotografar</button>
    </form>
    {props.error && <p role="alert" className="mb-3 text-xs text-red-300">{props.error}</p>}
    <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain">
      {props.faces.map(face => <li key={face.id} className="flex gap-3 rounded-xl bg-white/5 p-3">
        {/* Local thumbnails are served as data URLs by the vision service. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={face.photo} alt={`Foto cadastrada de ${face.name}`} width={64} height={64} className="h-16 w-16 rounded-lg object-cover" />
        <div className="min-w-0 flex-1">
          {editing === face.id ? <form onSubmit={event => { event.preventDefault(); props.command('rename_face', { id: face.id, name: editedName }); setEditing(null) }}><input aria-label="Novo nome" autoFocus value={editedName} maxLength={80} onChange={event => setEditedName(event.target.value)} className="w-full rounded bg-black p-1" /><button disabled={!editedName.trim() || !props.online} className="mt-1 text-cyan-200">Salvar nome</button><button type="button" onClick={() => setEditing(null)} className="ml-3">Cancelar</button></form> : <p className="break-words font-medium">{face.name}</p>}
          <p className="mt-1 text-xs text-neutral-400">Visto em {new Date(face.last_seen).toLocaleString('pt-BR')}</p>
          <div className="mt-2 flex gap-3 text-xs"><button disabled={!props.online} onClick={() => { setEditing(face.id); setEditedName(face.name) }}>Renomear</button>{deleting === face.id ? <><button disabled={!props.online} onClick={() => { props.command('delete_face', { id: face.id }); setDeleting(null) }} className="text-red-300">Confirmar exclusão</button><button onClick={() => setDeleting(null)}>Cancelar</button></> : <button disabled={!props.online} onClick={() => setDeleting(face.id)} className="text-red-300">Excluir</button>}</div>
        </div>
      </li>)}
      {!props.faces.length && <li className="text-neutral-400">Acione a câmera e fotografe um rosto para começar.</li>}
    </ul>
    <p className="mt-3 text-xs text-neutral-500">{props.faces.length}/100 registros. Desative a captura automática antes de excluir uma pessoa que continua em frente à câmera.</p>
  </aside>
}
