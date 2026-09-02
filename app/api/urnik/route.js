import {
  getUrnik,
  saveUrnik,
  getEmployees,
  publicEmployee,
  authFromRequest,
  unauthorized,
} from '@/lib/store';

export const dynamic = 'force-dynamic';

/** Urnik berejo vsi prijavljeni; ureja ga samo administrator. */
export async function GET(req) {
  const auth = await authFromRequest(req);
  if (!auth.ok) return unauthorized();
  try {
    const params = new URL(req.url).searchParams;
    const months = (params.get('months') || params.get('month') || '')
      .split(',')
      .map((m) => m.trim())
      .filter((m) => /^\d{4}-\d{2}$/.test(m));
    if (months.length === 0)
      return Response.json({ error: 'Manjka mesec.' }, { status: 400 });

    const out = {};
    for (const m of months) out[m] = await getUrnik(m);

    const employees = (await getEmployees()).filter((e) => e.active !== false);
    return Response.json({
      urniki: out,
      employees: employees.map(publicEmployee),
      shifts: auth.cfg.shifts,
      weeklyNorm: auth.cfg.weeklyNorm,
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  const auth = await authFromRequest(req);
  if (!auth.ok || !auth.isAdmin) return unauthorized();
  try {
    const body = await req.json();
    const month = body.month;
    if (!month || !/^\d{4}-\d{2}$/.test(month))
      return Response.json({ error: 'Napačen mesec.' }, { status: 400 });

    const doc = await getUrnik(month);
    const shiftKeys = (auth.cfg.shifts || []).map((s) => s.key);

    if (body.days && typeof body.days === 'object') {
      for (const [date, dan] of Object.entries(body.days)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !date.startsWith(month)) continue;
        const clean = {};
        for (const k of shiftKeys) {
          const v = dan?.[k];
          if (typeof v === 'string' && v) clean[k] = v;
        }
        if (Object.keys(clean).length) doc.days[date] = clean;
        else delete doc.days[date];
      }
    }

    if (body.objavljen && typeof body.objavljen === 'object') {
      for (const [teden, val] of Object.entries(body.objavljen)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(teden)) continue;
        if (val) doc.objavljen[teden] = true;
        else delete doc.objavljen[teden];
      }
    }

    await saveUrnik(month, doc);
    return Response.json({ ok: true, month, ...doc });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
