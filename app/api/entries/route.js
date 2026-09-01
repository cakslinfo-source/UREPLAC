import {
  getMonth,
  saveMonth,
  getEmployees,
  publicEmployee,
  authFromRequest,
  unauthorized,
} from '@/lib/store';

export const dynamic = 'force-dynamic';

const TIPI = ['delo', 'dopust', 'bolniska', 'prosto'];

function cleanEntry(raw, dailyNorm) {
  if (!raw || !raw.t) return null;
  if (!TIPI.includes(raw.t)) return null;
  const entry = { t: raw.t };
  if (raw.t === 'delo') {
    const h = Number(raw.h);
    if (!Number.isFinite(h) || h <= 0) return null;
    entry.h = Math.round(Math.min(24, h) * 100) / 100;
  } else if (raw.t === 'dopust' || raw.t === 'bolniska') {
    const h = Number(raw.h);
    entry.h = Number.isFinite(h) && h > 0 ? Math.min(24, h) : Number(dailyNorm) || 8;
  } else {
    entry.h = 0;
  }
  if (raw.n && String(raw.n).trim()) entry.n = String(raw.n).trim().slice(0, 300);
  entry.u = new Date().toISOString();
  return entry;
}

export async function GET(req) {
  const auth = await authFromRequest(req);
  if (!auth.ok) return unauthorized();
  try {
    const url = new URL(req.url);
    const month = url.searchParams.get('month');
    const all = url.searchParams.get('all') === '1';
    if (!month || !/^\d{4}-\d{2}$/.test(month))
      return Response.json({ error: 'Manjka ali napačen mesec.' }, { status: 400 });

    if (all) {
      if (!auth.isAdmin) return unauthorized();
      const employees = await getEmployees();
      const months = {};
      for (const e of employees) {
        months[e.id] = await getMonth(e.id, month);
      }
      return Response.json({
        month,
        employees: employees.map(publicEmployee),
        months,
      });
    }

    const empId = url.searchParams.get('empId') || auth.employee?.id;
    if (!empId) return Response.json({ error: 'Manjka zaposlena.' }, { status: 400 });
    if (!auth.isAdmin && auth.employee.id !== empId) return unauthorized();

    const doc = await getMonth(empId, month);
    return Response.json({ month, empId, ...doc });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  const auth = await authFromRequest(req);
  if (!auth.ok) return unauthorized();
  try {
    const body = await req.json();
    const month = body.month;
    if (!month || !/^\d{4}-\d{2}$/.test(month))
      return Response.json({ error: 'Napačen mesec.' }, { status: 400 });

    const empId = body.empId || auth.employee?.id;
    if (!empId) return Response.json({ error: 'Manjka zaposlena.' }, { status: 400 });
    if (!auth.isAdmin && auth.employee.id !== empId) return unauthorized();

    const doc = await getMonth(empId, month);

    // Zaklep meseca - samo administrator.
    if (typeof body.locked === 'boolean') {
      if (!auth.isAdmin) return unauthorized();
      doc.locked = body.locked;
      await saveMonth(empId, month, doc);
      return Response.json({ ok: true, ...doc });
    }

    if (doc.locked && !auth.isAdmin) {
      return Response.json(
        { error: 'Mesec je zaključen. Za spremembo se obrni na vodjo.' },
        { status: 423 }
      );
    }

    const dailyNorm = auth.cfg.dailyNorm;
    const changes = Array.isArray(body.days)
      ? body.days
      : [{ date: body.date, entry: body.entry }];

    for (const ch of changes) {
      if (!ch || !/^\d{4}-\d{2}-\d{2}$/.test(ch.date || '')) continue;
      if (!ch.date.startsWith(month)) continue;
      const clean = cleanEntry(ch.entry, dailyNorm);
      if (clean) doc.days[ch.date] = clean;
      else delete doc.days[ch.date];
    }

    await saveMonth(empId, month, doc);
    return Response.json({ ok: true, month, empId, ...doc });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
