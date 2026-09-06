'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DNEVI_KRATKO, MESECI, weekdayIndex } from '@/lib/datum';

function authHeaders(session) {
  if (!session) return {};
  if (session.isSuper) return { 'x-admin-pass': session.adminPass };
  return { 'x-emp-id': session.empId, 'x-emp-pass': session.empPass };
}

async function api(path, { session, method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders(session) },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Napaka (${res.status})`);
  return data;
}

function cas(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const danes = new Date();
  const istiDan =
    d.getFullYear() === danes.getFullYear() &&
    d.getMonth() === danes.getMonth() &&
    d.getDate() === danes.getDate();
  const ura = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (istiDan) return `danes ob ${ura}`;
  const dan = DNEVI_KRATKO[weekdayIndex(d.getFullYear(), d.getMonth(), d.getDate())];
  return `${dan} ${d.getDate()}. ${MESECI[d.getMonth()].toLowerCase()} ob ${ura}`;
}

const VLOGA_OZNAKA = {
  super: 'vodja',
  admin: 'administrator',
  studentka: 'študentka',
};

export default function Klepet({ session, meId, isAdmin, naslov = 'Klepet' }) {
  const [sporocila, setSporocila] = useState([]);
  const [arhiviranih, setArhiviranih] = useState(0);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [prviNalozen, setPrviNalozen] = useState(false);
  const [pokaziArhiv, setPokaziArhiv] = useState(false);
  const [odprt, setOdprt] = useState(true);
  const zivo = useRef(true);

  const load = useCallback(
    async (tiho) => {
      if (!tiho) setErr('');
      try {
        const d = await api(`/api/klepet${pokaziArhiv ? '?arhiv=1' : ''}`, { session });
        if (!zivo.current) return;
        setSporocila(d.sporocila || []);
        setArhiviranih(d.arhiviranih || 0);
      } catch (e) {
        if (!tiho && zivo.current) setErr(e.message);
      } finally {
        if (zivo.current) setPrviNalozen(true);
      }
    },
    [session, pokaziArhiv]
  );

  useEffect(() => {
    zivo.current = true;
    load();
    const t = setInterval(() => load(true), 20000);
    return () => {
      zivo.current = false;
      clearInterval(t);
    };
  }, [load]);

  async function poslji(e) {
    e.preventDefault();
    const besedilo = text.trim();
    if (!besedilo) return;
    setBusy(true);
    setErr('');
    try {
      await api('/api/klepet', { session, method: 'POST', body: { text: besedilo } });
      setText('');
      await load(true);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  async function arhiviraj(id, vArhiv) {
    setBusy(true);
    try {
      await api('/api/klepet', {
        session,
        method: 'PATCH',
        body: { ids: [id], arhiv: vArhiv },
      });
      await load(true);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const prikaz = [...sporocila].reverse(); // najnovejše zgoraj

  return (
    <div className="card klepet">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>
          {naslov}
          {sporocila.filter((m) => !m.arhiv).length > 0 && (
            <span className="badge">{sporocila.filter((m) => !m.arhiv).length}</span>
          )}
        </h2>
        <button className="btn sec sm" onClick={() => setOdprt((v) => !v)}>
          {odprt ? 'Skrij' : 'Pokaži'}
        </button>
      </div>

      {odprt && (
        <>
          <form onSubmit={poslji} style={{ marginTop: 10 }}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Napiši, če kaj potrebuješ ali če je kaj za sporočiti ..."
              style={{ minHeight: 60 }}
            />
            <div className="row" style={{ marginTop: 6 }}>
              <button className="btn" disabled={busy || !text.trim()}>
                {busy ? 'Pošiljam...' : 'Pošlji'}
              </button>
              {isAdmin && arhiviranih > 0 && (
                <button
                  type="button"
                  className="btn sec sm"
                  onClick={() => setPokaziArhiv((v) => !v)}
                >
                  {pokaziArhiv ? 'Skrij arhiv' : `Arhiv (${arhiviranih})`}
                </button>
              )}
            </div>
          </form>

          {err && <div className="err">{err}</div>}
          {!prviNalozen && <p className="muted">Nalagam...</p>}
          {prviNalozen && prikaz.length === 0 && (
            <p className="muted" style={{ marginTop: 12 }}>
              Ni sporočil.
            </p>
          )}

          <div className="klepetlist">
            {prikaz.map((m) => (
              <div key={m.id} className={`msg ${m.arhiv ? 'arhiv' : ''} ${m.empId === meId ? 'moj' : ''}`}>
                <div className="msghead">
                  <b>{m.name}</b>
                  {VLOGA_OZNAKA[m.vloga] && <span className="vloga">{VLOGA_OZNAKA[m.vloga]}</span>}
                  <span className="muted">{cas(m.at)}</span>
                  {m.arhiv && <span className="vloga arh">arhiv</span>}
                </div>
                <div className="msgtext">{m.text}</div>
                {isAdmin && (
                  <button
                    className="btn sec sm"
                    disabled={busy}
                    onClick={() => arhiviraj(m.id, !m.arhiv)}
                  >
                    {m.arhiv ? 'Vrni iz arhiva' : 'V arhiv'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
