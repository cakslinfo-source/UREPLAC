// Smene, razpoložljivost in tedenski urnik.
import { dateId, pad, weekdayIndex } from './datum';

// Privzete smene v lokalu: dve dopoldan, dve popoldan.
// "Odpiranje" pride prva, "Zapiranje" pride zadnja in zapre.
export const PRIVZETE_SMENE = [
  { key: 'o', label: 'Odpiranje', kratko: 'ODP', start: '06:00', end: '13:00', del: 'dop' },
  { key: 'd', label: 'Dopoldan', kratko: 'DOP', start: '07:00', end: '14:00', del: 'dop' },
  { key: 'p', label: 'Popoldan', kratko: 'POP', start: '14:00', end: '21:00', del: 'pop' },
  { key: 'z', label: 'Zapiranje', kratko: 'ZAP', start: '15:00', end: '22:00', del: 'pop' },
];

const spremeni = (osnova, patch) =>
  osnova.map((s) => (patch[s.key] ? { ...s, ...patch[s.key] } : { ...s }));

// Petek in sobota: odprto do 23h. Nedelja: odpiranje ob 7h.
const PETEK_SOBOTA = spremeni(PRIVZETE_SMENE, { z: { end: '23:00' } });
const NEDELJA = spremeni(PRIVZETE_SMENE, {
  o: { start: '07:00', end: '14:00' },
  d: { start: '08:00', end: '15:00' },
});

// Indeks 0 = ponedeljek ... 6 = nedelja
export const PRIVZETE_SMENE_PO_DNEVIH = [
  PRIVZETE_SMENE,
  PRIVZETE_SMENE,
  PRIVZETE_SMENE,
  PRIVZETE_SMENE,
  PETEK_SOBOTA,
  PETEK_SOBOTA,
  NEDELJA,
];

/** Smene za konkreten datum - upošteva odstopanja po dnevih v tednu. */
export function smeneZaDan(config, dateStr) {
  const y = Number(dateStr.slice(0, 4));
  const m0 = Number(dateStr.slice(5, 7)) - 1;
  const d = Number(dateStr.slice(8, 10));
  const wd = weekdayIndex(y, m0, d);
  const po = config?.shiftsByDay;
  if (Array.isArray(po) && Array.isArray(po[wd]) && po[wd].length) return po[wd];
  if (Array.isArray(config?.shifts) && config.shifts.length) return config.shifts;
  return PRIVZETE_SMENE_PO_DNEVIH[wd];
}

/** Ključ smene, ki ta dan odpira (najzgodnejši začetek). */
export function kljucOdpiranja(dnevneSmene) {
  let naj = null;
  for (const s of dnevneSmene) if (!naj || minute(s.start) < minute(naj.start)) naj = s;
  return naj?.key || null;
}

/** Ključ smene, ki ta dan zapira (najpoznejši konec). */
export function kljucZapiranja(dnevneSmene) {
  let naj = null;
  for (const s of dnevneSmene) if (!naj || minute(s.end) > minute(naj.end)) naj = s;
  return naj?.key || null;
}

