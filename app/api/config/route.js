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
    if (typeof body.adminPassword === 'string' && body.adminPassword.length >= 4)
      next.adminPassword = body.adminPassword;
    await saveConfig(next);
    return Response.json({ ok: true, config: { ...next, adminPassword: undefined } });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
