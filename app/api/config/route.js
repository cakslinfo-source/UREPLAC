import {
  getConfig,
  saveConfig,
  getEmployees,
  publicEmployee,
  authFromRequest,
  unauthorized,
} from '@/lib/store';
import { redisConfigured } from '@/lib/redis';

export const dynamic = 'force-dynamic';

// Javni podatki za prijavni zaslon: ime lokala + seznam imen (brez gesel).
export async function GET() {
  if (!redisConfigured()) {
    return Response.json(
      { error: 'Baza ni nastavljena. Dodaj KV_REST_API_URL in KV_REST_API_TOKEN.' },
      { status: 500 }
    );
  }
  try {
    const cfg = await getConfig();
    const employees = (await getEmployees())
      .filter((e) => e.active !== false)
      .map(publicEmployee);
    return Response.json({
      lokalName: cfg.lokalName,
      dailyNorm: cfg.dailyNorm,
      weeklyNorm: cfg.weeklyNorm,
      shifts: cfg.shifts,
      shiftsByDay: cfg.shiftsByDay,
      employees,
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// Sprememba nastavitev - samo administrator.
export async function PUT(req) {
  const auth = await authFromRequest(req);
  if (!auth.ok || !auth.isAdmin) return unauthorized();
  try {
    const body = await req.json();
    const cfg = await getConfig();
    const next = { ...cfg };
    if (typeof body.lokalName === 'string' && body.lokalName.trim())
      next.lokalName = body.lokalName.trim();
    if (Number.isFinite(Number(body.dailyNorm)))
      next.dailyNorm = Math.max(1, Math.min(24, Number(body.dailyNorm)));
    if (Number.isFinite(Number(body.weeklyNorm)))
      next.weeklyNorm = Math.max(1, Math.min(60, Number(body.weeklyNorm)));
    const ocisti = (arr) =>
      arr
        .filter((s) => s && s.key && /^\d{1,2}:\d{2}$/.test(s.start) && /^\d{1,2}:\d{2}$/.test(s.end))
        .map((s) => ({
          key: String(s.key).slice(0, 4),
          label: String(s.label || '').slice(0, 30) || 'Smena',
          kratko: String(s.kratko || s.label || '').slice(0, 5).toUpperCase(),
          start: s.start.padStart(5, '0'),
          end: s.end.padStart(5, '0'),
          del: s.del === 'pop' ? 'pop' : 'dop',
        }));

    if (Array.isArray(body.shifts) && body.shifts.length) next.shifts = ocisti(body.shifts);
    if (Array.isArray(body.shiftsByDay) && body.shiftsByDay.length === 7) {
      const po = body.shiftsByDay.map((dan) => (Array.isArray(dan) ? ocisti(dan) : []));
      if (po.every((dan) => dan.length)) next.shiftsByDay = po;
    }
    if (typeof body.adminPassword === 'string' && body.adminPassword.length >= 4)
      next.adminPassword = body.adminPassword;
    await saveConfig(next);
    return Response.json({ ok: true, config: { ...next, adminPassword: undefined } });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
