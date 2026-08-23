'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Plus, Trash2, Pencil, Settings2, ArrowLeft, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

type Category = { id: string; name: string };
type Subcategory = { id: string; category_id: string; name: string };
type Purchase = { id: string; user_id?: string; item: string; amount: number; purchase_date: string; category_id: string; subcategory_id: string | null; notes: string | null };
type PurchaseInput = { item: string; amount: number; purchase_date: string; category_id: string; subcategory_id: string | null; notes: string };
const money = new Intl.NumberFormat('en-HU', { style: 'currency', currency: 'EUR' });

function errorText(error: unknown) {
  if (!error) return 'Unknown database error.';
  const e = error as { message?: string; details?: string; hint?: string; code?: string };
  return [e.message, e.details, e.hint, e.code ? `Code: ${e.code}` : ''].filter(Boolean).join(' — ');
}

export default function Home() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subs, setSubs] = useState<Subcategory[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Purchase | null>(null);
  const [range, setRange] = useState('all');
  const [showManager, setShowManager] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newSub, setNewSub] = useState('');
  const [newSubCat, setNewSubCat] = useState('');
  const [dbError, setDbError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const notify = (message: string) => { setActionMessage(message); window.setTimeout(() => setActionMessage(''), 3500); };

  const load = useCallback(async () => {
    setLoading(true); setDbError('');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) { setDbError(`Authentication check failed: ${errorText(authError)}`); setLoading(false); return; }
    if (!user) { router.replace('/login'); return; }
    setUserEmail(user.email || null);
    const [c, s, p] = await Promise.all([
      supabase.from('categories').select('id,name').eq('user_id', user.id).order('name'),
      supabase.from('subcategories').select('id,category_id,name').eq('user_id', user.id).order('name'),
      supabase.from('purchases').select('id,user_id,item,amount,purchase_date,category_id,subcategory_id,notes').eq('user_id', user.id).order('purchase_date', { ascending: false })
    ]);
    const errors = [c.error, s.error, p.error].filter(Boolean);
    if (errors.length) setDbError(errors.map(errorText).join(' | '));
    setCategories((c.data || []) as Category[]);
    setSubs((s.data || []) as Subcategory[]);
    setPurchases(((p.data || []) as Purchase[]).map(x => ({ ...x, amount: Number(x.amount) })));
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { if (!session) router.replace('/login'); });
    return () => listener.subscription.unsubscribe();
  }, [load, router]);

  const filtered = useMemo(() => {
    const now = new Date();
    return purchases.filter(p => {
      if (range === 'all') return true;
      const d = new Date(`${p.purchase_date}T12:00:00`);
      if (range === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (range === '30') { const diff = now.getTime() - d.getTime(); return diff >= 0 && diff <= 30 * 86400000; }
      if (range === 'year') return d.getFullYear() === now.getFullYear();
      return true;
    });
  }, [purchases, range]);
  const total = filtered.reduce((a, p) => a + p.amount, 0);
  const selected = categories.find(c => c.id === categoryId);

  const chartData = useMemo(() => {
    if (categoryId) {
      const map = new Map<string, number>();
      subs.filter(s => s.category_id === categoryId).forEach(s => map.set(s.id, 0));
      filtered.filter(p => p.category_id === categoryId).forEach(p => { const id = p.subcategory_id || 'other'; map.set(id, (map.get(id) || 0) + p.amount); });
      return [...map.entries()].filter(([, value]) => value > 0).map(([id, value]) => ({ name: id === 'other' ? 'Other' : subs.find(s => s.id === id)?.name || 'Other', value })).sort((a, b) => b.value - a.value);
    }
    const map = new Map<string, number>();
    filtered.forEach(p => { const name = categories.find(c => c.id === p.category_id)?.name || 'Unknown'; map.set(name, (map.get(name) || 0) + p.amount); });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [filtered, categoryId, categories, subs]);

  const savePurchase = async (data: PurchaseInput) => {
    setBusy(true); setDbError('');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) { setDbError(authError ? errorText(authError) : 'Your session has expired. Please log in again.'); setBusy(false); return; }
    const result = editing
      ? await supabase.from('purchases').update(data).eq('id', editing.id).eq('user_id', user.id).select().single()
      : await supabase.from('purchases').insert({ ...data, user_id: user.id }).select().single();
    if (result.error) { setDbError(`Could not save purchase: ${errorText(result.error)}`); setBusy(false); return; }
    setEditing(null); setShowForm(false); setBusy(false); notify(editing ? 'Purchase updated.' : 'Purchase added.'); await load();
  };

  const removePurchase = async (id: string) => {
    if (!confirm('Delete this purchase?')) return;
    setBusy(true); const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); router.replace('/login'); return; }
    const { error } = await supabase.from('purchases').delete().eq('id', id).eq('user_id', user.id);
    if (error) setDbError(`Could not delete purchase: ${errorText(error)}`); else notify('Purchase deleted.');
    setBusy(false); await load();
  };

  const addCategory = async () => {
    const name = newCategory.trim(); if (!name) return;
    setBusy(true); setDbError(''); const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) { setDbError(authError ? errorText(authError) : 'Your session has expired.'); setBusy(false); return; }
    const { error } = await supabase.from('categories').insert({ name, user_id: user.id });
    if (error) { setDbError(`Could not add category: ${errorText(error)}`); setBusy(false); return; }
    setNewCategory(''); setBusy(false); notify(`Category “${name}” added.`); await load();
  };

  const addSub = async () => {
    const name = newSub.trim(); if (!name || !newSubCat) return;
    setBusy(true); setDbError(''); const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) { setDbError(authError ? errorText(authError) : 'Your session has expired.'); setBusy(false); return; }
    const { error } = await supabase.from('subcategories').insert({ name, category_id: newSubCat, user_id: user.id });
    if (error) { setDbError(`Could not add subcategory: ${errorText(error)}`); setBusy(false); return; }
    setNewSub(''); setBusy(false); notify(`Subcategory “${name}” added.`); await load();
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('Delete this category? It can only be deleted when no purchases use it.')) return;
    setBusy(true); setDbError(''); const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); router.replace('/login'); return; }
    const { error } = await supabase.from('categories').delete().eq('id', id).eq('user_id', user.id);
    if (error) setDbError(`Could not delete category: ${errorText(error)}`); else { setCategoryId(null); notify('Category deleted.'); }
    setBusy(false); await load();
  };

  const deleteSub = async (id: string) => {
    if (!confirm('Delete this subcategory? Existing purchases will keep their category and lose only this subcategory.')) return;
    setBusy(true); const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); router.replace('/login'); return; }
    const { error } = await supabase.from('subcategories').delete().eq('id', id).eq('user_id', user.id);
    if (error) setDbError(`Could not delete subcategory: ${errorText(error)}`); else notify('Subcategory deleted.');
    setBusy(false); await load();
  };

  if (loading) return <main className="min-h-screen grid place-items-center"><RefreshCw className="animate-spin" /></main>;
  return <main className="min-h-screen px-4 py-6 md:px-8"><div className="mx-auto max-w-7xl">
    <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><div className="text-2xl font-bold tracking-tight">Spendly</div><div className="muted text-sm">Your spending, organized.</div></div><div className="flex flex-wrap gap-2"><span className="muted hidden items-center px-2 text-sm md:flex">{userEmail}</span><button className="btn" onClick={async () => { await supabase.auth.signOut(); router.replace('/login'); }}>Log out</button><select className="input !w-auto" value={range} onChange={e => setRange(e.target.value)}><option value="all">All time</option><option value="month">This month</option><option value="30">Last 30 days</option><option value="year">This year</option></select><button className="btn" onClick={() => setShowManager(!showManager)}><Settings2 size={17} /></button><button className="btn btn-primary flex items-center gap-2" onClick={() => { setEditing(null); setShowForm(true); }}><Plus size={18} /> Add purchase</button></div></header>
    {dbError && <div className="alert alert-error mb-6"><AlertCircle size={18} /><div><strong>Database error</strong><div>{dbError}</div><button className="alert-link" onClick={load}>Retry</button></div></div>}
    {actionMessage && <div className="alert alert-success mb-6"><CheckCircle2 size={18} />{actionMessage}</div>}
    <section className="mb-6 grid gap-4 md:grid-cols-3"><Stat label="Total spending" value={money.format(total)} /><Stat label="Purchases" value={String(filtered.length)} /><Stat label="Average purchase" value={money.format(filtered.length ? total / filtered.length : 0)} /></section>
    {showManager && <section className="card mb-6 p-5"><h2 className="mb-4 text-lg font-semibold">Categories & subcategories</h2><div className="grid gap-5 md:grid-cols-2"><div><div className="mb-2 text-sm muted">Add category</div><div className="flex gap-2"><input className="input" placeholder="e.g. Home" value={newCategory} onChange={e => setNewCategory(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addCategory(); }} /><button className="btn btn-primary" disabled={busy || !newCategory.trim()} onClick={addCategory}>Add</button></div><div className="mt-4 space-y-2">{categories.map(c => <div key={c.id} className="flex items-center justify-between rounded-xl border border-[#273142] px-3 py-2"><span>{c.name}</span><button className="btn btn-danger !border-0 !bg-transparent" disabled={busy} onClick={() => deleteCategory(c.id)}><Trash2 size={16} /></button></div>)}{!categories.length && <div className="muted text-sm">No categories. Add one above.</div>}</div></div><div><div className="mb-2 text-sm muted">Add subcategory</div><div className="grid gap-2"><input className="input" placeholder="e.g. Groceries" value={newSub} onChange={e => setNewSub(e.target.value)} /><select className="input" value={newSubCat} onChange={e => setNewSubCat(e.target.value)}><option value="">Choose category</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><button className="btn btn-primary" disabled={busy || !newSub.trim() || !newSubCat} onClick={addSub}>Add subcategory</button></div><div className="mt-4 space-y-2">{subs.map(s => <div key={s.id} className="flex items-center justify-between rounded-xl border border-[#273142] px-3 py-2"><span>{s.name} <span className="muted text-xs">· {categories.find(c => c.id === s.category_id)?.name || 'Unknown'}</span></span><button className="btn btn-danger !border-0 !bg-transparent" disabled={busy} onClick={() => deleteSub(s.id)}><Trash2 size={16} /></button></div>)}{!subs.length && <div className="muted text-sm">No subcategories yet.</div>}</div></div></div></section>}
    <div className="mb-6 grid gap-6 lg:grid-cols-2"><section className="card p-5"><div className="mb-2 flex items-center justify-between"><div><h2 className="font-semibold">{selected ? `${selected.name} breakdown` : 'Spending by category'}</h2><p className="muted text-sm">{selected ? 'Subcategories' : 'Click a category to drill down'}</p></div>{selected && <button className="btn flex items-center gap-2" onClick={() => setCategoryId(null)}><ArrowLeft size={16} /> All categories</button>}</div><div className="h-80">{chartData.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={72} outerRadius={112} paddingAngle={3} onClick={(d) => { if (!categoryId) { const c = categories.find(x => x.name === d.name); if (c) setCategoryId(c.id); } }}>{chartData.map((_, i) => <Cell key={i} fill={`hsl(${215 + i * 47} 75% ${58 - i * 3}%)`} />)}</Pie><Tooltip formatter={(v) => money.format(Number(v))} /></PieChart></ResponsiveContainer> : <Empty />}</div></section><section className="card p-5"><div className="mb-2"><h2 className="font-semibold">{selected ? `${selected.name} subcategories` : 'Spending comparison'}</h2><p className="muted text-sm">{selected ? 'Compare what makes up this category' : 'Your biggest spending categories'}</p></div><div className="h-80">{chartData.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ left: 4, right: 8, bottom: 25 }}><CartesianGrid strokeDasharray="3 3" stroke="#273142" /><XAxis dataKey="name" angle={-18} textAnchor="end" tick={{ fill: '#8e9aae', fontSize: 12 }} /><YAxis tick={{ fill: '#8e9aae', fontSize: 12 }} tickFormatter={v => `€${v}`} /><Tooltip formatter={(v) => money.format(Number(v))} /><Bar dataKey="value" name="Spending" radius={[7, 7, 0, 0]} fill="#7189ff" /></BarChart></ResponsiveContainer> : <Empty />}</div></section></div>
    <section className="card overflow-hidden"><div className="border-b border-[#273142] p-5"><h2 className="font-semibold">Purchases</h2><p className="muted text-sm">Every recorded expense</p></div>{filtered.length ? <div className="divide-y divide-[#273142]">{filtered.map(p => <div key={p.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between"><div className="min-w-0"><div className="font-medium">{p.item}</div><div className="muted text-sm">{categories.find(c => c.id === p.category_id)?.name || 'Unknown'}{p.subcategory_id ? ` · ${subs.find(s => s.id === p.subcategory_id)?.name || ''}` : ''} · {p.purchase_date}</div>{p.notes && <div className="muted mt-1 text-xs">{p.notes}</div>}</div><div className="flex items-center gap-4"><strong>{money.format(p.amount)}</strong><button className="btn !border-0 !bg-transparent" disabled={busy} onClick={() => { setEditing(p); setShowForm(true); }}><Pencil size={16} /></button><button className="btn btn-danger !border-0 !bg-transparent" disabled={busy} onClick={() => removePurchase(p.id)}><Trash2 size={16} /></button></div></div>)}</div> : <Empty text="No purchases yet. Add your first expense." />}</section>
  </div>{showForm && <PurchaseModal categories={categories} subs={subs} purchase={editing} busy={busy} onClose={() => { setShowForm(false); setEditing(null); }} onSave={savePurchase} />}</main>;
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="card p-5"><div className="muted text-sm">{label}</div><div className="mt-2 text-2xl font-bold">{value}</div></div>; }
function Empty({ text = 'No spending data for this view.' }: { text?: string }) { return <div className="grid h-full place-items-center muted text-sm">{text}</div>; }

function PurchaseModal({ categories, subs, purchase, busy, onClose, onSave }: { categories: Category[]; subs: Subcategory[]; purchase: Purchase | null; busy: boolean; onClose: () => void; onSave: (d: PurchaseInput) => void }) {
  const [item, setItem] = useState(purchase?.item || ''); const [amount, setAmount] = useState(purchase ? String(purchase.amount) : ''); const [date, setDate] = useState(purchase?.purchase_date || new Date().toISOString().slice(0, 10)); const [cat, setCat] = useState(purchase?.category_id || categories[0]?.id || ''); const [sub, setSub] = useState(purchase?.subcategory_id || ''); const [notes, setNotes] = useState(purchase?.notes || '');
  const available = subs.filter(s => s.category_id === cat);
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4"><div className="card w-full max-w-lg p-6"><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-semibold">{purchase ? 'Edit purchase' : 'Add purchase'}</h2><button className="btn" onClick={onClose}>×</button></div>{!categories.length ? <div className="alert alert-error">Create a category first, then you can add purchases.</div> : <><div className="grid gap-4"><label className="text-sm">What did you buy?<input className="input mt-1" value={item} onChange={e => setItem(e.target.value)} placeholder="e.g. Wireless headphones" /></label><label className="text-sm">Amount<input className="input mt-1" value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" /></label><label className="text-sm">Date<input className="input mt-1" type="date" value={date} onChange={e => setDate(e.target.value)} /></label><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Category<select className="input mt-1" value={cat} onChange={e => { setCat(e.target.value); setSub(''); }}>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="text-sm">Subcategory<select className="input mt-1" value={sub} onChange={e => setSub(e.target.value)}><option value="">None</option>{available.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label></div><label className="text-sm">Notes (optional)<textarea className="input mt-1 min-h-20" value={notes} onChange={e => setNotes(e.target.value)} /></label></div><div className="mt-6 flex justify-end gap-2"><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy || !item.trim() || !amount || Number(amount) < 0 || !cat} onClick={() => onSave({ item: item.trim(), amount: Number(amount), purchase_date: date, category_id: cat, subcategory_id: sub || null, notes })}>{busy ? 'Saving…' : purchase ? 'Save changes' : 'Add purchase'}</button></div></>}</div></div>;
}
