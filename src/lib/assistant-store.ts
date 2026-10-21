export type ChatMessage = { role: 'user' | 'assistant'; content: string }
export type PersonalItem = { id: string; text: string; done: boolean }
export type AssistantStore = {
  version: 1
  history: ChatMessage[]
  memories: PersonalItem[]
  tasks: PersonalItem[]
}

export const STORAGE_KEY = 'zord.personal.v1'
export const emptyStore = (): AssistantStore => ({ version: 1, history: [], memories: [], tasks: [] })

export function parseStore(value: unknown): AssistantStore {
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1) return emptyStore()
  const source = value as Record<string, unknown>
  const items = (list: unknown): PersonalItem[] => Array.isArray(list) ? list.filter(
    (item): item is PersonalItem => !!item && typeof item.id === 'string' && typeof item.text === 'string' && typeof item.done === 'boolean'
  ).slice(-100).map(item => ({ id: item.id.slice(0, 100), text: item.text.slice(0, 1000), done: item.done })) : []
  return {
    version: 1,
    history: Array.isArray(source.history) ? source.history.filter(
      (item): item is ChatMessage => !!item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string'
    ).slice(-100).map(item => ({ role: item.role, content: item.content.slice(0, 8000) })) : [],
    memories: items(source.memories), tasks: items(source.tasks),
  }
}

export function personalCommand(message: string): { kind: 'memory' | 'task'; text: string } | null {
  const memory = message.match(/^(?:zord[,!]?\s+)?(?:lembre(?:-se)?\s+que|memorize|guarde(?:\s+na\s+mem[oó]ria)?)[\s:]+(.+)$/i)
  if (memory) return { kind: 'memory', text: memory[1].trim().slice(0, 1000) }
  const task = message.match(/^(?:zord[,!]?\s+)?(?:crie\s+(?:uma\s+)?tarefa|adicion(?:e|ar)\s+(?:uma\s+)?tarefa|tarefa)[\s:]+(.+)$/i)
  return task ? { kind: 'task', text: task[1].trim().slice(0, 1000) } : null
}
