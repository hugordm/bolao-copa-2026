import { NextRequest } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const { name, email } = await request.json()
    if (!name || !email) {
      return Response.json({ error: '"name" e "email" são obrigatórios' }, { status: 400 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev',
      to: email,
      subject: 'Bem-vindo ao Bolão da Copa 2026! 🏆',
      html: `
        <!DOCTYPE html>
        <html>
          <head><meta charset="utf-8" /></head>
          <body style="margin:0;padding:0;background:#0a0a0a;font-family:sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 0;">
              <tr>
                <td align="center">
                  <table width="560" cellpadding="0" cellspacing="0" style="background:#18181b;border-radius:12px;border:1px solid #27272a;overflow:hidden;">
                    <tr>
                      <td style="padding:32px;text-align:center;background:#18181b;border-bottom:1px solid #27272a;">
                        <span style="font-size:48px;">🏆</span>
                        <h1 style="margin:16px 0 4px;color:#f4f4f5;font-size:22px;font-weight:700;">Bolão da Copa 2026</h1>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:32px;">
                        <h2 style="margin:0 0 12px;color:#f4f4f5;font-size:20px;">
                          Bem-vindo, ${name}!
                        </h2>
                        <p style="margin:0 0 20px;color:#a1a1aa;font-size:15px;line-height:1.6;">
                          Você foi cadastrado com sucesso. Faça login e comece a palpitar!
                        </p>
                        <p style="text-align:center;margin:0 0 24px;">
                          <a href="${appUrl}/dashboard"
                            style="display:inline-block;background:#22c55e;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
                            Acessar o Bolão
                          </a>
                        </p>
                        <p style="margin:0;color:#52525b;font-size:13px;text-align:center;">
                          Copa do Mundo 2026 🌍 • EUA, México e Canadá
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
    })

    if (error) {
      console.error('Resend error:', error)
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ ok: true, id: data?.id })
  } catch (err: unknown) {
    console.error('Email error:', err)
    return Response.json({ error: 'Falha ao enviar email' }, { status: 500 })
  }
}
