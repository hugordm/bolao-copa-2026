import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const anthropic = new Anthropic()

export async function GET(request: NextRequest) {
  try {
    const matchId = request.nextUrl.searchParams.get('match_id')
    if (!matchId) {
      return Response.json({ error: '"match_id" é obrigatório' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: match, error } = await supabase
      .from('matches')
      .select(
        'phase, group_name, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name)'
      )
      .eq('id', matchId)
      .single()

    if (error || !match) {
      return Response.json({ error: 'Jogo não encontrado' }, { status: 404 })
    }

    const homeTeam = Array.isArray(match.home_team) ? match.home_team[0] : match.home_team
    const awayTeam = Array.isArray(match.away_team) ? match.away_team[0] : match.away_team

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 256,
      system: 'Você é um especialista em futebol. Responda APENAS com JSON puro e válido, sem markdown, sem blocos de código, sem texto adicional.',
      messages: [
        {
          role: 'user',
          content: `Analise o jogo ${homeTeam?.name} x ${awayTeam?.name} na ${match.phase}${match.group_name ? ` (Grupo ${match.group_name})` : ''} da Copa do Mundo 2026 e sugira um placar com uma justificativa curta e divertida em português. Responda no formato: { "home_score": number, "away_score": number, "justificativa": string }`,
        },
      ],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const cleanText = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()
    const sugestao = JSON.parse(cleanText)

    return Response.json(sugestao)
  } catch (err: unknown) {
    console.error('IA sugestao error:', err)
    return Response.json({ error: 'Falha ao gerar sugestão' }, { status: 500 })
  }
}
