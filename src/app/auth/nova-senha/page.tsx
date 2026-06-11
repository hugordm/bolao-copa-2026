'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { translateAuthError } from '@/lib/auth-errors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function NovaSenhaPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ password: '', confirm: '' })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.password !== form.confirm) {
      toast.error('As senhas não conferem')
      return
    }
    if (form.password.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres')
      return
    }
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: form.password })
      if (error) throw error
      toast.success('Senha atualizada com sucesso!')
      router.push('/login')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? translateAuthError(err.message, 'Erro ao atualizar senha') : 'Erro ao atualizar senha')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <Card className="w-full max-w-md bg-zinc-900 border-zinc-800">
        <CardHeader className="text-center">
          <div className="text-4xl mb-2">🏆</div>
          <CardTitle className="text-xl text-zinc-50">Nova senha</CardTitle>
          <CardDescription className="text-zinc-400">Defina sua nova senha de acesso</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" className="text-zinc-300">Nova senha</Label>
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
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirm" className="text-zinc-300">Confirmar nova senha</Label>
              <Input
                id="confirm"
                type="password"
                placeholder="Repita a senha"
                required
                value={form.confirm}
                onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                className="bg-zinc-800 border-zinc-700 text-zinc-50 placeholder:text-zinc-500 h-10"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="h-10 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold mt-1"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : 'Salvar nova senha'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
