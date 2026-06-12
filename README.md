# 🏆 Bolão da Copa 2026

Plataforma completa de bolão para a Copa do Mundo FIFA 2026, desenvolvida para grupos de amigos competirem em palpites de placares, classificação dos grupos, campeão e artilharia — com pontuação automática, ranking em tempo real e assistente de IA.

🔗 **Acesse:** [bolao.pirulitodocorte.xyz](https://bolao.pirulitodocorte.xyz)

---

## ✨ Funcionalidades

### Para os participantes
- **Cadastro e login** com confirmação de e-mail e recuperação de senha
- **Palpites de placar** para todos os 104 jogos, com bloqueio automático 5 minutos antes do apito e durante o jogo
- **Ordem dos grupos** (1º ao 4º) com edição por drag-and-drop ou troca por clique, bloqueada na 3ª rodada de cada grupo
- **Palpites especiais**: campeão da copa, artilheiro da copa e artilheiro por seleção, com regras de bloqueio por fase
- **Sugestão de palpite via IA** (Claude) baseada no histórico dos times
- **Assistente de IA** para tirar dúvidas sobre o bolão e a copa
- **Ranking em tempo real** dos participantes
- **"Meus Palpites"**: histórico completo com status de acerto por jogo, grupo e especiais
- **"Palpites da Galera"**: veja os palpites de todos os participantes lado a lado, com indicação de quem acertou
- **Artilharia da Copa**: ranking de goleadores com destaque para o top 3
- **Tabela dos Grupos**: classificação visual com indicação de classificados, eliminados e "zona dos 8 melhores terceiros"
- **Calendário de resultados** organizado por fase e rodada
- **Página "Como Funciona"**: regras de pontuação explicadas dinamicamente a partir da configuração do admin

### Para o administrador
- Importação automática de times, jogos, jogadores e grupos via API
- Sincronização automática de resultados, artilharia e classificação (cron a cada 15 min)
- Edição manual de resultados, artilharia e tabela de grupos (incluindo critérios de desempate)
- Gestão de jogadores (adicionar, inativar/reativar — útil para lesões e convocações)
- Cálculo automático de pontos dos grupos, incluindo a regra dos 8 melhores terceiros colocados
- Configuração customizável da pontuação de cada tipo de palpite
- Gestão de usuários e botão de recálculo geral de pontos

---

## 🧮 Sistema de pontuação

| Tipo de palpite | Pontuação |
|---|---|
| Placar exato | 3 pts |
| Resultado certo (vitória/empate/derrota) | 1 pt |
| 1º colocado do grupo | 5 pts |
| 1º e 2º colocados na ordem | 6 pts |
| Ordem exata do grupo (1º ao 4º) | 10 pts |
| Campeão da copa | 15 pts |
| Artilheiro da copa | 10 pts |
| Artilheiro por seleção | 5 pts |

Todas as pontuações são configuráveis pelo administrador.

---

## 🛠️ Stack técnica

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Framer Motion
- **Backend**: Next.js API Routes, Supabase (PostgreSQL + Auth + Realtime)
- **IA**: Claude API (Anthropic) para sugestões de palpite e assistente
- **Dados da copa**: API Zafronix (times, jogos, elencos, artilharia e classificação)
- **E-mails**: Resend (confirmação, recuperação de senha e boas-vindas)
- **Deploy**: Vercel
- **Automação**: cron-job.org para sincronização periódica de resultados

---

## 🔐 Regras de bloqueio

- **Placar**: bloqueia 5 minutos antes do início e durante o jogo
- **Ordem dos grupos**: bloqueia individualmente por grupo, ao iniciar a 3ª rodada
- **Campeão e artilheiro da copa**: bloqueiam ao final da fase de grupos (máx. 5 edições)
- **Artilheiro por seleção**: bloqueia ao início das oitavas de final (máx. 5 edições)

---

## 📦 Estrutura do projeto

```
src/
├── app/
│   ├── (app)/          # Páginas autenticadas (dashboard, palpites, admin, etc.)
│   ├── api/             # Rotas de API (sync, IA, e-mails, admin)
│   ├── auth/             # Fluxos de autenticação
│   ├── cadastro|login|recuperar-senha/
├── lib/
│   ├── sync/             # Sincronização com a API da copa
│   ├── scoring.ts        # Cálculo de pontuação
│   └── zafronix.ts        # Integração com a API de dados
└── components/ui/         # Componentes reutilizáveis (shadcn/ui)
```

---

## 🚀 Como rodar localmente

```bash
git clone https://github.com/hugordm/bolao-copa-2026.git
cd bolao-copa-2026
npm install
```

Configure o `.env.local` com as variáveis necessárias (Supabase, Zafronix, Anthropic, Resend) e rode:

```bash
npm run dev
```

---

## 📄 Licença

Projeto pessoal, desenvolvido para uso entre amigos durante a Copa do Mundo 2026.
