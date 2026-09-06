import { getJSON, setJSON, del, keys, rpush, lrange, ltrim } from './redis';
import { PRIVZETE_SMENE, PRIVZETE_SMENE_PO_DNEVIH, SMENA_POMOC } from './urnik';

export const K_CONFIG = 'lokal:config';
export const K_EMPLOYEES = 'lokal:employees';
export const monthKey = (empId, month) => `lokal:entries:${empId}:${month}`;
export const nemoremKey = (empId, month) => `lokal:nemorem:${empId}:${month}`;
export const urnikKey = (month) => `lokal:urnik:${month}`;
export const K_KLEPET = 'lokal:klepet';
export const K_KLEPET_ARHIV = 'lokal:klepet:arhiv';
const KLEPET_MAX = 500;

const DEFAULT_CONFIG = {
  lokalName: 'Evidenca delovnih ur',
  adminPassword: process.env.ADMIN_PASSWORD || '1991',
  dailyNorm: 8,
  weeklyNorm: 40,
  superAdminName: 'Luka Čakš',
  shifts: PRIVZETE_SMENE,
  shiftsByDay: PRIVZETE_SMENE_PO_DNEVIH,
};

/**
 * Enkratne posodobitve za nastavitve, ki so bile shranjene s starejšo
 * različico aplikacije. Vsaka se izvede samo enkrat (zastavica v migracije),
 * da se ne vrne, če jo administrator kasneje odstrani.
 */
function migriraj(cfg) {
  const m = { ...(cfg.migracije || {}) };
  let spremenjeno = false;

  // Sobota in nedelja dobita dopoldansko smeno "Pomoč".
  if (!m.pomocVikend) {
    for (const i of [5, 6]) {
      const dan = cfg.shiftsByDay[i];
      if (Array.isArray(dan) && !dan.some((s) => s.key === SMENA_POMOC.key)) {
        const privzeta = PRIVZETE_SMENE_PO_DNEVIH[i].find((s) => s.key === SMENA_POMOC.key);
        dan.push({ ...(privzeta || SMENA_POMOC) });
        spremenjeno = true;
      }
    }
    m.pomocVikend = true;
    spremenjeno = true;
  }

  cfg.migracije = m;
  return spremenjeno;
}

export async function getConfig() {
  const cfg = await getJSON(K_CONFIG, null);
  if (!cfg) return { ...DEFAULT_CONFIG, migracije: { pomocVikend: true } };
  const merged = { ...DEFAULT_CONFIG, ...cfg };
  if (!Array.isArray(merged.shifts) || merged.shifts.length === 0)
    merged.shifts = PRIVZETE_SMENE;
  if (!Array.isArray(merged.shiftsByDay) || merged.shiftsByDay.length !== 7)
    merged.shiftsByDay = PRIVZETE_SMENE_PO_DNEVIH.map((d) => d.map((s) => ({ ...s })));
  else merged.shiftsByDay = merged.shiftsByDay.map((d) => d.map((s) => ({ ...s })));

  if (migriraj(merged)) {
    try {
      await saveConfig(merged);
    } catch {
      /* če zapis ne uspe, aplikacija vseeno dela s posodobljenimi nastavitvami */
    }
  }
  return merged;
}

export async function saveConfig(cfg) {
  return setJSON(K_CONFIG, cfg);
}

export async function getEmployees() {
  const list = await getJSON(K_EMPLOYEES, []);
  return Array.isArray(list) ? list : [];
}

export async function saveEmployees(list) {
  return setJSON(K_EMPLOYEES, list);
}

// Javni podatki o zaposleni - brez gesla.
export function publicEmployee(e) {
  if (!e) return null;
  return {
    id: e.id,
    name: e.name,
    active: e.active !== false,
    kind: e.kind === 'studentka' ? 'studentka' : 'zaposlena',
    admin: e.admin === true,
    color: e.color || null,
    weeklyNorm: Number.isFinite(Number(e.weeklyNorm)) ? Number(e.weeklyNorm) : null,
  };
}

// --- klepet -----------------------------------------------------------

