'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { translateAuthError } from '@/lib/auth-errors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ email: '', password: '' })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      })
      if (error) throw error
      router.push('/dashboard')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? translateAuthError(err.message, 'Email ou senha incorretos') : 'Email ou senha incorretos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <Card className="w-full max-w-md bg-zinc-900 border-zinc-800">
        <CardHeader className="text-center">
          <div className="text-4xl mb-2">🏆</div>
          <CardTitle className="text-xl text-zinc-50">Bolão da Copa 2026</CardTitle>
          <CardDescription className="text-zinc-400">Entre na sua conta</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-zinc-300">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                required
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="bg-zinc-800 border-zinc-700 text-zinc-50 placeholder:text-zinc-500 h-10"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" className="text-zinc-300">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Sua senha"
                required
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="bg-zinc-800 border-zinc-700 text-zinc-50 placeholder:text-zinc-500 h-10"
              />
            </div>
            <div className="flex justify-end">
              <Link
                href="/recuperar-senha"
                className="text-xs text-zinc-400 hover:text-emerald-400 underline-offset-4 hover:underline"
              >
                Esqueci minha senha
              </Link>
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="h-10 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : 'Entrar'}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-zinc-400">
            Não tem conta?{' '}
            <Link href="/cadastro" className="text-emerald-400 hover:text-emerald-300 underline-offset-4 hover:underline">
              Criar conta
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
