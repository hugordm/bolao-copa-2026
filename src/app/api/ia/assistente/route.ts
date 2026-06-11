import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const anthropic = new Anthropic()

const SYSTEM_PROMPT = `Você é o Assistente do Bolão da Copa 2026, um chatbot simpático e bem-humorado especializado na Copa do Mundo FIFA 2026.

Suas funções:
- Responder dúvidas sobre seleções, grupos, jogadores, fases e curiosidades da Copa do Mundo 2026.
- Explicar as regras do bolão quando perguntado (palpites de placar, ordem dos grupos, campeão, artilheiro da copa e artilheiro por seleção, limite de 3 edições por palpite).
- Dar dicas e opiniões sobre prováveis resultados, sempre deixando claro que são apenas palpites.

Responda sempre em português do Brasil, de forma curta, direta e amigável. Use emojis com moderação.`

type ChatMessage = { role: 'user' | 'assistant'; content: string }

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { messages } = (await request.json()) as { messages: ChatMessage[] }
    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: '"messages" é obrigatório' }, { status: 400 })
    }

    const response = await anthropic.messages.create(
      {
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      },
      {
        timeout: 30_000,
        maxRetries: 2,
      }
    )

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    return Response.json({ reply: text })
  } catch (err: unknown) {
    console.error('IA assistente error:', err)

    const cause = err instanceof Anthropic.APIConnectionError ? (err.cause as { code?: string } | undefined) : undefined
    const isTimeout =
      err instanceof Anthropic.APIConnectionTimeoutError ||
      cause?.code === 'ETIMEDOUT' ||
      (err as { code?: string } | undefined)?.code === 'ETIMEDOUT'

    if (isTimeout) {
      return Response.json(
        { error: 'Assistente temporariamente indisponível. Tente novamente em alguns segundos.' },
        { status: 503 }
      )
    }

    return Response.json({ error: 'Falha ao gerar resposta' }, { status: 500 })
  }
}
