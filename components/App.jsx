'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  MESECI,
  DNEVI_KRATKO,
  DNEVI_DOLGO,
  pad,
  parseMonthId,
  daysInMonth,
  dateId,
  todayId,
  currentMonthId,
  weekdayIndex,
  isWeekend,
  shiftMonth,
  monthLabel,
  praznikZa,
} from '@/lib/datum';
import { Razpolozljivost, Urnik } from '@/components/Ekipa';
import { PRIVZETE_SMENE, urSmene, barvaZa, BARVE } from '@/lib/urnik';

const TIPI = [
  { key: 'delo', label: 'Delo' },
  { key: 'dopust', label: 'Dopust' },
  { key: 'bolniska', label: 'Bolniška' },
  { key: 'prosto', label: 'Prost dan' },
];
const TIP_LABEL = {
  delo: 'Delo',
  dopust: 'Dopust',
  bolniska: 'Bolniška',
  prosto: 'Prost dan',
};

const SESSION_KEY = 'lokal-ure-session';

function loadSession() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function storeSession(s) {
  try {
    if (s) window.localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else window.localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

function authHeaders(session) {
  if (!session) return {};
  if (session.isAdmin) return { 'x-admin-pass': session.adminPass };
  return { 'x-emp-id': session.empId, 'x-emp-pass': session.empPass };
}

async function api(path, { session, method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(session),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Napaka (${res.status})`);
  return data;
}

function stevilo(n) {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return String(v).replace('.', ',');
}

// Sešteje mesec: ure dela, ure/dnevi dopusta, bolniške, prostih dni.

// Slovenska množina za "dan".
function dni(n) {
  const x = Math.abs(Number(n) || 0) % 100;
  if (x === 1) return `${n} dan`;
  if (x === 2) return `${n} dneva`;
  if (x === 3 || x === 4) return `${n} dnevi`;
  return `${n} dni`;
}
function povzetek(days) {
  const s = {
    ureDela: 0,
    dniDela: 0,
    ureDopusta: 0,
    dniDopusta: 0,
    ureBolniske: 0,
    dniBolniske: 0,
    dniProsto: 0,
    skupajUr: 0,
  };
  for (const d of Object.values(days || {})) {
    if (d.t === 'delo') {
      s.ureDela += Number(d.h) || 0;
      s.dniDela += 1;
    } else if (d.t === 'dopust') {
      s.ureDopusta += Number(d.h) || 0;
      s.dniDopusta += 1;
    } else if (d.t === 'bolniska') {
      s.ureBolniske += Number(d.h) || 0;
      s.dniBolniske += 1;
    } else if (d.t === 'prosto') {
      s.dniProsto += 1;
    }
  }
  s.skupajUr = s.ureDela + s.ureDopusta + s.ureBolniske;
  return s;
}

/* =====================================================================
   Prijava
   ===================================================================== */

function Login({ boot, onLogin, bootError, onReload }) {
  const [mode, setMode] = useState('employee');
  const [empId, setEmpId] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (boot?.employees?.length && !empId) setEmpId(boot.employees[0].id);
  }, [boot, empId]);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const data = await api('/api/login', {
        method: 'POST',
        body: { mode, empId, password },
      });
      onLogin(
        mode === 'admin'
          ? { isAdmin: true, adminPass: password, name: 'Administrator' }
          : {
              isAdmin: false,
              empId,
              empPass: password,
              name: data.employee.name,
            },
        data.config
      );
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wrap" style={{ maxWidth: 420, paddingTop: 40 }}>
      <div className="card">
        <h2 style={{ fontSize: 18 }}>{boot?.lokalName || 'Evidenca delovnih ur'}</h2>
        <p className="muted" style={{ marginTop: -6 }}>
          Prijavi se z geslom, ki ti ga je dal vodja.
        </p>

        {bootError && (
          <div className="err">
            {bootError}{' '}
            <button className="btn sm sec" onClick={onReload} style={{ marginTop: 8 }}>
              Poskusi znova
            </button>
          </div>
        )}

        <div className="tabs" style={{ paddingBottom: 12 }}>
          <button
            type="button"
            className={mode === 'employee' ? 'active' : ''}
            onClick={() => setMode('employee')}
          >
            Zaposlena
          </button>
          <button
            type="button"
            className={mode === 'admin' ? 'active' : ''}
            onClick={() => setMode('admin')}
          >
            Administrator
          </button>
        </div>

        <form onSubmit={submit}>
          {mode === 'employee' && (
            <label className="field">
              <span>Ime</span>
              <select value={empId} onChange={(e) => setEmpId(e.target.value)}>
                {(boot?.employees || []).length === 0 && (
                  <option value="">Ni še dodanih zaposlenih</option>
                )}
                {(boot?.employees || []).map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="field">
            <span>Geslo</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="Geslo"
            />
          </label>
          {err && <div className="err">{err}</div>}
          <button className="btn full" disabled={busy || !password}>
            {busy ? 'Prijavljam...' : 'Prijava'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* =====================================================================
   Koledar
   ===================================================================== */

function Koledar({ month, days, onPick, readOnly }) {
  const { year, month0 } = parseMonthId(month);
  const total = daysInMonth(year, month0);
  const offset = weekdayIndex(year, month0, 1);
  const today = todayId();

  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(<div key={`b${i}`} className="day blank" />);
  for (let d = 1; d <= total; d++) {
    const id = dateId(year, month0, d);
    const entry = days[id];
    const holiday = praznikZa(id);
    const cls = [
      'day',
      isWeekend(year, month0, d) ? 'wknd' : '',
      id === today ? 'today' : '',
    ]
      .filter(Boolean)
      .join(' ');
    cells.push(
      <button
        key={id}
        type="button"
        className={cls}
        onClick={() => onPick(id)}
        title={holiday || ''}
      >
        <span className="n">{d}</span>
        {holiday && <span className="dot" />}
        {entry?.t === 'delo' && <span className="hrs t-delo" style={{ color: 'var(--delo)' }}>{stevilo(entry.h)}h</span>}
        {entry && entry.t !== 'delo' && (
          <span className={`tag t-${entry.t}`}>
            {entry.t === 'dopust' ? 'Dopust' : entry.t === 'bolniska' ? 'Bolniška' : 'Prosto'}
          </span>
        )}
        {entry?.n && <span className="note">{entry.n}</span>}
        {!entry && readOnly && <span className="note">&nbsp;</span>}
      </button>
    );
  }

  return (
    <>
      <div className="calhead">
        {DNEVI_KRATKO.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="calgrid">{cells}</div>
    </>
  );
}

function Povzetek({ days }) {
  const s = povzetek(days);
  return (
    <div className="sum">
      <div>
        <b>{stevilo(s.ureDela)}</b>
        <span>ur dela</span>
      </div>
      <div>
        <b>{s.dniDopusta}</b>
        <span>dni dopusta</span>
      </div>
      <div>
        <b>{s.dniBolniske}</b>
        <span>dni bolniške</span>
      </div>
      <div>
        <b>{s.dniProsto}</b>
        <span>prostih dni</span>
      </div>
      <div>
        <b>{stevilo(s.skupajUr)}</b>
        <span>skupaj ur</span>
      </div>
    </div>
  );
}

/* =====================================================================
   Vnos dneva
   ===================================================================== */

function DanModal({ date, entry, dailyNorm, onSave, onDelete, onClose, busy, readOnly }) {
  const [tip, setTip] = useState(entry?.t || 'delo');
  const [ure, setUre] = useState(
    entry?.t === 'delo' ? String(entry.h ?? '') : entry?.t ? String(entry.h ?? dailyNorm) : ''
  );
  const [opomba, setOpomba] = useState(entry?.n || '');

  const { year, month0 } = parseMonthId(date.slice(0, 7));
  const dan = Number(date.slice(8, 10));
  const dow = DNEVI_DOLGO[weekdayIndex(year, month0, dan)];
  const holiday = praznikZa(date);

  function shrani() {
    const e = { t: tip, n: opomba };
    if (tip === 'delo') e.h = Number(String(ure).replace(',', '.'));
    else if (tip === 'dopust' || tip === 'bolniska')
      e.h = Number(String(ure || dailyNorm).replace(',', '.'));
    onSave(e);
  }

  const veljavno = tip !== 'delo' || Number(String(ure).replace(',', '.')) > 0;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>
          {dan}. {MESECI[month0].toLowerCase()} {year}
        </h2>
        <p className="muted" style={{ margin: '2px 0 0' }}>
          {dow}
          {holiday ? ` · ${holiday}` : ''}
        </p>

        {readOnly ? (
          <div className="err" style={{ marginTop: 14 }}>
            Mesec je zaključen, vnosov ni mogoče spreminjati.
          </div>
        ) : (
          <>
            <div className="typegrid">
              {TIPI.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={`k-${t.key} ${tip === t.key ? 'on' : ''}`}
                  onClick={() => {
                    setTip(t.key);
                    if (t.key !== 'delo' && !ure) setUre(String(dailyNorm));
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tip !== 'prosto' && (
              <label className="field">
                <span>{tip === 'delo' ? 'Število ur' : 'Ure za obračun (privzeto dnevna norma)'}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={ure}
                  onChange={(e) => setUre(e.target.value)}
                  placeholder={String(dailyNorm)}
                />
                {tip === 'delo' && (
                  <div className="chips">
                    {[4, 6, 8, 10, 12].map((h) => (
                      <button key={h} type="button" onClick={() => setUre(String(h))}>
                        {h}h
                      </button>
                    ))}
                  </div>
                )}
              </label>
            )}

            <label className="field">
              <span>Opomba (neobvezno)</span>
              <textarea
                value={opomba}
                onChange={(e) => setOpomba(e.target.value)}
                placeholder="npr. zamenjava z Ano, inventura ..."
              />
            </label>

            <div className="row" style={{ marginTop: 6 }}>
              <button className="btn grow" onClick={shrani} disabled={busy || !veljavno}>
                {busy ? 'Shranjujem...' : 'Shrani'}
              </button>
              {entry && (
                <button className="btn sec" onClick={onDelete} disabled={busy}>
                  Izbriši
                </button>
              )}
            </div>
          </>
        )}

        <button className="btn sec full" style={{ marginTop: 10 }} onClick={onClose}>
          Zapri
        </button>
      </div>
    </div>
  );
}

/* =====================================================================
   Dopust vnaprej (obdobje)
   ===================================================================== */

function DopustModal({ onClose, onSave, busy }) {
  const [od, setOd] = useState(todayId());
  const [doD, setDoD] = useState(todayId());
  const [tip, setTip] = useState('dopust');
  const [opomba, setOpomba] = useState('');
  const [err, setErr] = useState('');

  function shrani() {
    if (doD < od) {
      setErr('Datum "do" ne more biti pred datumom "od".');
      return;
    }
    const dates = [];
    const start = new Date(od + 'T12:00:00');
    const end = new Date(doD + 'T12:00:00');
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(dateId(d.getFullYear(), d.getMonth(), d.getDate()));
    }
    if (dates.length > 120) {
      setErr('Obdobje je predolgo (največ 120 dni).');
      return;
    }
    onSave(dates, tip, opomba);
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Napovej odsotnost vnaprej</h2>
        <p className="muted" style={{ margin: '2px 0 12px' }}>
          Vpišeš lahko tudi datume v prihodnjih mesecih.
        </p>

        <div className="typegrid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {TIPI.filter((t) => t.key !== 'delo').map((t) => (
            <button
              key={t.key}
              type="button"
              className={`k-${t.key} ${tip === t.key ? 'on' : ''}`}
              onClick={() => setTip(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <label className="field">
          <span>Od</span>
          <input type="date" value={od} onChange={(e) => setOd(e.target.value)} />
        </label>
        <label className="field">
          <span>Do</span>
          <input type="date" value={doD} onChange={(e) => setDoD(e.target.value)} />
        </label>
        <label className="field">
          <span>Opomba (neobvezno)</span>
          <input type="text" value={opomba} onChange={(e) => setOpomba(e.target.value)} />
        </label>

        {err && <div className="err">{err}</div>}

        <div className="row">
          <button className="btn grow" onClick={shrani} disabled={busy}>
            {busy ? 'Shranjujem...' : 'Oddaj'}
          </button>
          <button className="btn sec" onClick={onClose}>
            Prekliči
          </button>
        </div>
        <p className="muted" style={{ marginTop: 10 }}>
          Vikendi in prazniki v obdobju se prav tako zabeležijo - po potrebi jih pobrisi
          posamično v koledarju.
        </p>
      </div>
    </div>
  );
}

/* =====================================================================
   Pogled zaposlene
   ===================================================================== */

function ZaposlenaPogled({ session, config }) {
  const [tab, setTab] = useState('mesec');
  return (
    <div className="wrap">
      <div className="tabs noprint">
        {[
          ['mesec', 'Moje ure'],
          ['urnik', 'Urnik'],
          ['razp', 'Kdaj ne morem'],
        ].map(([k, l]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      {tab === 'mesec' && <ZaposlenaMesec session={session} config={config} />}
      {tab === 'urnik' && (
        <Urnik session={session} config={config} meId={session.empId} isAdmin={false} />
      )}
      {tab === 'razp' && <Razpolozljivost session={session} meId={session.empId} />}
    </div>
  );
}

function ZaposlenaMesec({ session, config }) {
  const [month, setMonth] = useState(currentMonthId());
  const [doc, setDoc] = useState({ days: {}, locked: false });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [pickDate, setPickDate] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dopustOpen, setDopustOpen] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(
    async (m) => {
      setLoading(true);
      setErr('');
      try {
        const data = await api(`/api/entries?month=${m}`, { session });
        setDoc({ days: data.days || {}, locked: Boolean(data.locked) });
      } catch (e) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    },
    [session]
  );

  useEffect(() => {
    load(month);
  }, [month, load]);

  async function shraniDan(entry) {
    setBusy(true);
    setErr('');
    try {
      const data = await api('/api/entries', {
        session,
        method: 'POST',
        body: { month, date: pickDate, entry },
      });
      setDoc({ days: data.days || {}, locked: Boolean(data.locked) });
      setPickDate(null);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function shraniObdobje(dates, tip, opomba) {
    setBusy(true);
    setErr('');
    try {
      const skupine = {};
      for (const d of dates) {
        const m = d.slice(0, 7);
        (skupine[m] ||= []).push({ date: d, entry: { t: tip, n: opomba } });
      }
      for (const [m, days] of Object.entries(skupine)) {
        const data = await api('/api/entries', {
          session,
          method: 'POST',
          body: { month: m, days },
        });
        if (m === month) setDoc({ days: data.days || {}, locked: Boolean(data.locked) });
      }
      setDopustOpen(false);
      setMsg('Odsotnost je oddana.');
      setTimeout(() => setMsg(''), 4000);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="card">
        <div className="monthnav">
          <button onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
          <div className="name">{monthLabel(month)}</div>
          <button onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
        </div>

        {doc.locked && (
          <div className="ok" style={{ background: '#e2e8f0', color: '#475569' }}>
            Mesec je zaključen in zaklenjen.
          </div>
        )}
        {err && <div className="err">{err}</div>}
        {msg && <div className="ok">{msg}</div>}

        {loading ? (
          <p className="muted">Nalagam...</p>
        ) : (
          <>
            <Koledar
              month={month}
              days={doc.days}
              onPick={setPickDate}
              readOnly={doc.locked}
            />
            <Povzetek days={doc.days} />
            <div className="row" style={{ marginTop: 14 }}>
              <button className="btn sec grow" onClick={() => setDopustOpen(true)}>
                + Napovej dopust / bolniško vnaprej
              </button>
              <button className="btn sec" onClick={() => setMonth(currentMonthId())}>
                Danes
              </button>
            </div>
            <p className="muted" style={{ marginTop: 10 }}>
              Klikni na dan v koledarju in vpiši ure. Vijolična pika označuje praznik.
            </p>
          </>
        )}
      </div>

      {pickDate && (
        <DanModal
          date={pickDate}
          entry={doc.days[pickDate]}
          dailyNorm={config.dailyNorm || 8}
          busy={busy}
          readOnly={doc.locked}
          onSave={shraniDan}
          onDelete={() => shraniDan(null)}
          onClose={() => setPickDate(null)}
        />
      )}
      {dopustOpen && (
        <DopustModal busy={busy} onClose={() => setDopustOpen(false)} onSave={shraniObdobje} />
      )}
    </>
  );
}

/* =====================================================================
   Evidenca za izpis
   ===================================================================== */

function EvidencaList({ emp, month, doc, lokalName }) {
  const { year, month0 } = parseMonthId(month);
  const total = daysInMonth(year, month0);
  const s = povzetek(doc.days);
  const rows = [];

  for (let d = 1; d <= total; d++) {
    const id = dateId(year, month0, d);
    const e = doc.days[id];
    const hol = praznikZa(id);
    const wk = isWeekend(year, month0, d);
    rows.push(
      <tr key={id} className={hol ? 'hol' : wk ? 'wknd' : ''}>
        <td>{`${pad(d)}.${pad(month0 + 1)}.`}</td>
        <td>{DNEVI_KRATKO[weekdayIndex(year, month0, d)]}</td>
        <td className="num">{e?.t === 'delo' ? stevilo(e.h) : ''}</td>
        <td className="num">{e?.t === 'dopust' ? stevilo(e.h) : ''}</td>
        <td className="num">{e?.t === 'bolniska' ? stevilo(e.h) : ''}</td>
        <td className="num">{e?.t === 'prosto' ? 'X' : ''}</td>
        <td>{[hol, e?.n].filter(Boolean).join(' · ')}</td>
      </tr>
    );
  }

  return (
    <div className="sheet" style={{ marginBottom: 26 }}>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: '#64748b' }}>{lokalName}</div>
        <div style={{ fontSize: 17, fontWeight: 800 }}>{emp.name}</div>
        <div style={{ fontSize: 13, color: '#64748b' }}>
          Evidenca delovnega časa · {monthLabel(month)}
        </div>
      </div>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Datum</th>
              <th>Dan</th>
              <th className="num">Ure dela</th>
              <th className="num">Dopust (ur)</th>
              <th className="num">Bolniška (ur)</th>
              <th className="num">Prosto</th>
              <th>Opomba / praznik</th>
            </tr>
          </thead>
          <tbody>{rows}</tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>SKUPAJ</td>
              <td className="num">{stevilo(s.ureDela)}</td>
              <td className="num">{stevilo(s.ureDopusta)}</td>
              <td className="num">{stevilo(s.ureBolniske)}</td>
              <td className="num">{s.dniProsto}</td>
              <td>
{dni(s.dniDela)} dela · {dni(s.dniDopusta)} dopusta · {dni(s.dniBolniske)}{' '}
                bolniške · skupaj {stevilo(s.skupajUr)} ur
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div style={{ marginTop: 22, display: 'flex', gap: 40, fontSize: 12, color: '#64748b' }}>
        <div>Podpis zaposlene: ______________________</div>
        <div>Podpis delodajalca: ______________________</div>
      </div>
    </div>
  );
}

/* =====================================================================
   Administrator
   ===================================================================== */

function AdminPogled({ session, config, setConfig }) {
  const [tab, setTab] = useState('urnik');
  return (
    <div className="wrap">
      <div className="tabs noprint">
        {[
          ['urnik', 'Urnik'],
          ['razp', 'Razpoložljivost'],
          ['evidenca', 'Evidenca / izpis'],
          ['pregled', 'Pregled meseca'],
          ['dopusti', 'Napovedani dopusti'],
          ['zaposleni', 'Zaposleni'],
          ['nastavitve', 'Nastavitve'],
        ].map(([k, l]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      {tab === 'urnik' && (
        <Urnik session={session} config={config} meId={null} isAdmin={true} />
      )}
      {tab === 'razp' && <Razpolozljivost session={session} meId={null} />}
      {tab === 'evidenca' && <AdminEvidenca session={session} config={config} />}
      {tab === 'pregled' && <AdminPregled session={session} />}
      {tab === 'dopusti' && <AdminDopusti session={session} />}
      {tab === 'zaposleni' && <AdminZaposleni session={session} />}
      {tab === 'nastavitve' && (
        <AdminNastavitve session={session} config={config} setConfig={setConfig} />
      )}
    </div>
  );
}

function useMesec(session, month) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr('');
    api(`/api/entries?month=${month}&all=1`, { session })
      .then((d) => alive && setData(d))
      .catch((e) => alive && setErr(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [session, month, nonce]);

  return { data, err, loading, reload: () => setNonce((n) => n + 1) };
}

function AdminEvidenca({ session, config }) {
  const [month, setMonth] = useState(currentMonthId());
  const [izbrani, setIzbrani] = useState([]);
  const { data, err, loading, reload } = useMesec(session, month);
  const [busy, setBusy] = useState(false);

  const employees = data?.employees || [];
  const shown = employees.filter((e) => izbrani.includes(e.id));

  function toggle(id) {
    setIzbrani((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function zakleni(empId, locked) {
    setBusy(true);
    try {
      await api('/api/entries', {
        session,
        method: 'POST',
        body: { empId, month, locked },
      });
      reload();
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="card noprint">
        <div className="monthnav">
          <button onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
          <div className="name">{monthLabel(month)}</div>
          <button onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
        </div>

        <h3>Označi zaposlene za izpis</h3>
        {err && <div className="err">{err}</div>}
        {loading && <p className="muted">Nalagam...</p>}
        <div className="sum" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
          {employees.map((e) => {
            const s = povzetek(data.months[e.id]?.days);
            const locked = data.months[e.id]?.locked;
            return (
              <label key={e.id} className="pick">
                <input
                  type="checkbox"
                  checked={izbrani.includes(e.id)}
                  onChange={() => toggle(e.id)}
                />
                <span>
                  <b>{e.name}</b>
                  <br />
                  <span className="muted">
                    {stevilo(s.ureDela)} ur · {s.dniDopusta} dop. · {s.dniBolniske} boln.
                    {locked ? ' · zaklenjeno' : ''}
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <button
            className="btn sec sm"
            onClick={() => setIzbrani(employees.map((e) => e.id))}
          >
            Označi vse
          </button>
          <button className="btn sec sm" onClick={() => setIzbrani([])}>
            Počisti
          </button>
          <button
            className="btn sm"
            onClick={() => window.print()}
            disabled={shown.length === 0}
          >
            Natisni / shrani PDF
          </button>
        </div>

        {shown.length > 0 && (
          <div className="row" style={{ marginTop: 10 }}>
            {shown.map((e) => {
              const locked = data.months[e.id]?.locked;
              return (
                <button
                  key={e.id}
                  className="btn sec sm"
                  disabled={busy}
                  onClick={() => zakleni(e.id, !locked)}
                >
                  {locked ? `Odkleni ${e.name}` : `Zaključi mesec: ${e.name}`}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {shown.length > 0 && (
        <div className="card">
          {shown.map((e) => (
            <EvidencaList
              key={e.id}
              emp={e}
              month={month}
              doc={data.months[e.id] || { days: {} }}
              lokalName={config.lokalName || ''}
            />
          ))}
        </div>
      )}
    </>
  );
}

function AdminPregled({ session }) {
  const [month, setMonth] = useState(currentMonthId());
  const { data, err, loading } = useMesec(session, month);
  const { year, month0 } = parseMonthId(month);
  const total = daysInMonth(year, month0);

  return (
    <div className="card">
      <div className="monthnav noprint">
        <button onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
        <div className="name">{monthLabel(month)}</div>
        <button onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
      </div>
      {err && <div className="err">{err}</div>}
      {loading && <p className="muted">Nalagam...</p>}
      {data && (
        <div className="tablewrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, background: '#f8fafc' }}>Zaposlena</th>
                {Array.from({ length: total }, (_, i) => {
                  const d = i + 1;
                  const hol = praznikZa(dateId(year, month0, d));
                  return (
                    <th
                      key={d}
                      className="num"
                      style={{
                        padding: '4px 3px',
                        color: hol ? 'var(--praznik)' : isWeekend(year, month0, d) ? '#94a3b8' : undefined,
                      }}
                      title={hol || ''}
                    >
                      {d}
                    </th>
                  );
                })}
                <th className="num">Ur</th>
              </tr>
            </thead>
            <tbody>
              {data.employees.map((e) => {
                const days = data.months[e.id]?.days || {};
                const s = povzetek(days);
                return (
                  <tr key={e.id}>
                    <td style={{ position: 'sticky', left: 0, background: '#fff', fontWeight: 600 }}>
                      {e.name}
                    </td>
                    {Array.from({ length: total }, (_, i) => {
                      const id = dateId(year, month0, i + 1);
                      const en = days[id];
                      let txt = '';
                      let color;
                      if (en?.t === 'delo') {
                        txt = stevilo(en.h);
                        color = 'var(--delo)';
                      } else if (en?.t === 'dopust') {
                        txt = 'D';
                        color = 'var(--dopust)';
                      } else if (en?.t === 'bolniska') {
                        txt = 'B';
                        color = 'var(--bolniska)';
                      } else if (en?.t === 'prosto') {
                        txt = '·';
                        color = 'var(--prosto)';
                      }
                      return (
                        <td
                          key={id}
                          className="num"
                          style={{ padding: '4px 3px', color, fontWeight: 700 }}
                          title={en?.n || ''}
                        >
                          {txt}
                        </td>
                      );
                    })}
                    <td className="num">
                      <b>{stevilo(s.ureDela)}</b>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted" style={{ marginTop: 10 }}>
        Številka = ure dela, D = dopust, B = bolniska, · = prost dan. Miška nad polje pokaže
        opombo.
      </p>
    </div>
  );
}

function AdminDopusti({ session }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const base = currentMonthId();
        const months = [0, 1, 2, 3].map((i) => shiftMonth(base, i));
        const out = [];
        for (const m of months) {
          const d = await api(`/api/entries?month=${m}&all=1`, { session });
          for (const e of d.employees) {
            const days = d.months[e.id]?.days || {};
            for (const [date, en] of Object.entries(days)) {
              if ((en.t === 'dopust' || en.t === 'bolniska') && date >= todayId()) {
                out.push({ date, name: e.name, tip: en.t, n: en.n });
              }
            }
          }
        }
        out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
        if (alive) setRows(out);
      } catch (e) {
        if (alive) setErr(e.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [session]);

  return (
    <div className="card">
      <h2>Napovedane odsotnosti (naslednji 4 meseci)</h2>
      {err && <div className="err">{err}</div>}
      {loading && <p className="muted">Nalagam...</p>}
      {rows && rows.length === 0 && <p className="muted">Ni napovedanih odsotnosti.</p>}
      {rows && rows.length > 0 && (
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Datum</th>
                <th>Dan</th>
                <th>Zaposlena</th>
                <th>Vrsta</th>
                <th>Opomba</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const y = Number(r.date.slice(0, 4));
                const m0 = Number(r.date.slice(5, 7)) - 1;
                const d = Number(r.date.slice(8, 10));
                return (
                  <tr key={i}>
                    <td>{`${pad(d)}.${pad(m0 + 1)}.${y}`}</td>
                    <td>{DNEVI_KRATKO[weekdayIndex(y, m0, d)]}</td>
                    <td>
                      <b>{r.name}</b>
                    </td>
                    <td style={{ color: r.tip === 'dopust' ? 'var(--dopust)' : 'var(--bolniska)' }}>
                      {TIP_LABEL[r.tip]}
                    </td>
                    <td>{r.n || ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AdminZaposleni({ session }) {
  const [list, setList] = useState([]);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [name, setName] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [pokaziGesla, setPokažiGesla] = useState(false);
  const [kind, setKind] = useState('zaposlena');

  const load = useCallback(async () => {
    try {
      const d = await api('/api/employees', { session });
      setList(d.employees || []);
    } catch (e) {
      setErr(e.message);
    }
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  async function dodaj(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await api('/api/employees', {
        session,
        method: 'POST',
        body: { name, password: pass, kind },
      });
      setName('');
      setPass('');
      setMsg('Zaposlena je dodana.');
      setTimeout(() => setMsg(''), 3000);
      load();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  async function spremeni(id, patch) {
    try {
      await api('/api/employees', { session, method: 'PATCH', body: { id, ...patch } });
      load();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function izbrisi(emp) {
    if (
      !confirm(
        `Izbrisati ${emp.name} in VSE njene vnose? Tega ni mogoče razveljaviti.\n\nČe želiš samo, da se ne more več prijaviti, uporabi "Deaktiviraj".`
      )
    )
      return;
    try {
      await api(`/api/employees?id=${encodeURIComponent(emp.id)}`, {
        session,
        method: 'DELETE',
      });
      load();
    } catch (e) {
      setErr(e.message);
    }
  }

  function novoGeslo(emp) {
    const g = prompt(`Novo geslo za ${emp.name} (vsaj 4 znaki):`);
    if (g && g.length >= 4) spremeni(emp.id, { password: g });
  }

  return (
    <>
      <div className="card">
        <h2>Dodaj zaposleno</h2>
        <form onSubmit={dodaj}>
          <div className="row">
            <label className="field grow">
              <span>Ime in priimek</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ana Novak" />
            </label>
            <label className="field grow">
              <span>Geslo (vsaj 4 znaki)</span>
              <input value={pass} onChange={(e) => setPass(e.target.value)} placeholder="npr. ana2026" />
            </label>
          </div>
          <div className="typegrid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <button
              type="button"
              className={`k-razp ${kind === 'zaposlena' ? 'on' : ''}`}
              onClick={() => setKind('zaposlena')}
            >
              Zaposlena (polni delovnik)
            </button>
            <button
              type="button"
              className={`k-razp ${kind === 'studentka' ? 'on' : ''}`}
              onClick={() => setKind('studentka')}
            >
              Študentka (zapolni ostalo)
            </button>
          </div>
          {err && <div className="err">{err}</div>}
          {msg && <div className="ok">{msg}</div>}
          <button className="btn" disabled={busy || !name || pass.length < 4}>
            Dodaj
          </button>
        </form>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>Seznam zaposlenih</h2>
          <button className="btn sec sm" onClick={() => setPokažiGesla((v) => !v)}>
            {pokaziGesla ? 'Skrij gesla' : 'Pokaži gesla'}
          </button>
        </div>
        <div className="emplist" style={{ marginTop: 12 }}>
          {list.length === 0 && <p className="muted">Še ni dodanih zaposlenih.</p>}
          {list.map((e, i) => (
            <div className="emprow" key={e.id} style={{ borderLeft: `5px solid ${e.color || barvaZa(i)}` }}>
              <div>
                <b style={{ opacity: e.active === false ? 0.5 : 1 }}>{e.name}</b>
                {e.active === false && <span className="muted"> · neaktivna</span>}
                <div className="muted">
                  {e.kind === 'studentka' ? 'Študentka' : 'Zaposlena'} · Geslo:{' '}
                  {pokaziGesla ? e.password : '••••••'}
                </div>
                <div className="row" style={{ marginTop: 6, gap: 4 }}>
                  {BARVE.map((c) => (
                    <button
                      key={c}
                      title="Barva v koledarju"
                      onClick={() => spremeni(e.id, { color: c })}
                      className={`swatch ${(e.color || barvaZa(i)) === c ? 'on' : ''}`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="row">
                <button
                  className="btn sec sm"
                  onClick={() =>
                    spremeni(e.id, {
                      kind: e.kind === 'studentka' ? 'zaposlena' : 'studentka',
                    })
                  }
                >
                  {e.kind === 'studentka' ? '→ Zaposlena' : '→ Študentka'}
                </button>
                <button className="btn sec sm" onClick={() => novoGeslo(e)}>
                  Novo geslo
                </button>
                <button
                  className="btn sec sm"
                  onClick={() => spremeni(e.id, { active: e.active === false })}
                >
                  {e.active === false ? 'Aktiviraj' : 'Deaktiviraj'}
                </button>
                <button className="btn danger sm" onClick={() => izbrisi(e)}>
                  Izbriši
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function AdminNastavitve({ session, config, setConfig }) {
  const [lokalName, setLokalName] = useState(config.lokalName || '');
  const [dailyNorm, setDailyNorm] = useState(String(config.dailyNorm || 8));
  const [adminPassword, setAdminPassword] = useState('');
  const [weeklyNorm, setWeeklyNorm] = useState(String(config.weeklyNorm || 40));
  const [shifts, setShifts] = useState(
    (config.shifts && config.shifts.length ? config.shifts : PRIVZETE_SMENE).map((s) => ({ ...s }))
  );
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  function setShift(i, patch) {
    setShifts((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  }

  async function shrani(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const body = {
        lokalName,
        dailyNorm: Number(dailyNorm),
        weeklyNorm: Number(weeklyNorm),
        shifts,
      };
      if (adminPassword) body.adminPassword = adminPassword;
      await api('/api/config', { session, method: 'PUT', body });
      setConfig({
        ...config,
        lokalName,
        dailyNorm: Number(dailyNorm),
        weeklyNorm: Number(weeklyNorm),
        shifts,
      });
      setMsg(
        adminPassword
          ? 'Shranjeno. Geslo administratorja je spremenjeno - ob naslednji prijavi uporabi novega.'
          : 'Shranjeno.'
      );
      setAdminPassword('');
      setTimeout(() => setMsg(''), 6000);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2>Nastavitve</h2>
      <form onSubmit={shrani}>
        <label className="field">
          <span>Ime lokala (prikazano v glavi in na izpisu)</span>
          <input value={lokalName} onChange={(e) => setLokalName(e.target.value)} />
        </label>
        <label className="field">
          <span>Dnevna norma ur (za dopust in bolniško)</span>
          <input
            type="number"
            step="0.5"
            min="1"
            max="24"
            value={dailyNorm}
            onChange={(e) => setDailyNorm(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Tedenska norma zaposlene (ur)</span>
          <input
            type="number"
            step="1"
            min="1"
            max="60"
            value={weeklyNorm}
            onChange={(e) => setWeeklyNorm(e.target.value)}
          />
        </label>

        <h3 style={{ marginTop: 18 }}>Smene</h3>
        <p className="muted" style={{ marginTop: -4 }}>
          Dve dopoldan in dve popoldan. Prva odpira, zadnja zapira.
        </p>
        <div className="shiftedit">
          {shifts.map((s, i) => (
            <div className="shiftedit-row" key={s.key || i}>
              <input
                value={s.label}
                onChange={(e) => setShift(i, { label: e.target.value })}
                placeholder="Ime smene"
              />
              <input
                type="time"
                value={s.start}
                onChange={(e) => setShift(i, { start: e.target.value })}
              />
              <input
                type="time"
                value={s.end}
                onChange={(e) => setShift(i, { end: e.target.value })}
              />
              <select value={s.del} onChange={(e) => setShift(i, { del: e.target.value })}>
                <option value="dop">Dopoldan</option>
                <option value="pop">Popoldan</option>
              </select>
              <span className="muted">{String(urSmene(s)).replace('.', ',')}h</span>
            </div>
          ))}
        </div>

        <label className="field" style={{ marginTop: 16 }}>
          <span>Novo geslo administratorja (pusti prazno, če ga ne spreminjaš)</span>
          <input
            type="text"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            placeholder="vsaj 4 znaki"
          />
        </label>
        {err && <div className="err">{err}</div>}
        {msg && <div className="ok">{msg}</div>}
        <button className="btn" disabled={busy}>
          Shrani nastavitve
        </button>
      </form>
    </div>
  );
}

/* =====================================================================
   Korenska komponenta
   ===================================================================== */

export default function App() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  const [boot, setBoot] = useState(null);
  const [bootError, setBootError] = useState('');
  const [config, setConfig] = useState({
    lokalName: '',
    dailyNorm: 8,
    weeklyNorm: 40,
    shifts: PRIVZETE_SMENE,
  });

  const loadBoot = useCallback(async () => {
    setBootError('');
    try {
      const d = await api('/api/config');
      setBoot(d);
      setConfig((c) => ({
        ...c,
        lokalName: d.lokalName,
        dailyNorm: d.dailyNorm,
        weeklyNorm: d.weeklyNorm || c.weeklyNorm,
        shifts: d.shifts && d.shifts.length ? d.shifts : c.shifts,
      }));
    } catch (e) {
      setBootError(e.message);
    }
  }, []);

  useEffect(() => {
    setSession(loadSession());
    setReady(true);
    loadBoot();
  }, [loadBoot]);

  function onLogin(s, cfg) {
    storeSession(s);
    setSession(s);
    if (cfg) setConfig((c) => ({ ...c, ...cfg }));
  }

  function odjava() {
    storeSession(null);
    setSession(null);
  }

  if (!ready) return null;

  if (!session) {
    return (
      <Login boot={boot} bootError={bootError} onLogin={onLogin} onReload={loadBoot} />
    );
  }

  return (
    <>
      <div className="topbar noprint">
        <div>
          <h1>{config.lokalName || 'Evidenca delovnih ur'}</h1>
          <div className="who">
            {session.isAdmin ? 'Administrator' : session.name}
          </div>
        </div>
        <button className="linkbtn" onClick={odjava}>
          Odjava
        </button>
      </div>
      {session.isAdmin ? (
        <AdminPogled session={session} config={config} setConfig={setConfig} />
      ) : (
        <ZaposlenaPogled session={session} config={config} />
      )}
    </>
  );
}
