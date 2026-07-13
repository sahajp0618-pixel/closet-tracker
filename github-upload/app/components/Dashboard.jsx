'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  PenTool, Candy as CandyIcon, StickyNote, Cog, Sparkles, Scissors, Palette,
  Boxes, Printer, Package, Lock, LogOut, Plus, Search, X, Pencil, Trash2,
  PackageOpen, Undo2, Check, Clock, ShieldCheck, Box, RefreshCw, Tag,
  MoreVertical, ImagePlus, UploadCloud,
} from 'lucide-react';

/* ─────────────────────────── setup ─────────────────────────── */

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const browserSb = SB_URL && SB_ANON ? createClient(SB_URL, SB_ANON) : null;

const ICON_SET = {
  pen: PenTool, candy: CandyIcon, paper: StickyNote, machine: Cog,
  sparkles: Sparkles, scissors: Scissors, palette: Palette, box: Boxes,
  printer: Printer, tag: Tag,
};
const ICON_CHOICES = Object.keys(ICON_SET);
const COLOR_CHOICES = ['#3B82F6', '#EC4899', '#F59E0B', '#8B5CF6', '#22B37A', '#F0654E', '#0EA5E9', '#EF4444'];

function iconFor(cat) {
  if (!cat) return Package;
  return ICON_SET[cat.icon] || Package;
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = {};
  try { json = await res.json(); } catch {}
  return { httpOk: res.ok, status: res.status, ...json };
}

/* ─────────────────────────── root ─────────────────────────── */

