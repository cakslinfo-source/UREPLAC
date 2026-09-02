import {
  getEmployees,
  saveEmployees,
  authFromRequest,
  unauthorized,
  deleteEmployeeData,
} from '@/lib/store';
import { barvaZa } from '@/lib/urnik';

export const dynamic = 'force-dynamic';

function newId() {
  return 'z' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Admin vidi cel seznam, vkljucno z gesli (da jih lahko pove zaposlenim).
export async function GET(req) {
  const auth = await authFromRequest(req);
  if (!auth.ok || !auth.isAdmin) return unauthorized();
  try {
    return Response.json({ employees: await getEmployees() });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  const auth = await authFromRequest(req);
  if (!auth.ok || !auth.isAdmin) return unauthorized();
  try {
    const { name, password, kind, color, weeklyNorm } = await req.json();
    if (!name || !String(name).trim())
      return Response.json({ error: 'Manjka ime.' }, { status: 400 });
    if (!password || String(password).length < 4)
      return Response.json({ error: 'Geslo mora imeti vsaj 4 znake.' }, { status: 400 });

    const list = await getEmployees();
    if (list.some((e) => e.name.trim().toLowerCase() === String(name).trim().toLowerCase()))
      return Response.json({ error: 'Zaposlena s tem imenom že obstaja.' }, { status: 400 });

    const emp = {
      id: newId(),
      name: String(name).trim(),
      password: String(password),
      active: true,
      kind: kind === 'studentka' ? 'studentka' : 'zaposlena',
      color: color || barvaZa(list.length),
      weeklyNorm: Number.isFinite(Number(weeklyNorm)) ? Number(weeklyNorm) : null,
      createdAt: new Date().toISOString(),
    };
    list.push(emp);
    await saveEmployees(list);
    return Response.json({ ok: true, employee: emp });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req) {
  const auth = await authFromRequest(req);
  if (!auth.ok || !auth.isAdmin) return unauthorized();
  try {
    const { id, name, password, active, kind, color, weeklyNorm } = await req.json();
    const list = await getEmployees();
    const emp = list.find((e) => e.id === id);
    if (!emp) return Response.json({ error: 'Zaposlena ni najdena.' }, { status: 404 });
    if (typeof name === 'string' && name.trim()) emp.name = name.trim();
    if (typeof password === 'string' && password.length >= 4) emp.password = password;
    if (typeof active === 'boolean') emp.active = active;
    if (kind === 'studentka' || kind === 'zaposlena') emp.kind = kind;
    if (typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color)) emp.color = color;
    if (weeklyNorm === null || weeklyNorm === '') emp.weeklyNorm = null;
    else if (Number.isFinite(Number(weeklyNorm)))
      emp.weeklyNorm = Math.max(0, Math.min(60, Number(weeklyNorm)));
    await saveEmployees(list);
    return Response.json({ ok: true, employee: emp });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  const auth = await authFromRequest(req);
  if (!auth.ok || !auth.isAdmin) return unauthorized();
  try {
    const id = new URL(req.url).searchParams.get('id');
    const list = await getEmployees();
    const next = list.filter((e) => e.id !== id);
    await saveEmployees(next);
    await deleteEmployeeData(id);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
