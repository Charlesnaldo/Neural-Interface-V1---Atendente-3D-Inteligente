'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { STORAGE_KEY, emptyStore, parseStore, type AssistantStore } from '@/lib/assistant-store'

export function usePersonalStore(cloud = true) {
  const [store, setStore] = useState<AssistantStore>(emptyStore)
  const storeRef = useRef<AssistantStore>(emptyStore())
  const [ready, setReady] = useState(!cloud)
  const readyRef = useRef(!cloud)
  const [saving, setSaving] = useState(false)
  const [storageError, setStorageError] = useState('')
  const revision = useRef(0)
  const queue = useRef(Promise.resolve())
  const pending = useRef(0)
  const blocked = useRef(false)

  useEffect(() => {
    if (!cloud) return
    const controller = new AbortController()
    void (async () => {
      try {
        const response = await fetch('/api/assistant', { signal: controller.signal, cache: 'no-store' })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Falha ao carregar seus dados.')
        if (controller.signal.aborted) return
        const restored = parseStore(data.store)
        storeRef.current = restored
        revision.current = data.revision
        setStore(restored)
        readyRef.current = true
        setReady(true)
      } catch (error) {
        if (!controller.signal.aborted) setStorageError(error instanceof Error ? error.message : 'Falha ao carregar seus dados.')
      }
    })()
    return () => { controller.abort(); readyRef.current = false }
  }, [cloud])

  const commitStore = useCallback((next: AssistantStore) => {
    if (!readyRef.current || blocked.current) return
    storeRef.current = next
    setStore(next)
    if (!cloud) return
    pending.current += 1
    setSaving(true)
    queue.current = queue.current.then(async () => {
      if (blocked.current) return
      const response = await fetch('/api/assistant', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store: next, revision: revision.current }),
        signal: AbortSignal.timeout(20000),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Falha ao salvar seus dados.')
      revision.current = data.revision
    }).catch(error => {
      blocked.current = true
      readyRef.current = false
      setReady(false)
      setStorageError(`${error instanceof Error ? error.message : 'Falha ao salvar.'} Copie dados recentes antes de recarregar a página.`)
    }).finally(() => {
      pending.current -= 1
      setSaving(pending.current > 0)
    })
  }, [cloud])

  const importLocalData = useCallback(() => {
    if (storeRef.current.history.length || storeRef.current.memories.length || storeRef.current.tasks.length) return
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (!saved) { setStorageError('Não há dados antigos neste navegador.'); return }
      commitStore(parseStore(JSON.parse(saved)))
    } catch { setStorageError('Não foi possível ler os dados antigos deste navegador.') }
  }, [commitStore])

  useEffect(() => {
    if (!saving) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [saving])

  return { store, storeRef, ready, saving, storageError, commitStore, importLocalData }
}