export default function Dashboard() {
  const [data, setData] = useState({ categories: [], items: [], transactions: [] });
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeCat, setActiveCat] = useState('all');
  const [query, setQuery] = useState('');
  const [toasts, setToasts] = useState([]);
  const [flashIds, setFlashIds] = useState({});
  const prevItems = useRef({});

  // modals
  const [takeItem, setTakeItem] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showCats, setShowCats] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showReturn, setShowReturn] = useState(false);

  const toast = useCallback((msg, kind = 'ok') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/data', { cache: 'no-store' });
      const json = await res.json();
      if (json && json.items) {
        // flash items whose availability changed
        const changed = {};
        for (const it of json.items) {
          const prev = prevItems.current[it.id];
          if (prev !== undefined && prev !== it.available_quantity) changed[it.id] = true;
          prevItems.current[it.id] = it.available_quantity;
        }
        if (Object.keys(changed).length) {
          setFlashIds(changed);
          setTimeout(() => setFlashIds({}), 900);
        }
        setData(json);
      }
    } catch {}
    setLoading(false);
  }, []);

  const checkAdmin = useCallback(async () => {
    const r = await api('/api/admin/status');
    setIsAdmin(!!r.isAdmin);
  }, []);

  useEffect(() => {
    fetchData();
    checkAdmin();
    const poll = setInterval(fetchData, 10000);
    let channel;
    if (browserSb) {
      channel = browserSb
        .channel('closet-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, fetchData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, fetchData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, fetchData)
        .subscribe();
    }
    return () => {
      clearInterval(poll);
      if (channel && browserSb) browserSb.removeChannel(channel);
    };
  }, [fetchData, checkAdmin]);

  const catById = useMemo(() => {
    const m = {};
    for (const c of data.categories) m[c.id] = c;
    return m;
  }, [data.categories]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.items.filter((it) => {
      if (activeCat !== 'all' && it.category_id !== activeCat) return false;
      if (q && !it.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data.items, activeCat, query]);

  const activeTx = useMemo(
    () => data.transactions.filter((t) => t.status === 'active' || t.status === 'return_pending'),
    [data.transactions]
  );
  const pendingReturns = useMemo(
    () => data.transactions.filter((t) => t.status === 'return_pending'),
    [data.transactions]
  );

  const stats = useMemo(() => {
    const totalItems = data.items.length;
    const totalUnits = data.items.reduce((s, i) => s + (i.total_quantity || 0), 0);
    const availUnits = data.items.reduce((s, i) => s + (i.available_quantity || 0), 0);
    return { totalItems, out: totalUnits - availUnits, pending: pendingReturns.length };
  }, [data.items, pendingReturns]);

  /* ───────── actions ───────── */
  async function doLogin(password) {
    const r = await api('/api/admin/login', { method: 'POST', body: { password } });
    if (r.ok) { setIsAdmin(true); setShowLogin(false); toast('Admin mode unlocked', 'ok'); }
    return r;
  }
  async function doLogout() {
    await api('/api/admin/logout', { method: 'POST' });
    setIsAdmin(false); toast('Signed out of admin');
  }
  async function doCheckout(item, personName, quantity) {
    const r = await api('/api/checkout', { method: 'POST', body: { itemId: item.id, personName, quantity } });
    if (r.ok) { toast(`Took ${quantity} × ${item.name}`, 'ok'); fetchData(); }
    else toast(r.error || 'Could not check out', 'err');
    return r;
  }
  async function requestReturn(tx) {
    const r = await api('/api/return-request', { method: 'POST', body: { transactionId: tx.id } });
    if (r.ok) { toast('Return requested — waiting for admin', 'ok'); fetchData(); }
    else toast(r.error || 'Could not request return', 'err');
    return r;
  }
  async function resolveReturn(tx, action) {
    const r = await api('/api/return-confirm', { method: 'POST', body: { transactionId: tx.id, action } });
    if (r.ok) { toast(action === 'approve' ? 'Return confirmed & restocked' : 'Return rejected'); fetchData(); }
    else toast(r.error || 'Action failed', 'err');
  }
  async function deleteItem(item) {
    if (!confirm(`Delete "${item.name}" from the closet?`)) return;
    const r = await api(`/api/items/${item.id}`, { method: 'DELETE' });
    if (r.ok) { toast('Item deleted'); fetchData(); } else toast(r.error || 'Delete failed', 'err');
  }
  async function changePhoto(item, file) {
    if (!file) return;
    if (!file.type || !file.type.startsWith('image/')) { toast('That is not an image file', 'err'); return; }
    toast('Uploading photo…');
    const fd = new FormData();
    fd.append('file', file);
    const up = await fetch('/api/upload', { method: 'POST', body: fd });
    const uj = await up.json().catch(() => ({}));
    if (!uj.ok) { toast(uj.error || 'Upload failed', 'err'); return; }
    const r = await api(`/api/items/${item.id}`, { method: 'PATCH', body: { imageUrl: uj.url } });
    if (r.ok) { toast('Photo updated'); fetchData(); } else toast(r.error || 'Update failed', 'err');
  }

  return (
    <div className="relative z-10 min-h-screen">
      <Header
        isAdmin={isAdmin}
        onLogin={() => setShowLogin(true)}
        onLogout={doLogout}
        onAdd={() => setShowAdd(true)}
        onCats={() => setShowCats(true)}
        pending={stats.pending}
        onRefresh={fetchData}
      />

      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6">
        <StatsRow stats={stats} live={!!browserSb} />

        {/* filters */}
        <div className="mt-7 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CategoryFilter
            categories={data.categories}
            active={activeCat}
            setActive={setActiveCat}
          />
          <div className="relative w-full md:w-64">
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              className="field pl-9"
              placeholder="Search items…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {/* grid */}
        <div className="mt-6">
          {loading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-64 animate-pulse rounded-xl2 bg-line/40" />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <EmptyState isAdmin={isAdmin} onAdd={() => setShowAdd(true)} hasItems={data.items.length > 0} />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {filteredItems.map((it) => (
                <ItemCard
                  key={it.id}
                  item={it}
                  category={catById[it.category_id]}
                  isAdmin={isAdmin}
                  flash={!!flashIds[it.id]}
                  onTake={() => setTakeItem(it)}
                  onEdit={() => setEditItem(it)}
                  onDelete={() => deleteItem(it)}
                  onChangePhoto={changePhoto}
                />
              ))}
            </div>
          )}
        </div>

        {/* out + returns */}
        <OutPanel
          activeTx={activeTx}
          pendingReturns={pendingReturns}
          items={data.items}
          isAdmin={isAdmin}
          onResolve={resolveReturn}
          onOpenReturn={() => setShowReturn(true)}
        />

        <ActivityLog transactions={data.transactions} items={data.items} />
      </main>

      {/* modals */}
      {takeItem && (
        <TakeModal item={takeItem} onClose={() => setTakeItem(null)} onConfirm={doCheckout} />
      )}
      {showReturn && (
        <ReturnPanel
          transactions={data.transactions}
          items={data.items}
          onRequest={requestReturn}
          onClose={() => setShowReturn(false)}
        />
      )}
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onLogin={doLogin} />}
      {(showAdd || editItem) && (
        <ItemFormModal
          item={editItem}
          categories={data.categories}
          onClose={() => { setShowAdd(false); setEditItem(null); }}
          onSaved={() => { setShowAdd(false); setEditItem(null); fetchData(); }}
          toast={toast}
        />
      )}
      {showCats && (
        <CategoriesModal
          categories={data.categories}
          items={data.items}
          onClose={() => setShowCats(false)}
          onChanged={fetchData}
          toast={toast}
        />
      )}

      <Toasts toasts={toasts} />
    </div>
  );
}

