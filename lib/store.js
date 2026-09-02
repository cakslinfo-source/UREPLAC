import { getJSON, setJSON, del, keys } from './redis';
import { PRIVZETE_SMENE } from './urnik';

export const K_CONFIG = 'lokal:config';
export const K_EMPLOYEES = 'lokal:employees';
export const monthKey = (empId, month) => `lokal:entries:${empId}:${month}`;
export const nemoremKey = (empId, month) => `lokal:nemorem:${empId}:${month}`;
export const urnikKey = (month) => `lokal:urnik:${month}`;

const DEFAULT_CONFIG = {
  lokalName: 'Evidenca delovnih ur',
  adminPassword: process.env.ADMIN_PASSWORD || '1991',
  dailyNorm: 8,
  weeklyNorm: 40,
  shifts: PRIVZETE_SMENE,
};

export async function getConfig() {
  const cfg = await getJSON(K_CONFIG, null);
  if (!cfg) return { ...DEFAULT_CONFIG };
  const merged = { ...DEFAULT_CONFIG, ...cfg };
  if (!Array.isArray(merged.shifts) || merged.shifts.length === 0)
    merged.shifts = PRIVZETE_SMENE;
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
    color: e.color || null,
    weeklyNorm: Number.isFinite(Number(e.weeklyNorm)) ? Number(e.weeklyNorm) : null,
  };
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

export async function authFromRequest(req) {
  const cfg = await getConfig();
  const adminPass = req.headers.get('x-admin-pass');
  if (adminPass && adminPass === cfg.adminPassword) {
    return { ok: true, isAdmin: true, employee: null, cfg };
  }
  const empId = req.headers.get('x-emp-id');
  const empPass = req.headers.get('x-emp-pass');
  if (empId && empPass) {
    const list = await getEmployees();
    const emp = list.find((e) => e.id === empId);
    if (emp && emp.password === empPass && emp.active !== false) {
      return { ok: true, isAdmin: false, employee: emp, cfg };
    }
  }
  return { ok: false, isAdmin: false, employee: null, cfg };
}

export function unauthorized() {
  return Response.json({ error: 'Napačno geslo ali potekla prijava.' }, { status: 401 });
}
