'use client';

import { FormEvent, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-500">Supabase is not configured properly.</p>
      </div>
    );
  }
  const router = useRouter();
  const [mode, setMode] = useState<'login'|'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/');
    });
  }, [router]);

  async function submit(e: FormEvent) {
    e.preventDefault(); setMessage('');
    if (!supabase) {
      setMessage('Supabase is not configured. Create .env.local with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, then restart the dev server.');
      return;
    }
    setBusy(true);
    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (result.error) { setMessage(result.error.message); return; }
    if (mode === 'signup') setMessage('Account created. Check your email if confirmation is enabled.');
    else router.replace('/');
  }

  return <main className="min-h-screen grid place-items-center p-5">
    <div className="w-full max-w-md">
      <div className="mb-8 text-center"><div className="text-3xl font-black">Spendly</div><p className="muted mt-2">Your spending, synced everywhere.</p></div>
      <div className="card p-6 md:p-8">
        <div className="mb-6 flex rounded-xl border border-[#273142] p-1">
          <button className={`flex-1 rounded-lg px-4 py-2 text-sm ${mode==='login'?'bg-[#202a3a]':''}`} onClick={()=>setMode('login')}>Log in</button>
          <button className={`flex-1 rounded-lg px-4 py-2 text-sm ${mode==='signup'?'bg-[#202a3a]':''}`} onClick={()=>setMode('signup')}>Create account</button>
        </div>
        <form onSubmit={submit} className="grid gap-4">
          <label className="text-sm">Email<input className="input mt-1" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" /></label>
          <label className="text-sm">Password<input className="input mt-1" type="password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters" /></label>
          {message && <div className="rounded-xl border border-[#38445a] bg-[#151d2a] p-3 text-sm">{message}</div>}
          <button className="btn btn-primary mt-2" disabled={busy}>{busy ? 'Please wait…' : mode==='login' ? 'Log in' : 'Create account'}</button>
        </form>
      </div>
      <p className="muted mt-5 text-center text-xs">Your purchases are tied to your account and protected by Row Level Security.</p>
    </div>
  </main>;
}
