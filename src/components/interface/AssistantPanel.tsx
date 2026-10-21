'use client'

import { useState } from 'react'
import type { AssistantStore, PersonalItem } from '@/lib/assistant-store'

interface Props {
  store: AssistantStore
  ready: boolean
  saving: boolean
  onImport: () => void
  onSignOut: () => void
  error: string
  onAdd: (kind: 'memory' | 'task', text: string) => void
  onRemove: (kind: 'memories' | 'tasks', id: string) => void
  onToggle: (id: string) => void
  onClear: () => void
  cameraEnabled: boolean
  onCamera: () => void
  micEnabled: boolean
  onMicOff: () => void
}

export function AssistantPanel(props: Props) {
  const [tab, setTab] = useState<'history' | 'memories' | 'tasks'>('history')
  const [draft, setDraft] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)
  const tabs = { history: 'Conversa', memories: 'Memória', tasks: 'Tarefas' } as const
  const renderItem = (item: PersonalItem) => (
    <li key={item.id} className="flex items-start gap-3 rounded-xl bg-white/5 p-3">
      {tab === 'tasks' && <input type="checkbox" checked={item.done} onChange={() => props.onToggle(item.id)} aria-label={`Concluir ${item.text}`} className="mt-1 accent-cyan-400" />}
      <span className={`flex-1 break-words ${item.done ? 'line-through text-neutral-500' : ''}`}>{item.text}</span>
      <button type="button" aria-label={`Excluir ${item.text}`} onClick={() => props.onRemove(tab === 'tasks' ? 'tasks' : 'memories', item.id)} className="text-neutral-400 hover:text-red-300">Excluir</button>
    </li>
  )
  return (
    <aside aria-label="Assistente pessoal" className="absolute bottom-28 left-4 right-4 top-28 z-40 flex flex-col rounded-2xl border border-white/10 bg-neutral-950/95 p-4 text-sm text-neutral-200 shadow-2xl backdrop-blur-xl sm:left-auto sm:w-96">
      <h2 className="text-lg font-semibold text-white">Seu espaço pessoal</h2>
      <p className="mt-1 text-xs text-neutral-400">Dados privados da sua conta. Memórias e tarefas são enviados ao provedor ao conversar.</p>
      <p role="status" className="mt-2 text-xs text-cyan-200">{!props.ready ? 'Sincronização indisponível ou carregando…' : props.saving ? 'Salvando no Supabase…' : 'Sincronizado com o Supabase'}</p>
      {props.ready && !props.store.history.length && !props.store.memories.length && !props.store.tasks.length && <button type="button" onClick={props.onImport} className="mt-2 text-left text-xs text-cyan-200 underline">Importar dados antigos deste navegador para esta conta</button>}
      <div className="my-3 flex flex-wrap gap-2">
        <button type="button" aria-pressed={props.cameraEnabled} onClick={props.onCamera} className="rounded-lg border border-white/15 px-3 py-2">Câmera {props.cameraEnabled ? 'ligada' : 'desligada'}</button>
        <button type="button" disabled={!props.micEnabled} onClick={props.onMicOff} className="rounded-lg border border-white/15 px-3 py-2 disabled:opacity-40">Desligar microfone</button>
      </div>
      <nav aria-label="Seções do assistente" className="mb-3 flex gap-2">
        {Object.entries(tabs).map(([key, label]) => <button type="button" key={key} aria-pressed={tab === key} onClick={() => { setTab(key as typeof tab); setDraft('') }} className={`rounded-lg px-3 py-2 ${tab === key ? 'bg-cyan-400 text-black' : 'bg-white/5'}`}>{label}</button>)}
      </nav>
      {!props.ready && <p>Carregando dados…</p>}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" aria-label={tabs[tab]}>
        {tab === 'history' ? <ol className="space-y-3">{props.store.history.map((message, index) => <li key={index} className="rounded-xl bg-white/5 p-3"><p className="mb-1 text-xs text-cyan-300">{message.role === 'user' ? 'Você' : 'Zord'}</p><p className="whitespace-pre-wrap break-words">{message.content}</p></li>)}{!props.store.history.length && <li className="text-neutral-400">Sua conversa aparecerá aqui.</li>}</ol> : <ul className="space-y-2">{props.store[tab].map(renderItem)}{!props.store[tab].length && <li className="text-neutral-400">{tab === 'memories' ? 'Diga “lembre que prefiro respostas curtas”.' : 'Diga “crie uma tarefa: revisar meu projeto”. Tarefas não geram alarmes.'}</li>}</ul>}
      </div>
      {tab !== 'history' && <form className="mt-3 flex gap-2" onSubmit={event => { event.preventDefault(); if (draft.trim()) { props.onAdd(tab === 'tasks' ? 'task' : 'memory', draft.trim()); setDraft('') } }}><input aria-label={tab === 'tasks' ? 'Nova tarefa' : 'Nova memória'} maxLength={1000} value={draft} onChange={event => setDraft(event.target.value)} placeholder="Adicionar…" className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black p-2" /><button disabled={!props.ready || !draft.trim()} className="rounded-lg bg-cyan-400 px-3 text-black disabled:opacity-40">Salvar</button></form>}
      {props.error && <p role="alert" className="mt-3 text-xs text-red-300">{props.error}</p>}
      <div className="mt-3 border-t border-white/10 pt-3 text-xs">
        {confirmClear ? <div className="flex items-center gap-3"><span>Apagar conversa, memórias e tarefas desta conta? Os rostos são gerenciados em outro painel.</span><button disabled={!props.ready} onClick={() => { props.onClear(); setConfirmClear(false) }} className="text-red-300">Apagar</button><button onClick={() => setConfirmClear(false)}>Cancelar</button></div> : <button onClick={() => setConfirmClear(true)} className="text-neutral-400 hover:text-red-300">Apagar conversa, memórias e tarefas</button>}
        <button type="button" disabled={props.saving} onClick={props.onSignOut} className="mt-3 block text-neutral-200 underline disabled:opacity-40">Sair da conta</button>
      </div>
    </aside>
  )
}
