import {
  getNemorem,
  saveNemorem,
  getMonth,
  getEmployees,
  publicEmployee,
  authFromRequest,
  unauthorized,
} from '@/lib/store';

export const dynamic = 'force-dynamic';

const VELJAVNE = ['ves', 'dop', 'pop'];

/**
 * Skupni koledar razpoložljivosti - vidijo ga vse zaposlene in administrator.
 * Namenoma NE pove razloga: dopust in bolniška iz evidence se prikažeta samo
 * kot "cel dan ne more", brez vrste odsotnosti.
 */
export async function GET(req) {
  const auth = await authFromRequest(req);
  if (!auth.ok) return unauthorized();
  try {
    const month = new URL(req.url).searchParams.get('month');
    if (!month || !/^\d{4}-\d{2}$/.test(month))
      return Response.json({ error: 'Manjka ali napačen mesec.' }, { status: 400 });

    const employees = (await getEmployees()).filter((e) => e.active !== false);
    const nemorem = {};

    for (const e of employees) {
      const own = await getNemorem(e.id, month);
      const map = { ...own.dates };
      const evid = await getMonth(e.id, month);
      for (const [date, en] of Object.entries(evid.days || {})) {
        if (en?.t === 'dopust' || en?.t === 'bolniska') map[date] = 'ves';
      }
      nemorem[e.id] = map;
    }

    return Response.json({
      month,
      employees: employees.map(publicEmployee),
      nemorem,
      shifts: auth.cfg.shifts,
      weeklyNorm: auth.cfg.weeklyNorm,
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

/** Vsaka ureja SVOJO razpoložljivost; administrator lahko ureja komurkoli. */
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

    const doc = await getNemorem(empId, month);
    const patch = body.dates || {};
    for (const [date, val] of Object.entries(patch)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !date.startsWith(month)) continue;
      if (val && VELJAVNE.includes(val)) doc.dates[date] = val;
      else delete doc.dates[date];
    }
    await saveNemorem(empId, month, doc);
    return Response.json({ ok: true, month, empId, dates: doc.dates });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