export async function dodajSporocilo(msg) {
  await rpush(K_KLEPET, msg);
  try {
    await ltrim(K_KLEPET, KLEPET_MAX);
  } catch {
    /* ni kritično */
  }
  return msg;
}

export async function beriKlepet() {
  const raw = await lrange(K_KLEPET, 0, -1);
  const arhiv = await getJSON(K_KLEPET_ARHIV, { ids: [] });
  const arhivirani = new Set(Array.isArray(arhiv.ids) ? arhiv.ids : []);
  const msgs = [];
  for (const r of raw) {
    let m = r;
    if (typeof m === 'string') {
      try {
        m = JSON.parse(m);
      } catch {
        continue;
      }
    }
    if (!m || !m.id) continue;
    m.arhiv = arhivirani.has(m.id);
    msgs.push(m);
  }
  return msgs;
}

export async function arhivirajSporocila(ids, vArhiv = true) {
  const arhiv = await getJSON(K_KLEPET_ARHIV, { ids: [] });
  const set = new Set(Array.isArray(arhiv.ids) ? arhiv.ids : []);
  for (const id of ids) {
    if (vArhiv) set.add(id);
    else set.delete(id);
  }
  await setJSON(K_KLEPET_ARHIV, { ids: Array.from(set).slice(-KLEPET_MAX) });
}

export async function getMonth(empId, month) {
  const doc = await getJSON(monthKey(empId, month), null);
  if (!doc || typeof doc !== 'object') return { days: {}, locked: false };
  return { days: doc.days || {}, locked: Boolean(doc.locked) };
}

export async function saveMonth(empId, month, doc) {
  return setJSON(monthKey(empId, month), doc);
}

// --- razpoložljivost ("kdaj ne morem") --------------------------------

export async function getNemorem(empId, month) {
  const doc = await getJSON(nemoremKey(empId, month), null);
  if (!doc || typeof doc !== 'object') return { dates: {} };
  return { dates: doc.dates || {} };
}

export async function saveNemorem(empId, month, doc) {
  return setJSON(nemoremKey(empId, month), doc);
}

// --- urnik ------------------------------------------------------------

export async function getUrnik(month) {
  const doc = await getJSON(urnikKey(month), null);
  if (!doc || typeof doc !== 'object') return { days: {}, objavljen: {} };
  return { days: doc.days || {}, objavljen: doc.objavljen || {} };
}

export async function saveUrnik(month, doc) {
  return setJSON(urnikKey(month), doc);
}

export async function deleteEmployeeData(empId) {
  for (const pat of [`lokal:entries:${empId}:*`, `lokal:nemorem:${empId}:*`]) {
    const found = await keys(pat);
    for (const k of found) await del(k);
  }
}

// ---- avtentikacija ----------------------------------------------------

/**
 * Vloge:
 *  - super administrator (Luka): geslo iz nastavitev, vidi in ureja vse
 *  - administrator: zaposlena z zastavico admin - ureja urnike in evidenco,
 *    NE more pa dodajati zaposlenih, deliti admin pravic ali v nastavitve
 *  - zaposlena / študentka: svoje ure in svoja razpoložljivost
 */
export async function authFromRequest(req) {
  const cfg = await getConfig();
  const adminPass = req.headers.get('x-admin-pass');
  if (adminPass && adminPass === cfg.adminPassword) {
    return { ok: true, isSuper: true, isAdmin: true, employee: null, cfg };
  }
  const empId = req.headers.get('x-emp-id');
  const empPass = req.headers.get('x-emp-pass');
  if (empId && empPass) {
    const list = await getEmployees();
    const emp = list.find((e) => e.id === empId);
    if (emp && emp.password === empPass && emp.active !== false) {
      return {
        ok: true,
        isSuper: false,
        isAdmin: emp.admin === true,
        employee: emp,
        cfg,
      };
    }
  }
  return { ok: false, isSuper: false, isAdmin: false, employee: null, cfg };
}

export function unauthorized(sporocilo) {
  return Response.json(
    { error: sporocilo || 'Napačno geslo ali potekla prijava.' },
    { status: 401 }
  );
}

export function zaSuperAdmina() {
  return Response.json(
    { error: 'To lahko spremeni samo super administrator.' },
    { status: 403 }
  );
}
