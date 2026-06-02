'use client'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import { RegisterSchema, LoginSchema } from '@/lib/validations/auth'
import { useAppStore } from '@/store/appStore'
import { GEMEINDEN } from '@/types'
import type { Profile } from '@/types'
import { toast } from 'sonner'

export function AuthModal() {
  const supabase = createClient()
  const setUser = useAppStore((s) => s.setUser)
  const [tab, setTab] = useState<'login' | 'register'>('login')

  const registerForm = useForm({
    resolver: zodResolver(RegisterSchema),
    defaultValues: {
      email: '',
      password: '',
      username: '',
      gemeinde: '',
    },
  })

  const loginForm = useForm({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const onRegister = async (data: typeof RegisterSchema._type) => {
    registerForm.setError('root', { message: '' })
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            username: data.username,
            gemeinde: data.gemeinde,
          },
          emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
        },
      })

      if (signUpError) {
        const message =
          signUpError.message === 'User already registered'
            ? 'E-Mail bereits registriert'
            : signUpError.message
        registerForm.setError('root', { message })
        return
      }

      toast.success('Bestätige deine E-Mail! 📬')
      registerForm.reset()
      setTab('login')
    } catch {
      registerForm.setError('root', { message: 'Ein Fehler ist aufgetreten' })
    }
  }

  const onLogin = async (data: typeof LoginSchema._type) => {
    loginForm.setError('root', { message: '' })
    try {
      const { data: session, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })

      if (error) {
        const message =
          error.message === 'Invalid login credentials'
            ? 'Falsche E-Mail oder Passwort'
            : error.message
        loginForm.setError('root', { message })
        return
      }

      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id,username,full_name,avatar_url,gemeinde')
          .eq('id', session.user.id)
          .single()
        setUser(profile as Profile | null)
        toast.success('Willkommen! 🎉')
      }
    } catch {
      loginForm.setError('root', { message: 'Ein Fehler ist aufgetreten' })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => useAppStore.getState().setCreateModalOpen(false)}
      />
      <div className="relative w-full animate-slide-up rounded-t-3xl border border-glass-border bg-obsidian-3 p-6 shadow-modal">
        <div className="mb-6 flex gap-4 border-b border-glass-border pb-4">
          <button
            onClick={() => setTab('login')}
            className={`font-display font-bold ${
              tab === 'login' ? 'text-gold' : 'text-white/60'
            }`}
          >
            Anmelden
          </button>
          <button
            onClick={() => setTab('register')}
            className={`font-display font-bold ${
              tab === 'register' ? 'text-gold' : 'text-white/60'
            }`}
          >
            Registrieren
          </button>
        </div>

        {tab === 'login' ? (
          <form
            onSubmit={loginForm.handleSubmit(onLogin)}
            className="space-y-4"
          >
            {loginForm.formState.errors.root?.message && (
              <div className="rounded-lg bg-uri-danger/10 p-3 text-sm text-uri-danger">
                {loginForm.formState.errors.root.message}
              </div>
            )}
            <input
              type="email"
              placeholder="E-Mail"
              {...loginForm.register('email')}
              className="w-full rounded-lg border border-glass-border bg-obsidian-4 px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-gold"
            />
            {loginForm.formState.errors.email?.message && (
              <p className="text-xs text-uri-danger">
                {loginForm.formState.errors.email.message}
              </p>
            )}
            <input
              type="password"
              placeholder="Passwort"
              {...loginForm.register('password')}
              className="w-full rounded-lg border border-glass-border bg-obsidian-4 px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-gold"
            />
            {loginForm.formState.errors.password?.message && (
              <p className="text-xs text-uri-danger">
                {loginForm.formState.errors.password.message}
              </p>
            )}
            <button
              type="submit"
              disabled={loginForm.formState.isSubmitting}
              className="btn-gold w-full rounded-lg px-4 py-2 font-display font-bold disabled:opacity-50"
            >
              {loginForm.formState.isSubmitting ? 'Wird angemeldet...' : 'Anmelden'}
            </button>
          </form>
        ) : (
          <form
            onSubmit={registerForm.handleSubmit(onRegister)}
            className="space-y-4"
          >
            {registerForm.formState.errors.root?.message && (
              <div className="rounded-lg bg-uri-danger/10 p-3 text-sm text-uri-danger">
                {registerForm.formState.errors.root.message}
              </div>
            )}
            <input
              type="email"
              placeholder="E-Mail"
              {...registerForm.register('email')}
              className="w-full rounded-lg border border-glass-border bg-obsidian-4 px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-gold"
            />
            {registerForm.formState.errors.email?.message && (
              <p className="text-xs text-uri-danger">
                {registerForm.formState.errors.email.message}
              </p>
            )}
            <input
              type="text"
              placeholder="Username"
              {...registerForm.register('username')}
              className="w-full rounded-lg border border-glass-border bg-obsidian-4 px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-gold"
            />
            {registerForm.formState.errors.username?.message && (
              <p className="text-xs text-uri-danger">
                {registerForm.formState.errors.username.message}
              </p>
            )}
            <select
              {...registerForm.register('gemeinde')}
              className="w-full rounded-lg border border-glass-border bg-obsidian-4 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-gold"
            >
              <option value="">Gemeinde wählen</option>
              {GEMEINDEN.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            {registerForm.formState.errors.gemeinde?.message && (
              <p className="text-xs text-uri-danger">
                {registerForm.formState.errors.gemeinde.message}
              </p>
            )}
            <input
              type="password"
              placeholder="Passwort (Min. 8 Zeichen)"
              {...registerForm.register('password')}
              className="w-full rounded-lg border border-glass-border bg-obsidian-4 px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-gold"
            />
            {registerForm.formState.errors.password?.message && (
              <p className="text-xs text-uri-danger">
                {registerForm.formState.errors.password.message}
              </p>
            )}
            <button
              type="submit"
              disabled={registerForm.formState.isSubmitting}
              className="btn-gold w-full rounded-lg px-4 py-2 font-display font-bold disabled:opacity-50"
            >
              {registerForm.formState.isSubmitting ? 'Wird registriert...' : 'Registrieren'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