/* ─────────────────────────── header ─────────────────────────── */

function Header({ isAdmin, onLogin, onLogout, onAdd, onCats, pending, onRefresh }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-cream/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-coral text-white shadow-[0_4px_0_#c94631]">
          <Box size={22} />
        </div>
        <div className="mr-auto leading-tight">
          <h1 className="font-display text-xl font-700 text-ink">BAPS Mandir Closet</h1>
          <p className="text-xs font-600 text-muted">Mandir Arts &amp; Crafts Inventory</p>
        </div>

        {isAdmin && (
          <span className="hidden items-center gap-1.5 rounded-full bg-grape/12 px-3 py-1.5 text-xs font-700 text-grape sm:inline-flex">
            <ShieldCheck size={14} /> Admin
          </span>
        )}

        {isAdmin ? (
          <>
            <button className="btn-primary text-sm" onClick={onAdd}>
              <Plus size={16} /> <span className="hidden sm:inline">Add item</span>
            </button>
            <button className="btn-ghost text-sm" onClick={onCats}>
              <Tag size={16} /> <span className="hidden sm:inline">Categories</span>
            </button>
            <button className="btn-ghost text-sm" onClick={onLogout} title="Sign out">
              <LogOut size={16} />
            </button>
          </>
        ) : (
          <button className="btn-dark text-sm" onClick={onLogin}>
            <Lock size={15} /> Admin
          </button>
        )}
      </div>
    </header>
  );
}

/* ─────────────────────────── stats ─────────────────────────── */

function StatsRow({ stats, live }) {
  const cards = [
    { label: 'Items in closet', value: stats.totalItems, icon: Boxes, tint: '#3B82F6' },
    { label: 'Units checked out', value: stats.out, icon: PackageOpen, tint: '#F0654E' },
    { label: 'Returns pending', value: stats.pending, icon: Clock, tint: '#F59E0B' },
  ];
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((c) => (
        <div key={c.label} className="card-surface flex items-center gap-4 p-4">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{ backgroundColor: c.tint + '1f', color: c.tint }}
          >
            <c.icon size={24} />
          </div>
          <div>
            <div className="font-display text-3xl font-700 leading-none text-ink">{c.value}</div>
            <div className="mt-1 text-sm font-600 text-muted">{c.label}</div>
          </div>
        </div>
      ))}
      <div className="sm:col-span-3 -mt-1 flex items-center gap-2 text-xs font-600 text-muted">
        <span className={`inline-block h-2 w-2 rounded-full ${live ? 'bg-leaf animate-pulse' : 'bg-line'}`} />
        {live ? 'Live — updates in real time' : 'Auto-refreshing every 10s'}
      </div>
    </section>
  );
}

/* ─────────────────────────── filters ─────────────────────────── */