export function prejsnjiDan(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  return dateId(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Kdor zvečer zapira, naslednje jutro ne odpira.
 * Vrne true, če bi ta razporeditev kršila pravilo.
 */
export function krsiPocitek(empId, date, shiftKey, urnikDays, config) {
  if (!empId) return false;
  const dnevne = smeneZaDan(config, date);
  if (kljucOdpiranja(dnevne) !== shiftKey) return false;
  const vceraj = prejsnjiDan(date);
  const vcerajsnje = smeneZaDan(config, vceraj);
  const zapira = kljucZapiranja(vcerajsnje);
  return Boolean(zapira && urnikDays?.[vceraj]?.[zapira] === empId);
}

export const BARVE = [
  '#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed',
  '#db2777', '#0891b2', '#65a30d', '#b45309', '#475569',
  '#0d9488', '#9333ea',
];

export function barvaZa(index) {
  return BARVE[index % BARVE.length];
}

export function smene(config) {
  const s = config?.shifts;
  if (Array.isArray(s) && s.length) return s;
  return PRIVZETE_SMENE;
}

export function minute(hhmm) {
  const [h, m] = String(hhmm || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function urSmene(sh) {
  let d = minute(sh.end) - minute(sh.start);
  if (d <= 0) d += 24 * 60; // smena čez polnoč
  return Math.round((d / 60) * 100) / 100;
}

export function opisSmene(sh) {
  return `${sh.start}–${sh.end}`;
}

// --- tedni -----------------------------------------------------------

// Ponedeljek tedna, v katerem je dani datum.
export function ponedeljek(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const dow = (d.getDay() + 6) % 7; // 0 = pon
  d.setDate(d.getDate() - dow);
  return dateId(d.getFullYear(), d.getMonth(), d.getDate());
}

export function dneviTedna(mondayStr) {
  const out = [];
  const d = new Date(mondayStr + 'T12:00:00');
  for (let i = 0; i < 7; i++) {
    out.push(dateId(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export function premakniTeden(mondayStr, delta) {
  const d = new Date(mondayStr + 'T12:00:00');
  d.setDate(d.getDate() + delta * 7);
  return dateId(d.getFullYear(), d.getMonth(), d.getDate());
}

export function oznakaTedna(mondayStr) {
  const dni = dneviTedna(mondayStr);
  const a = dni[0];
  const b = dni[6];
  const f = (s) => `${Number(s.slice(8, 10))}.${Number(s.slice(5, 7))}.`;
  return `${f(a)} – ${f(b)} ${b.slice(0, 4)}`;
}

// --- razpoložljivost --------------------------------------------------

// Vrednosti v "nemorem"
export const NEMOREM_VREDNOSTI = ['ves', 'dop', 'pop', 'neodpira', 'nezapira'];

export const NEMOREM_LABEL = {
  ves: 'Cel dan',
  dop: 'Dopoldne',
  pop: 'Popoldne',
  neodpira: 'Ne more odpirati',
  nezapira: 'Ne more zaključiti',
};

// Kratke oznake za koledarske celice
export const NEMOREM_KRATKO = {
  ves: 'Ne morem',
  dop: 'Dopoldne',
  pop: 'Popoldne',
  neodpira: 'Ne odpiram',
  nezapira: 'Ne zapiram',
};

/**
 * Ali je zaposlena na ta dan na voljo za to smeno?
 * nemorem: { date: 'ves'|'dop'|'pop'|'neodpira'|'nezapira' }
 * evidenca: { date: {t:...} }
 * config je neobvezen - potreben je le za 'neodpira' / 'nezapira',
 * ker se iz njega ugotovi, katera smena ta dan odpira oziroma zapira.
 */
export function jeProsta(empId, date, sh, nemorem, evidenca, config) {
  const n = nemorem?.[empId]?.[date];
  if (n === 'ves') return false;
  if (n === 'dop' && sh.del === 'dop') return false;
  if (n === 'pop' && sh.del === 'pop') return false;
  if ((n === 'neodpira' || n === 'nezapira') && config) {
    const dnevne = smeneZaDan(config, date);
    if (n === 'neodpira' && kljucOdpiranja(dnevne) === sh.key) return false;
    if (n === 'nezapira' && kljucZapiranja(dnevne) === sh.key) return false;
  }
  const e = evidenca?.[empId]?.[date];
  if (e && (e.t === 'dopust' || e.t === 'bolniska')) return false;
  return true;
}

export function razlogOdsotnosti(empId, date, nemorem, evidenca) {
  const e = evidenca?.[empId]?.[date];
  if (e?.t === 'dopust') return 'dopust';
  if (e?.t === 'bolniska') return 'bolniška';
  const n = nemorem?.[empId]?.[date];
  if (n) return NEMOREM_LABEL[n].toLowerCase();
  return null;
}

// --- izračun ur v urniku ----------------------------------------------

export function ureVTednu(urnikDays, dni, empId, config) {
  let ur = 0;
  let st = 0;
  for (const d of dni) {
    const dan = urnikDays?.[d];
    if (!dan) continue;
    for (const sh of smeneZaDan(config, d)) {
      if (dan[sh.key] === empId) {
        ur += urSmene(sh);
        st += 1;
      }
    }
  }
  return { ur: Math.round(ur * 100) / 100, smen: st };
}

// --- samodejni predlog urnika ----------------------------------------

/**
 * Pravilo: zaposlene morajo do polne tedenske norme (najprej one),
 * študentke zapolnijo tisto, kar ostane.
 * Nihče ni dvakrat na isti dan, največ 6 zaporednih delovnih dni.
 */
export function predlagajUrnik({
  dni,
  employees,
  config,
  nemorem,
  evidenca,
  weeklyNorm,
  obstojeci,
}) {
  // Vključi tudi prejšnji dan, da pravilo "kdor zapira, ne odpira" deluje
  // čez mejo tedna.
  const days = { ...(obstojeci || {}) };
  for (const d of dni) days[d] = { ...(obstojeci?.[d] || {}) };

  const stanje = {};
  for (const e of employees) {
    stanje[e.id] = { ur: 0, dnevi: new Set() };
  }
  // upoštevaj že ročno vpisane smene
  for (const d of dni) {
    for (const sh of smeneZaDan(config, d)) {
      const id = days[d][sh.key];
      if (id && stanje[id]) {
        stanje[id].ur += urSmene(sh);
        stanje[id].dnevi.add(d);
      }
    }
  }

  const normaZa = (e) =>
    e.kind === 'studentka' ? Number(e.weeklyNorm) || 0 : Number(e.weeklyNorm) || weeklyNorm;

  for (const d of dni) {
    for (const sh of smeneZaDan(config, d)) {
      if (days[d][sh.key]) continue; // že zaseden

      const kandidati = employees
        .filter((e) => e.active !== false)
        .filter((e) => !stanje[e.id].dnevi.has(d))
        .filter((e) => jeProsta(e.id, d, sh, nemorem, evidenca, config))
        // kdor je sinoči zapiral, zjutraj ne odpira
        .filter((e) => !krsiPocitek(e.id, d, sh.key, days, config))
        .map((e) => {
          const norma = normaZa(e);
          const manjka = norma - stanje[e.id].ur;
          const zaposlena = e.kind !== 'studentka';
          // šest zaporednih delovnih dni je zgornja meja - sedmi dan naj bo prost
          const preveDni = stanje[e.id].dnevi.size >= 6;
          return { e, manjka, zaposlena, ur: stanje[e.id].ur, preveDni };
        })
        // zaposlene, ki še niso dosegle norme, imajo absolutno prednost
        .sort((a, b) => {
          if (a.preveDni !== b.preveDni) return a.preveDni ? 1 : -1;
          const aPrio = a.zaposlena && a.manjka > 0 ? 0 : a.zaposlena ? 2 : 1;
          const bPrio = b.zaposlena && b.manjka > 0 ? 0 : b.zaposlena ? 2 : 1;
          if (aPrio !== bPrio) return aPrio - bPrio;
          if (b.manjka !== a.manjka) return b.manjka - a.manjka;
          return a.ur - b.ur;
        });

      const izbrana = kandidati[0];
      if (!izbrana) continue;
      // zaposlena, ki je že krepko čez normo, raje ne
      if (izbrana.zaposlena && izbrana.manjka <= -urSmene(sh) && kandidati[1]) {
        const druga = kandidati[1];
        days[d][sh.key] = druga.e.id;
        stanje[druga.e.id].ur += urSmene(sh);
        stanje[druga.e.id].dnevi.add(d);
        continue;
      }
      days[d][sh.key] = izbrana.e.id;
      stanje[izbrana.e.id].ur += urSmene(sh);
      stanje[izbrana.e.id].dnevi.add(d);
    }
  }

  return days;
}

// --- izvoz v koledar (.ics) -------------------------------------------

function icsDate(date, hhmm) {
  return `${date.replace(/-/g, '')}T${hhmm.replace(':', '')}00`;
}

/**
 * Plavajoč lokalni čas (brez časovnega pasu) - telefonski koledarji ga
 * pravilno prikažejo v lokalnem času.
 */
export function ustvariIcs({ vnosi, ime, lokalName }) {
  const now = new Date();
  const stamp =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Evidenca ur//Urnik//SL',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:Urnik – ${ime}`,
  ];

  for (const v of vnosi) {
    const endDate =
      minute(v.end) <= minute(v.start)
        ? (() => {
            const d = new Date(v.date + 'T12:00:00');
            d.setDate(d.getDate() + 1);
            return dateId(d.getFullYear(), d.getMonth(), d.getDate());
          })()
        : v.date;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${v.date}-${v.key}-${Math.random().toString(36).slice(2, 8)}@lokal`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsDate(v.date, v.start)}`,
      `DTEND:${icsDate(endDate, v.end)}`,
      `SUMMARY:${v.label} (${v.start}–${v.end})`,
      `DESCRIPTION:${lokalName || 'Delo'} – ${ime}`,
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function prenesi(filename, content, mime = 'text/calendar;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
