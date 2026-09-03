'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  MESECI,
  DNEVI_KRATKO,
  DNEVI_DOLGO,
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
import {
  smeneZaDan,
  urSmene,
  opisSmene,
  barvaZa,
  ponedeljek,
  dneviTedna,
  premakniTeden,
  oznakaTedna,
  ureVTednu,
  predlagajUrnik,
  jeProsta,
  krsiPocitek,
  kljucOdpiranja,
  kljucZapiranja,
  NEMOREM_LABEL,
  ustvariIcs,
  prenesi,
} from '@/lib/urnik';

/* --------------------------------------------------------------- api */

function authHeaders(session) {
  if (!session) return {};
  if (session.isAdmin) return { 'x-admin-pass': session.adminPass };
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

export function kratkoIme(name) {
  const prvi = String(name || '').trim().split(/\s+/)[0] || '?';
  return prvi.length > 8 ? prvi.slice(0, 8) : prvi;
}

function barvaEmp(e, i) {
  return e?.color || barvaZa(i);
}

function st(n) {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return String(v).replace('.', ',');
}

/* =================================================================
   1. Koledar razpoložljivosti
   Zaposlena vidi in ureja SAMO sebe; administrator vidi vso ekipo.
   ================================================================= */

const IZBIRE = [
  { key: '', label: 'Lahko delam' },
  { key: 'ves', label: 'Cel dan ne morem' },
  { key: 'dop', label: 'Dopoldne ne morem' },
  { key: 'pop', label: 'Popoldne ne morem' },
];

function DanRazpModal({ date, data, meId, isAdmin, config, onSet, onClose, busy }) {
  const { employees, nemorem } = data;
  const y = Number(date.slice(0, 4));
  const m0 = Number(date.slice(5, 7)) - 1;
  const d = Number(date.slice(8, 10));
  const praznik = praznikZa(date);
  const moja = meId ? nemorem[meId]?.[date] || '' : null;
  const dnevneSmene = smeneZaDan(config, date);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>
          {d}. {MESECI[m0].toLowerCase()} {y}
        </h2>
        <p className="muted" style={{ margin: '2px 0 14px' }}>
          {DNEVI_DOLGO[weekdayIndex(y, m0, d)]}
          {praznik ? ` · ${praznik}` : ''}
        </p>

        {meId && (
          <>
            <h3 style={{ margin: '0 0 8px' }}>Moja razpoložljivost</h3>
            <div className="typegrid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {IZBIRE.map((iz) => (
                <button
                  key={iz.key || 'ok'}
                  type="button"
                  disabled={busy}
                  className={`k-razp ${moja === iz.key ? 'on' : ''}`}
                  onClick={() => onSet(date, iz.key)}
                >
                  {iz.label}
                </button>
              ))}
            </div>
            <p className="muted" style={{ marginTop: 8 }}>
              Razloga ni treba pisati - vodja vidi samo, da ta dan ne moreš.
            </p>
          </>
        )}

        {isAdmin && (
          <>
            <h3 style={{ margin: '0 0 8px' }}>Kdo lahko dela</h3>
            <div className="shiftlist">
              {dnevneSmene.map((sh) => {
                const na = employees.filter((e) => jeProsta(e.id, date, sh, nemorem, null));
                return (
                  <div key={sh.key} className="shiftrow">
                    <div className="shiftname">
                      <b>{sh.label}</b>
                      <span className="muted">{opisSmene(sh)}</span>
                    </div>
                    <div className="chipsrow">
                      {na.length === 0 && <span className="muted">nihče</span>}
                      {na.map((e) => (
                        <span
                          key={e.id}
                          className="pill"
                          style={{ background: barvaEmp(e, employees.indexOf(e)) }}
                        >
                          {kratkoIme(e.name)}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <h3 style={{ margin: '16px 0 8px' }}>Ta dan ne more</h3>
            <div className="chipsrow">
              {employees.filter((e) => nemorem[e.id]?.[date]).length === 0 && (
                <span className="muted">nihče</span>
              )}
              {employees
                .filter((e) => nemorem[e.id]?.[date])
                .map((e) => {
                  const c = barvaEmp(e, employees.indexOf(e));
                  return (
                    <span key={e.id} className="pill out" style={{ borderColor: c, color: c }}>
                      {kratkoIme(e.name)} · {NEMOREM_LABEL[nemorem[e.id][date]].toLowerCase()}
                    </span>
                  );
                })}
            </div>
          </>
        )}

        <button className="btn sec full" style={{ marginTop: 16 }} onClick={onClose}>
          Zapri
        </button>
      </div>
    </div>
  );
}

export function Razpolozljivost({ session, meId, config }) {
  const isAdmin = Boolean(session?.isAdmin);
  const [month, setMonth] = useState(currentMonthId());
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [pick, setPick] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (m) => {
      setLoading(true);
      setErr('');
      try {
        setData(await api(`/api/nemorem?month=${m}`, { session }));
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

  async function nastavi(date, val) {
    setBusy(true);
    try {
      await api('/api/nemorem', {
        session,
        method: 'POST',
        body: { month, dates: { [date]: val || null } },
      });
      setData((prev) => {
        const next = { ...prev, nemorem: { ...prev.nemorem } };
        const mine = { ...(next.nemorem[meId] || {}) };
        if (val) mine[date] = val;
        else delete mine[date];
        next.nemorem[meId] = mine;
        return next;
      });
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const { year, month0 } = parseMonthId(month);
  const total = daysInMonth(year, month0);
  const offset = weekdayIndex(year, month0, 1);
  const today = todayId();

  return (
    <div className="card">
      <div className="monthnav noprint">
        <button onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
        <div className="name">{monthLabel(month)}</div>
        <button onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
      </div>

      <p className="muted" style={{ marginTop: 0 }}>
        {isAdmin
          ? 'Pregled cele ekipe. Klikni na dan in vidiš, kdo lahko dela na kateri smeni.'
          : 'Klikni na dan in označi, kdaj ne moreš delati. Vidiš samo svoje vnose - razloga ni treba pisati.'}
      </p>

      {err && <div className="err">{err}</div>}
      {loading && <p className="muted">Nalagam...</p>}

      {data && (
        <>
          {isAdmin && (
            <div className="legend">
              {data.employees.map((e, i) => (
                <span key={e.id} className="leg">
                  <i style={{ background: barvaEmp(e, i) }} />
                  {e.name}
                  {e.kind === 'studentka' ? ' (š)' : ''}
                </span>
              ))}
            </div>
          )}

          <div className="calhead">
            {DNEVI_KRATKO.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="calgrid razp">
            {Array.from({ length: offset }, (_, i) => (
              <div key={`b${i}`} className="day blank" />
            ))}
            {Array.from({ length: total }, (_, i) => {
              const d = i + 1;
              const id = dateId(year, month0, d);
              const hol = praznikZa(id);
              const odsotne = data.employees
                .map((e, idx) => ({ e, idx, v: data.nemorem[e.id]?.[id] }))
                .filter((x) => x.v);
              const cls = [
                'day',
                isWeekend(year, month0, d) ? 'wknd' : '',
                id === today ? 'today' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <button key={id} type="button" className={cls} onClick={() => setPick(id)}>
                  <span className="n">{d}</span>
                  {hol && <span className="dot" />}
                  {isAdmin ? (
                    <span className="marks">
                      {odsotne.slice(0, 6).map(({ e, idx, v }) => (
                        <i
                          key={e.id}
                          title={`${e.name} – ${NEMOREM_LABEL[v]}`}
                          className={`mark ${v}`}
                          style={{ background: barvaEmp(e, idx) }}
                        />
                      ))}
                      {odsotne.length > 6 && <i className="mark more">+</i>}
                    </span>
                  ) : (
                    odsotne[0] && (
                      <span className={`tag t-nemorem`}>
                        {NEMOREM_LABEL[odsotne[0].v]}
                      </span>
                    )
                  )}
                </button>
              );
            })}
          </div>

          <p className="muted" style={{ marginTop: 10 }}>
            {isAdmin
              ? 'Polna pikica = cel dan, zgornja polovica = dopoldne, spodnja = popoldne.'
              : 'Dnevi brez oznake pomenijo, da si na voljo.'}
          </p>
        </>
      )}

      {pick && data && (
        <DanRazpModal
          date={pick}
          data={data}
          meId={meId}
          isAdmin={isAdmin}
          config={config}
          busy={busy}
          onSet={nastavi}
          onClose={() => setPick(null)}
        />
      )}
    </div>
  );
}

/* =================================================================
   2. Tedenski urnik
   ================================================================= */

export function Urnik({ session, config, meId, isAdmin }) {
  const [monday, setMonday] = useState(ponedeljek(todayId()));
  const [urniki, setUrniki] = useState({});
  const [employees, setEmployees] = useState([]);
  const [nemorem, setNemorem] = useState({});
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const dni = useMemo(() => dneviTedna(monday), [monday]);
  const meseci = useMemo(() => {
    // vključi tudi mesec prejšnjega dne - potrebujemo nedeljo prej za
    // pravilo "kdor zapira, ne odpira"
    const set = new Set(dni.map((d) => d.slice(0, 7)));
    const prej = new Date(monday + 'T12:00:00');
    prej.setDate(prej.getDate() - 1);
    set.add(dateId(prej.getFullYear(), prej.getMonth(), prej.getDate()).slice(0, 7));
    return Array.from(set);
  }, [dni, monday]);

  const weeklyNorm = Number(config?.weeklyNorm) || 40;

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const u = await api(`/api/urnik?months=${meseci.join(',')}`, { session });
      setUrniki(u.urniki || {});
      setEmployees(u.employees || []);
      if (isAdmin) {
        const nm = {};
        for (const m of meseci) {
          const r = await api(`/api/nemorem?month=${m}`, { session });
          for (const [id, map] of Object.entries(r.nemorem || {})) {
            nm[id] = { ...(nm[id] || {}), ...map };
          }
        }
        setNemorem(nm);
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [session, meseci, isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  const days = useMemo(() => {
    const out = {};
    for (const m of meseci) Object.assign(out, urniki[m]?.days || {});
    return out;
  }, [urniki, meseci]);

  const objavljen = useMemo(() => {
    const m = monday.slice(0, 7);
    return Boolean(urniki[m]?.objavljen?.[monday]);
  }, [urniki, monday]);

  async function shraniDneve(noviDnevi) {
    setBusy(true);
    setErr('');
    try {
      const poMesecih = {};
      for (const [date, dan] of Object.entries(noviDnevi)) {
        const m = date.slice(0, 7);
        (poMesecih[m] ||= {})[date] = dan;
      }
      const next = { ...urniki };
      for (const [m, ds] of Object.entries(poMesecih)) {
        const r = await api('/api/urnik', { session, method: 'POST', body: { month: m, days: ds } });
        next[m] = { days: r.days, objavljen: r.objavljen };
      }
      setUrniki(next);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  function nastaviSmeno(date, key, empId) {
    const dan = { ...(days[date] || {}) };
    if (empId) dan[key] = empId;
    else delete dan[key];
    shraniDneve({ [date]: dan });
  }

  async function predlagaj() {
    const noviDnevi = predlagajUrnik({
      dni,
      employees,
      config,
      nemorem,
      evidenca: null,
      weeklyNorm,
      obstojeci: days,
    });
    const samoTaTeden = {};
    for (const d of dni) samoTaTeden[d] = noviDnevi[d] || {};
    await shraniDneve(samoTaTeden);
    setMsg('Predlog je pripravljen. Preglej ga in po potrebi popravi.');
    setTimeout(() => setMsg(''), 6000);
  }

  async function pocisti() {
    if (!confirm('Počistiti cel teden?')) return;
    const prazni = {};
    for (const d of dni) prazni[d] = {};
    await shraniDneve(prazni);
  }

  async function objavi() {
    setBusy(true);
    try {
      const m = monday.slice(0, 7);
      const r = await api('/api/urnik', {
        session,
        method: 'POST',
        body: { month: m, objavljen: { [monday]: !objavljen } },
      });
      setUrniki({ ...urniki, [m]: { days: r.days, objavljen: r.objavljen } });
      setMsg(objavljen ? 'Urnik je skrit.' : 'Urnik je objavljen - zaposlene ga zdaj vidijo.');
      setTimeout(() => setMsg(''), 5000);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const mojeSmene = useMemo(() => {
    if (!meId) return [];
    const out = [];
    for (const d of dni) {
      for (const sh of smeneZaDan(config, d)) {
        if (days[d]?.[sh.key] === meId) out.push({ date: d, sh });
      }
    }
    return out;
  }, [days, dni, config, meId]);

  function izvoziIcs() {
    if (mojeSmene.length === 0) {
      alert('Ta teden nimaš vpisanih smen.');
      return;
    }
    const me = employees.find((e) => e.id === meId);
    const ics = ustvariIcs({
      vnosi: mojeSmene.map(({ date, sh }) => ({
        date,
        key: sh.key,
        label: sh.label,
        start: sh.start,
        end: sh.end,
      })),
      ime: me?.name || 'Urnik',
      lokalName: config?.lokalName || '',
    });
    prenesi(`urnik-${monday}.ics`, ics);
  }

  // Zaposlena vidi samo svoj seštevek, administrator vse.
  const skupaj = useMemo(() => {
    const vidni = isAdmin ? employees : employees.filter((e) => e.id === meId);
    return vidni.map((e) => ({
      ...e,
      i: employees.indexOf(e),
      ...ureVTednu(days, dni, e.id, config),
      norma: e.kind === 'studentka' ? Number(e.weeklyNorm) || 0 : Number(e.weeklyNorm) || weeklyNorm,
    }));
  }, [employees, days, dni, config, weeklyNorm, isAdmin, meId]);

  // Vrstice tabele: unija ključev smen čez teden, urejena po začetku.
  const vrstice = useMemo(() => {
    const map = new Map();
    for (const d of dni) {
      for (const sh of smeneZaDan(config, d)) {
        if (!map.has(sh.key)) map.set(sh.key, sh);
      }
    }
    return Array.from(map.values());
  }, [dni, config]);

  const vidno = isAdmin || objavljen;

  return (
    <>
      <div className="card noprint">
        <div className="monthnav">
          <button onClick={() => setMonday(premakniTeden(monday, -1))}>‹</button>
          <div className="name">Teden {oznakaTedna(monday)}</div>
          <button onClick={() => setMonday(premakniTeden(monday, 1))}>›</button>
        </div>

        <div className="row" style={{ marginTop: 4 }}>
          <button className="btn sec sm" onClick={() => setMonday(ponedeljek(todayId()))}>
            Ta teden
          </button>
          {isAdmin && (
            <>
              <button className="btn sm" onClick={predlagaj} disabled={busy || loading}>
                Predlagaj urnik
              </button>
              <button className="btn sec sm" onClick={pocisti} disabled={busy}>
                Počisti teden
              </button>
              <button className="btn sec sm" onClick={objavi} disabled={busy}>
                {objavljen ? 'Skrij urnik' : 'Objavi urnik'}
              </button>
            </>
          )}
          <button className="btn sec sm" onClick={() => window.print()}>
            Natisni
          </button>
          {meId && (
            <button className="btn sec sm" onClick={izvoziIcs}>
              Dodaj v koledar (.ics)
            </button>
          )}
        </div>

        {err && <div className="err">{err}</div>}
        {msg && <div className="ok">{msg}</div>}
        {isAdmin && !objavljen && (
          <div className="ok" style={{ background: '#fef3c7', color: '#92400e' }}>
            Ta teden še ni objavljen - zaposlene ga še ne vidijo.
          </div>
        )}
      </div>

      {loading && (
        <div className="card">
          <p className="muted">Nalagam...</p>
        </div>
      )}

      {!loading && !vidno && (
        <div className="card">
          <p className="muted">Urnik za ta teden še ni objavljen.</p>
        </div>
      )}

      {!loading && vidno && (
        <div className="card">
          <div className="sheet">
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: '#64748b' }}>{config?.lokalName || ''}</div>
              <div style={{ fontSize: 17, fontWeight: 800 }}>Urnik · {oznakaTedna(monday)}</div>
            </div>

            <div className="tablewrap">
              <table className="urnik">
                <thead>
                  <tr>
                    <th style={{ minWidth: 110 }}>Smena</th>
                    {dni.map((d) => {
                      const y = Number(d.slice(0, 4));
                      const m0 = Number(d.slice(5, 7)) - 1;
                      const dd = Number(d.slice(8, 10));
                      const hol = praznikZa(d);
                      return (
                        <th key={d} className={hol ? 'hol' : isWeekend(y, m0, dd) ? 'wknd' : ''}>
                          {DNEVI_KRATKO[weekdayIndex(y, m0, dd)]}
                          <br />
                          <span className="muted">
                            {dd}.{m0 + 1}.
                          </span>
                          {hol && <div className="holname">{hol}</div>}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {vrstice.map((vrsta) => (
                    <tr key={vrsta.key}>
                      <td>
                        <b>{vrsta.label}</b>
                      </td>
                      {dni.map((d) => {
                        const dnevne = smeneZaDan(config, d);
                        const sh = dnevne.find((s) => s.key === vrsta.key);
                        if (!sh) {
                          return (
                            <td key={d} className="cell">
                              <span className="muted">–</span>
                            </td>
                          );
                        }
                        const val = days[d]?.[sh.key] || '';
                        const emp = employees.find((e) => e.id === val);
                        const idx = emp ? employees.indexOf(emp) : 0;
                        const nePocitek = emp && krsiPocitek(emp.id, d, sh.key, days, config);
                        const neMore = emp && isAdmin && !jeProsta(emp.id, d, sh, nemorem, null);
                        const konflikt = nePocitek || neMore;

                        if (!isAdmin) {
                          return (
                            <td key={d} className="cell">
                              {emp ? (
                                <span
                                  className={`pill ${emp.id === meId ? 'me' : ''}`}
                                  style={{ background: barvaEmp(emp, idx) }}
                                >
                                  {kratkoIme(emp.name)}
                                </span>
                              ) : (
                                <span className="muted">–</span>
                              )}
                              <div className="cas">{opisSmene(sh)}</div>
                            </td>
                          );
                        }

                        const prosti = employees.filter(
                          (e) =>
                            jeProsta(e.id, d, sh, nemorem, null) &&
                            !krsiPocitek(e.id, d, sh.key, days, config)
                        );
                        const zadrzani = employees.filter((e) => !prosti.includes(e));
                        return (
                          <td key={d} className={`cell ${konflikt ? 'konflikt' : ''}`}>
                            <select
                              value={val}
                              disabled={busy}
                              title={
                                nePocitek
                                  ? 'Sinoči je zapirala - zjutraj naj ne odpira.'
                                  : neMore
                                  ? 'Ta dan je označila, da ne more.'
                                  : ''
                              }
                              style={{
                                borderLeft: `4px solid ${emp ? barvaEmp(emp, idx) : 'transparent'}`,
                              }}
                              onChange={(ev) => nastaviSmeno(d, sh.key, ev.target.value)}
                            >
                              <option value="">–</option>
                              <optgroup label="Na voljo">
                                {prosti.map((e) => (
                                  <option key={e.id} value={e.id}>
                                    {e.name}
                                    {e.kind === 'studentka' ? ' (š)' : ''}
                                  </option>
                                ))}
                              </optgroup>
                              {zadrzani.length > 0 && (
                                <optgroup label="Ni priporočeno">
                                  {zadrzani.map((e) => (
                                    <option key={e.id} value={e.id}>
                                      {e.name} ⚠
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                            </select>
                            <div className="cas">{opisSmene(sh)}</div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {skupaj.length > 0 && (
            <>
              <h3 style={{ marginTop: 20 }}>
                {isAdmin ? 'Ure v tem tednu' : 'Moje ure ta teden'}
              </h3>
              <div
                className="sum"
                style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}
              >
                {skupaj.map((e) => {
                  const pod = e.kind !== 'studentka' && e.norma > 0 && e.ur < e.norma;
                  const cez = e.norma > 0 && e.ur > e.norma;
                  return (
                    <div key={e.id} style={{ borderLeft: `4px solid ${barvaEmp(e, e.i)}` }}>
                      <b
                        style={{ color: pod ? 'var(--bolniska)' : cez ? 'var(--dopust)' : undefined }}
                      >
                        {st(e.ur)}h{e.norma > 0 ? ` / ${st(e.norma)}h` : ''}
                      </b>
                      <span>
                        {e.name}
                        {e.kind === 'studentka' ? ' · študentka' : ''}
                        {e.smen ? ` · ${e.smen} smen` : ''}
                        {pod ? ` · manjka ${st(e.norma - e.ur)}h` : ''}
                        {cez ? ` · presega za ${st(e.ur - e.norma)}h` : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {meId && mojeSmene.length > 0 && (
            <>
              <h3 style={{ marginTop: 20 }}>Moje smene ta teden</h3>
              <div className="emplist">
                {mojeSmene.map(({ date, sh }) => {
                  const y = Number(date.slice(0, 4));
                  const m0 = Number(date.slice(5, 7)) - 1;
                  const dd = Number(date.slice(8, 10));
                  return (
                    <div className="emprow" key={date + sh.key}>
                      <div>
                        <b>
                          {DNEVI_DOLGO[weekdayIndex(y, m0, dd)]}, {dd}. {MESECI[m0].toLowerCase()}
                        </b>
                        <div className="muted">
                          {sh.label} · {opisSmene(sh)} · {st(urSmene(sh))}h
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