function CategoryFilter({ categories, active, setActive }) {
  return (
    <div className="scroll-nice flex flex-nowrap gap-2 overflow-x-auto pb-1 md:flex-wrap">
      <button
        className="chip"
        style={active === 'all'
          ? { backgroundColor: '#2E2620', color: '#FBF6EC', borderColor: '#2E2620' }
          : { backgroundColor: '#fff', color: '#2E2620', borderColor: '#EBE2D2' }}
        onClick={() => setActive('all')}
      >
        <Sparkles size={14} /> All
      </button>
      {categories.map((c) => {
        const Icon = iconFor(c);
        const on = active === c.id;
        return (
          <button
            key={c.id}
            className="chip whitespace-nowrap"
            style={on
              ? { backgroundColor: c.color, color: '#fff', borderColor: c.color }
              : { backgroundColor: c.color + '14', color: c.color, borderColor: c.color + '44' }}
            onClick={() => setActive(c.id)}
          >
            <Icon size={14} /> {c.name}
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────────── item card ─────────────────────────── */

function ItemCard({ item, category, isAdmin, flash, onTake, onEdit, onDelete, onChangePhoto }) {
  const Icon = iconFor(category);
  const color = category?.color || '#8A7E70';
  const total = item.total_quantity || 0;
  const avail = item.available_quantity || 0;
  const pct = total > 0 ? Math.round((avail / total) * 100) : 0;
  const out = avail <= 0;

  const [menu, setMenu] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menu]);

  // Let the admin paste a copied image straight onto the card while its menu is open.
  useEffect(() => {
    if (!menu) return;
    const onPaste = (e) => {
      const items = e.clipboardData?.items || [];
      for (const it of items) {
        if (it.type && it.type.startsWith('image/')) {
          const f = it.getAsFile();
          if (f) { onChangePhoto(item, f); setMenu(false); }
          break;
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [menu, item, onChangePhoto]);

  function pickFile(e) { e.stopPropagation(); fileRef.current?.click(); }
  function onFile(e) { const f = e.target.files?.[0]; if (f) onChangePhoto(item, f); e.target.value = ''; setMenu(false); }
  function onDrop(e) {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer?.files?.[0];
    if (f && f.type.startsWith('image/')) onChangePhoto(item, f);
  }

  return (
    <div className={`card-surface group relative overflow-hidden ${flash ? 'animate-flash' : ''}`}>
      {isAdmin && (
        <div className="absolute right-2 top-2 z-20" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => { e.stopPropagation(); setMenu((m) => !m); }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-ink shadow hover:bg-white"
            title="Options" aria-label="Item options"
          >
            <MoreVertical size={16} />
          </button>
          {menu && (
            <div className="animate-popin absolute right-0 mt-1 w-48 overflow-hidden rounded-xl border border-line bg-paper py-1 shadow-pop">
              <button onClick={pickFile} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-600 text-ink hover:bg-cream">
                <ImagePlus size={15} /> Change photo…
              </button>
              <div className="px-3 py-1 text-[11px] font-600 text-muted">…or drag a file onto the photo, or paste (⌘/Ctrl+V)</div>
              <div className="my-1 border-t border-line" />
              <button onClick={(e) => { e.stopPropagation(); setMenu(false); onEdit(); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-600 text-ink hover:bg-cream">
                <Pencil size={15} /> Edit details
              </button>
              <button onClick={(e) => { e.stopPropagation(); setMenu(false); onDelete(); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-600 text-coral hover:bg-coral/10">
                <Trash2 size={15} /> Delete item
              </button>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
        </div>
      )}

      {/* image / placeholder — admins can drop a file here */}
      <div
        className="relative aspect-[4/3] w-full overflow-hidden"
        style={{ backgroundColor: color + '16' }}
        onDragOver={isAdmin ? (e) => { e.preventDefault(); setDrag(true); } : undefined}
        onDragLeave={isAdmin ? () => setDrag(false) : undefined}
        onDrop={isAdmin ? onDrop : undefined}
      >
        {item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Icon size={54} style={{ color }} strokeWidth={1.4} />
          </div>
        )}
        <span
          className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-700"
          style={{ backgroundColor: '#fff', color }}
        >
          <Icon size={11} /> {category?.name || 'Uncategorized'}
        </span>
        {isAdmin && drag && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center border-2 border-dashed border-coral bg-cream/85 text-sm font-700 text-coral">
            <span className="flex items-center gap-2"><UploadCloud size={18} /> Drop photo to replace</span>
          </div>
        )}
      </div>

      <div className="p-3.5">
        <h3 className="line-clamp-1 font-display text-[17px] font-600 text-ink">{item.name}</h3>

        <div className="mt-2 flex items-baseline gap-1">
          <span className="font-display text-2xl font-700" style={{ color: out ? '#c94631' : '#2E2620' }}>{avail}</span>
          <span className="text-sm font-600 text-muted">/ {total} available</span>
        </div>

        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-line/60">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>

        <button
          className={out ? 'btn-ghost mt-3 w-full text-sm' : 'btn-primary mt-3 w-full text-sm'}
          disabled={out}
          onClick={onTake}
        >
          {out ? 'Out of stock' : <><PackageOpen size={16} /> Take</>}
        </button>
      </div>
    </div>
  );
}

function EmptyState({ isAdmin, onAdd, hasItems }) {
  return (
    <div className="card-surface flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-coral/12 text-coral">
        <PackageOpen size={30} />
      </div>
      <h3 className="font-display text-xl font-700 text-ink">
        {hasItems ? 'Nothing matches that filter' : 'The closet is empty'}
      </h3>
      <p className="max-w-sm text-sm font-600 text-muted">
        {hasItems
          ? 'Try a different category or clear your search.'
          : isAdmin
            ? 'Add your first item to start tracking the closet.'
            : 'An admin needs to add items before anything shows up here.'}
      </p>
      {isAdmin && !hasItems && (
        <button className="btn-primary mt-1" onClick={onAdd}><Plus size={16} /> Add first item</button>
      )}
    </div>
  );
}

/* ─────────────────────────── out + returns panel ─────────────────────────── */

function OutPanel({ activeTx, pendingReturns, items, isAdmin, onResolve, onOpenReturn }) {
  const itemById = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items]);
  if (activeTx.length === 0 && pendingReturns.length === 0) {
    return (
      <section className="mt-10 card-surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-700 text-ink flex items-center gap-2">
            <PackageOpen size={18} /> Currently out
          </h2>
          <button className="btn-ghost text-sm" onClick={onOpenReturn}><Undo2 size={15} /> Return an item</button>
        </div>
        <p className="mt-3 text-sm font-600 text-muted">Everything is in the closet right now. 🎉</p>
      </section>
    );
  }
  return (
    <section className="mt-10 grid gap-4 lg:grid-cols-2">
      {/* out */}
      <div className="card-surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-700 text-ink flex items-center gap-2">
            <PackageOpen size={18} /> Currently out
          </h2>
          <button className="btn-ghost text-sm" onClick={onOpenReturn}><Undo2 size={15} /> Return</button>
        </div>
        <ul className="scroll-nice mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
          {activeTx.length === 0 && <li className="text-sm font-600 text-muted">Nothing out right now.</li>}
          {activeTx.map((t) => {
            const it = itemById[t.item_id];
            const pend = t.status === 'return_pending';
            return (
              <li key={t.id} className="flex items-center gap-3 rounded-xl border border-line bg-white px-3 py-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-coral/12 font-700 text-coral">
                  {t.quantity}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-700 text-ink">{it?.name || 'Item'}</div>
                  <div className="truncate text-xs font-600 text-muted">taken by {t.person_name}</div>
                </div>
                {pend && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber/15 px-2 py-1 text-[11px] font-700 text-amber">
                    <Clock size={11} /> return pending
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* pending returns (admin action) */}
      <div className="card-surface p-5">
        <h2 className="font-display text-lg font-700 text-ink flex items-center gap-2">
          <Clock size={18} /> Pending returns
          {pendingReturns.length > 0 && (
            <span className="rounded-full bg-amber px-2 py-0.5 text-xs font-800 text-white">{pendingReturns.length}</span>
          )}
        </h2>
        <ul className="scroll-nice mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
          {pendingReturns.length === 0 && (
            <li className="text-sm font-600 text-muted">No returns waiting for confirmation.</li>
          )}
          {pendingReturns.map((t) => {
            const it = itemById[t.item_id];
            return (
              <li key={t.id} className="flex items-center gap-3 rounded-xl border border-line bg-white px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-700 text-ink">{t.quantity} × {it?.name || 'Item'}</div>
                  <div className="truncate text-xs font-600 text-muted">from {t.person_name}</div>
                </div>
                {isAdmin ? (
                  <div className="flex gap-1.5">
                    <button
                      className="btn text-xs bg-leaf text-white shadow-[0_3px_0_#19855b]"
                      onClick={() => onResolve(t, 'approve')}
                    >
                      <Check size={14} /> Confirm
                    </button>
                    <button className="btn-ghost text-xs" onClick={() => onResolve(t, 'reject')}>
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <span className="rounded-full bg-line/60 px-2 py-1 text-[11px] font-700 text-muted">awaiting admin</span>
                )}
              </li>
            );
          })}
        </ul>
        {!isAdmin && pendingReturns.length > 0 && (
          <p className="mt-3 text-xs font-600 text-muted">Only an admin can confirm returns and restock items.</p>
        )}
      </div>
    </section>
  );
}

/* ─────────────────────────── activity log ─────────────────────────── */

function ActivityLog({ transactions, items }) {
  const [open, setOpen] = useState(false);
  const itemById = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items]);
  const rows = transactions.slice(0, 40);
  return (
    <section className="mt-10">
      <button
        className="flex w-full items-center justify-between rounded-xl2 border border-line bg-paper px-5 py-3 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="font-display text-lg font-700 text-ink">Activity log</span>
        <span className="text-sm font-700 text-muted">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <ul className="scroll-nice mt-3 max-h-96 space-y-1.5 overflow-y-auto">
          {rows.length === 0 && <li className="px-2 py-3 text-sm font-600 text-muted">No activity yet.</li>}
          {rows.map((t) => {
            const it = itemById[t.item_id];
            const map = {
              active: { label: 'took', color: '#F0654E', Icon: PackageOpen },
              return_pending: { label: 'requested return of', color: '#F59E0B', Icon: Clock },
              returned: { label: 'returned', color: '#22B37A', Icon: Check },
            };
            const m = map[t.status] || map.active;
            return (
              <li key={t.id} className="flex items-center gap-3 rounded-lg bg-white/60 px-3 py-2 text-sm">
                <m.Icon size={15} style={{ color: m.color }} />
                <span className="font-700 text-ink">{t.person_name || 'Someone'}</span>
                <span className="text-muted">{m.label}</span>
                <span className="font-700 text-ink">{t.quantity} × {it?.name || 'item'}</span>
                <span className="ml-auto whitespace-nowrap text-xs font-600 text-muted">{timeAgo(t.created_at)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ─────────────────────────── modals ─────────────────────────── */

function Shell({ children, onClose, title, icon: Icon, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`animate-popin w-full ${wide ? 'max-w-lg' : 'max-w-md'} rounded-t-xl2 bg-paper shadow-pop sm:rounded-xl2`}>
        <div className="flex items-center gap-2 border-b border-line px-5 py-4">
          {Icon && <Icon size={20} className="text-coral" />}
          <h3 className="font-display text-lg font-700 text-ink">{title}</h3>
          <button className="ml-auto rounded-full p-1 text-muted hover:bg-line/50" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function TakeModal({ item, onClose, onConfirm }) {
  const [name, setName] = useState('');
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const max = item.available_quantity;

  useEffect(() => {
    try { const n = window.localStorage.getItem('closet_name'); if (n) setName(n); } catch {}
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try { window.localStorage.setItem('closet_name', name.trim()); } catch {}
    const r = await onConfirm(item, name.trim(), Math.min(qty, max));
    setBusy(false);
    if (r.ok) onClose();
  }

  return (
    <Shell title={`Take: ${item.name}`} icon={PackageOpen} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm font-600 text-muted">{max} available in the closet.</p>
        <div>
          <label className="label">Your name</label>
          <input className="field" value={name} autoFocus placeholder="e.g. Priya"
            onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">How many?</label>
          <div className="flex items-center gap-3">
            <button type="button" className="btn-ghost h-10 w-10 !px-0 text-lg" onClick={() => setQty((q) => Math.max(1, q - 1))}>–</button>
            <div className="min-w-[3rem] text-center font-display text-2xl font-700 text-ink">{qty}</div>
            <button type="button" className="btn-ghost h-10 w-10 !px-0 text-lg" onClick={() => setQty((q) => Math.min(max, q + 1))}>+</button>
          </div>
        </div>
        <button className="btn-primary w-full" disabled={busy || !name.trim()}>
          {busy ? 'Taking…' : <>Take {qty} {qty > 1 ? 'items' : 'item'}</>}
        </button>
      </form>
    </Shell>
  );
}

function ReturnPanel({ transactions, items, onRequest, onClose }) {
  const [name, setName] = useState('');
  const itemById = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items]);

  useEffect(() => {
    try { const n = window.localStorage.getItem('closet_name'); if (n) setName(n); } catch {}
  }, []);

  const mine = useMemo(() => {
    const q = name.trim().toLowerCase();
    if (!q) return [];
    return transactions.filter((t) => t.status === 'active' && (t.person_name || '').toLowerCase() === q);
  }, [transactions, name]);

  return (
    <Shell title="Return an item" icon={Undo2} onClose={onClose} wide>
      <div>
        <label className="label">Your name</label>
        <input className="field" value={name} autoFocus placeholder="Type the name you used"
          onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="mt-4">
        {name.trim() === '' ? (
          <p className="text-sm font-600 text-muted">Enter your name to see what you have out.</p>
        ) : mine.length === 0 ? (
          <p className="text-sm font-600 text-muted">Nothing checked out under “{name.trim()}”.</p>
        ) : (
          <ul className="scroll-nice max-h-72 space-y-2 overflow-y-auto pr-1">
            {mine.map((t) => {
              const it = itemById[t.item_id];
              return (
                <li key={t.id} className="flex items-center gap-3 rounded-xl border border-line bg-white px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-700 text-ink">{t.quantity} × {it?.name || 'Item'}</div>
                    <div className="text-xs font-600 text-muted">taken {timeAgo(t.created_at)}</div>
                  </div>
                  <button className="btn-primary text-xs" onClick={() => onRequest(t)}>
                    <Undo2 size={14} /> Request return
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-4 rounded-xl bg-amber/10 px-3 py-2 text-xs font-600 text-amber">
          Requesting a return notifies the admin. The item is restocked once an admin confirms it.
        </p>
      </div>
    </Shell>
  );
}

function LoginModal({ onClose, onLogin }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    const r = await onLogin(pw);
    setBusy(false);
    if (!r.ok) setErr(r.error || 'Incorrect password');
  }
  return (
    <Shell title="Admin sign-in" icon={Lock} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm font-600 text-muted">Enter the admin password to add items and confirm returns.</p>
        <div>
          <label className="label">Password</label>
          <input type="password" className="field" value={pw} autoFocus
            onChange={(e) => setPw(e.target.value)} placeholder="••••••••" />
        </div>
        {err && <p className="text-sm font-700 text-coral">{err}</p>}
        <button className="btn-primary w-full" disabled={busy || !pw}>{busy ? 'Checking…' : 'Unlock admin'}</button>
      </form>
    </Shell>
  );
}

function ItemFormModal({ item, categories, onClose, onSaved, toast }) {
  const editing = !!item;
  const [name, setName] = useState(item?.name || '');
  const [categoryId, setCategoryId] = useState(item?.category_id || (categories[0]?.id || ''));
  const [qty, setQty] = useState(item?.total_quantity ?? 1);
  const [imageUrl, setImageUrl] = useState(item?.image_url || '');
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef(null);

  async function uploadFile(file) {
    if (!file) return;
    if (!file.type || !file.type.startsWith('image/')) { toast('That is not an image file', 'err'); return; }
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const json = await res.json().catch(() => ({}));
    setUploading(false);
    if (json.ok) { setImageUrl(json.url); toast('Photo uploaded'); }
    else toast(json.error || 'Upload failed', 'err');
  }
  function handleFile(e) { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ''; }
  function handleDrop(e) {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) uploadFile(f);
  }

  // Paste a copied image anywhere while this form is open.
  useEffect(() => {
    const onPaste = (e) => {
      const items = e.clipboardData?.items || [];
      for (const it of items) {
        if (it.type && it.type.startsWith('image/')) {
          const f = it.getAsFile();
          if (f) uploadFile(f);
          break;
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const body = { name: name.trim(), categoryId, totalQuantity: qty, imageUrl };
    const r = editing
      ? await api(`/api/items/${item.id}`, { method: 'PATCH', body })
      : await api('/api/items', { method: 'POST', body });
    setBusy(false);
    if (r.ok) { toast(editing ? 'Item updated' : 'Item added'); onSaved(); }
    else toast(r.error || 'Save failed', 'err');
  }

  return (
    <Shell title={editing ? 'Edit item' : 'Add item'} icon={editing ? Pencil : Plus} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="flex gap-4">
          <button type="button" onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={handleDrop}
            className={`relative flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl2 border-2 border-dashed bg-cream text-muted transition ${drag ? 'border-coral bg-coral/10' : 'border-line hover:border-coral'}`}>
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="h-full w-full object-cover" />
            ) : uploading ? (
              <span className="text-xs font-700">Uploading…</span>
            ) : (
              <span className="flex flex-col items-center gap-1 text-xs font-700"><ImagePlus size={20} /> Photo</span>
            )}
            {drag && (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-cream/85 text-[11px] font-700 text-coral">Drop here</span>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          <div className="flex-1">
            <label className="label">Item name</label>
            <input className="field" value={name} autoFocus placeholder="e.g. Glue sticks"
              onChange={(e) => setName(e.target.value)} />
            <p className="mt-2 text-xs font-600 text-muted">Click to upload, drag a file in, or paste a copied image (⌘/Ctrl+V). Optional — a category icon shows if none.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Category</label>
            <select className="field" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {categories.length === 0 && <option value="">— none —</option>}
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{editing ? 'Total quantity' : 'Quantity'}</label>
            <input type="number" min="0" className="field" value={qty}
              onChange={(e) => setQty(e.target.value)} />
          </div>
        </div>

        <button className="btn-primary w-full" disabled={busy || uploading || !name.trim()}>
          {busy ? 'Saving…' : editing ? 'Save changes' : 'Add to closet'}
        </button>
      </form>
    </Shell>
  );
}

function CategoriesModal({ categories, items, onClose, onChanged, toast }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLOR_CHOICES[0]);
  const [icon, setIcon] = useState(ICON_CHOICES[0]);
  const [busy, setBusy] = useState(false);

  const counts = useMemo(() => {
    const m = {};
    for (const it of items) m[it.category_id] = (m[it.category_id] || 0) + 1;
    return m;
  }, [items]);

  async function add(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const r = await api('/api/categories', { method: 'POST', body: { name: name.trim(), color, icon } });
    setBusy(false);
    if (r.ok) { setName(''); toast('Category added'); onChanged(); }
    else toast(r.error || 'Failed', 'err');
  }
  async function remove(c) {
    if (!confirm(`Delete category "${c.name}"? Items stay but become uncategorized.`)) return;
    const r = await api(`/api/categories/${c.id}`, { method: 'DELETE' });
    if (r.ok) { toast('Category removed'); onChanged(); } else toast(r.error || 'Failed', 'err');
  }

  const PreviewIcon = ICON_SET[icon] || Package;

  return (
    <Shell title="Manage categories" icon={Tag} onClose={onClose} wide>
      <ul className="mb-4 space-y-2">
        {categories.map((c) => {
          const Icon = iconFor(c);
          return (
            <li key={c.id} className="flex items-center gap-3 rounded-xl border border-line bg-white px-3 py-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: c.color + '20', color: c.color }}>
                <Icon size={16} />
              </span>
              <span className="flex-1 text-sm font-700 text-ink">{c.name}</span>
              <span className="text-xs font-600 text-muted">{counts[c.id] || 0} items</span>
              <button className="rounded-full p-1.5 text-coral hover:bg-coral/10" onClick={() => remove(c)}><Trash2 size={15} /></button>
            </li>
          );
        })}
        {categories.length === 0 && <li className="text-sm font-600 text-muted">No categories yet.</li>}
      </ul>

      <form onSubmit={add} className="rounded-xl2 border border-line bg-cream/60 p-4">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: color + '22', color }}>
            <PreviewIcon size={17} />
          </span>
          <input className="field flex-1" placeholder="New category name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="mt-3">
          <div className="label">Colour</div>
          <div className="flex flex-wrap gap-2">
            {COLOR_CHOICES.map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)}
                className={`h-7 w-7 rounded-full transition ${color === c ? 'ring-2 ring-offset-2 ring-ink' : ''}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
        <div className="mt-3">
          <div className="label">Icon</div>
          <div className="flex flex-wrap gap-2">
            {ICON_CHOICES.map((k) => {
              const I = ICON_SET[k];
              return (
                <button key={k} type="button" onClick={() => setIcon(k)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg border ${icon === k ? 'border-ink bg-white' : 'border-line bg-white/50'}`}>
                  <I size={16} className="text-ink" />
                </button>
              );
            })}
          </div>
        </div>
        <button className="btn-primary mt-4 w-full" disabled={busy || !name.trim()}><Plus size={16} /> Add category</button>
      </form>
    </Shell>
  );
}

/* ─────────────────────────── toasts ─────────────────────────── */

function Toasts({ toasts }) {
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <div key={t.id}
          className={`animate-popin pointer-events-auto rounded-full px-4 py-2.5 text-sm font-700 text-white shadow-pop ${
            t.kind === 'err' ? 'bg-coral' : t.kind === 'ok' ? 'bg-leaf' : 'bg-ink'
          }`}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────── utils ─────────────────────────── */

function timeAgo(iso) {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
