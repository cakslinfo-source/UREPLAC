import { getConfig, getEmployees, publicEmployee } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { mode, empId, password } = await req.json();
    const cfg = await getConfig();

    if (mode === 'admin') {
      if (password && password === cfg.adminPassword) {
        return Response.json({
          ok: true,
          isAdmin: true,
          config: { lokalName: cfg.lokalName, dailyNorm: cfg.dailyNorm },
        });
      }
      return Response.json({ error: 'Napačno geslo administratorja.' }, { status: 401 });
    }

    const list = await getEmployees();
    const emp = list.find((e) => e.id === empId);
    if (!emp || emp.active === false) {
      return Response.json({ error: 'Zaposlena ni najdena.' }, { status: 401 });
    }
    if (emp.password !== password) {
      return Response.json({ error: 'Napačno geslo.' }, { status: 401 });
    }
    return Response.json({
      ok: true,
      isAdmin: false,
      employee: publicEmployee(emp),
      config: { lokalName: cfg.lokalName, dailyNorm: cfg.dailyNorm },
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
