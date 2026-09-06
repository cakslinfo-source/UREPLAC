import {
  beriKlepet,
  dodajSporocilo,
  arhivirajSporocila,
  authFromRequest,
  unauthorized,
} from '@/lib/store';

export const dynamic = 'force-dynamic';

function novId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** Klepet berejo vsi prijavljeni. Arhivirana sporočila vidi le administrator. */
export async function GET(req) {
  const auth = await authFromRequest(req);
  if (!auth.ok) return unauthorized();
  try {
    const vseSkupaj = new URL(req.url).searchParams.get('arhiv') === '1';
    if (vseSkupaj && !auth.isAdmin) return unauthorized();
    const vsa = await beriKlepet();
    const sporocila = vseSkupaj ? vsa : vsa.filter((m) => !m.arhiv);
    return Response.json({
      sporocila,
      arhiviranih: vsa.filter((m) => m.arhiv).length,
      isAdmin: auth.isAdmin,
      isSuper: auth.isSuper,
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

/** Pisati smejo vsi prijavljeni. */
export async function POST(req) {
  const auth = await authFromRequest(req);
  if (!auth.ok) return unauthorized();
  try {
    const { text } = await req.json();
    const besedilo = String(text || '').trim();
    if (!besedilo) return Response.json({ error: 'Sporočilo je prazno.' }, { status: 400 });
    if (besedilo.length > 1000)
      return Response.json({ error: 'Sporočilo je predolgo (največ 1000 znakov).' }, { status: 400 });

    const msg = {
      id: novId(),
      empId: auth.employee?.id || 'super',
      name: auth.employee?.name || auth.cfg.superAdminName || 'Administrator',
      vloga: auth.isSuper ? 'super' : auth.isAdmin ? 'admin' : auth.employee?.kind || 'zaposlena',
      text: besedilo,
      at: new Date().toISOString(),
    };
    await dodajSporocilo(msg);
    return Response.json({ ok: true, sporocilo: msg });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

/** Arhiviranje - samo administrator (in super administrator). */
export async function PATCH(req) {
  const auth = await authFromRequest(req);
  if (!auth.ok || !auth.isAdmin)
    return unauthorized('Sporočila lahko arhivira samo administrator.');
  try {
    const { ids, arhiv } = await req.json();
    const seznam = Array.isArray(ids) ? ids.filter((i) => typeof i === 'string') : [];
    if (seznam.length === 0)
      return Response.json({ error: 'Ni izbranih sporočil.' }, { status: 400 });
    await arhivirajSporocila(seznam, arhiv !== false);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
