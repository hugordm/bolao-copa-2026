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

export default function CadastroPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '' })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.password.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres')
      return
    }
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { name: form.name } },
      })
      if (error) throw error

      await fetch('/api/email/boas-vindas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, email: form.email }),
      })

      if (data.session) {
        router.push('/dashboard')
      } else {
        toast.success('Cadastro realizado! Verifique seu email para confirmar o cadastro.')
        router.push('/login')
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? translateAuthError(err.message, 'Erro ao criar conta') : 'Erro ao criar conta')
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
          <CardDescription className="text-zinc-400">Crie sua conta para participar</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name" className="text-zinc-300">Nome</Label>
              <Input
                id="name"
                type="text"
                placeholder="Seu nome"
                required
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="bg-zinc-800 border-zinc-700 text-zinc-50 placeholder:text-zinc-500 h-10"
              />
            </div>
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
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="bg-zinc-800 border-zinc-700 text-zinc-50 placeholder:text-zinc-500 h-10"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="h-10 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold mt-1"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : 'Criar conta'}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-zinc-400">
            Já tem conta?{' '}
            <Link href="/login" className="text-emerald-400 hover:text-emerald-300 underline-offset-4 hover:underline">
              Entrar
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
