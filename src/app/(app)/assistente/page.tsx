'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Bot, Loader2, Send, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type ChatMessage = { role: 'user' | 'assistant'; content: string }

const SUGESTOES = [
  'Quais são as regras de pontuação do bolão?',
  'Quando começa a Copa do Mundo 2026?',
  'Quantas vezes posso editar um palpite?',
  'Quem são as favoritas ao título?',
]

export default function AssistentePage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'E aí! 👋 Sou o assistente do Bolão da Copa 2026. Pode perguntar sobre seleções, grupos, regras do bolão ou pedir uma opinião sobre os jogos!',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function enviar(texto?: string) {
    const conteudo = (texto ?? input).trim()
    if (!conteudo || loading) return

    const novasMensagens: ChatMessage[] = [...messages, { role: 'user', content: conteudo }]
    setMessages(novasMensagens)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/ia/assistente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: novasMensagens }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMessages(msgs => [...msgs, { role: 'assistant', content: data.reply }])
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao falar com o assistente')
      setMessages(msgs => msgs.slice(0, -1))
      setInput(conteudo)
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    enviar()
  }

  return (
    <div className="flex h-full flex-col max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-zinc-50 mb-4 flex items-center gap-2">
        <Bot className="size-5 text-emerald-400" />
        Assistente do Bolão
      </h1>

      <div className="flex-1 overflow-y-auto space-y-3 mb-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex items-start gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
                m.role === 'user' ? 'bg-blue-600' : 'bg-emerald-600'
              }`}
            >
              {m.role === 'user' ? <User className="size-4 text-white" /> : <Bot className="size-4 text-white" />}
            </div>
            <div
              className={`max-w-[80%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-800 text-zinc-100'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-start gap-2">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-600">
              <Bot className="size-4 text-white" />
            </div>
            <div className="rounded-xl bg-zinc-800 px-3 py-2 text-sm text-zinc-400">
              <Loader2 className="size-4 animate-spin" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {SUGESTOES.map(s => (
            <button
              key={s}
              onClick={() => enviar(s)}
              disabled={loading}
              className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:border-emerald-500 hover:text-emerald-400 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Digite sua pergunta..."
          disabled={loading}
          className="flex-1 bg-zinc-800 border-zinc-700 text-zinc-50 placeholder:text-zinc-500 h-10"
        />
        <Button
          type="submit"
          disabled={loading || !input.trim()}
          className="bg-emerald-500 hover:bg-emerald-600 text-white shrink-0"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </form>
    </div>
  )
}
