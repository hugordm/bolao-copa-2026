'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Loader2, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { translateAuthError } from '@/lib/auth-errors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function RecuperarSenhaPage() {
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [email, setEmail] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/nova-senha`,
      })
      if (error) throw error
      setSent(true)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? translateAuthError(err.message, 'Erro ao enviar email') : 'Erro ao enviar email')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <Card className="w-full max-w-md bg-zinc-900 border-zinc-800">
        <CardHeader className="text-center">
          <div className="text-4xl mb-2">🏆</div>
          <CardTitle className="text-xl text-zinc-50">Recuperar senha</CardTitle>
          <CardDescription className="text-zinc-400">
            {sent
              ? 'Verifique sua caixa de entrada'
              : 'Informe seu email para receber o link de recuperação'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="flex flex-col gap-4 text-center">
              <p className="text-zinc-300 text-sm">
                Enviamos um link para <span className="text-emerald-400 font-medium">{email}</span>.
                Clique nele para criar uma nova senha.
              </p>
              <Link href="/login">
                <Button variant="outline" className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                  <ArrowLeft className="size-4" />
                  Voltar para o login
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email" className="text-zinc-300">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="bg-zinc-800 border-zinc-700 text-zinc-50 placeholder:text-zinc-500 h-10"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="h-10 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold"
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : 'Enviar link de recuperação'}
              </Button>
              <Link href="/login">
                <Button type="button" variant="ghost" className="w-full text-zinc-400 hover:text-zinc-200">
                  <ArrowLeft className="size-4" />
                  Voltar para o login
                </Button>
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
