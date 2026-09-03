// Smene, razpoložljivost in tedenski urnik.
import { dateId, pad, weekdayIndex, mesecniFond } from './datum';

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

/** Ure, ki jih ima oseba v urniku razporejene v celem mesecu. */
export function ureVMesecu(urnikDays, month, empId, config) {
  let ur = 0;
  for (const [date, dan] of Object.entries(urnikDays || {})) {
    if (!date.startsWith(month)) continue;
    for (const sh of smeneZaDan(config, date)) {
      if (dan[sh.key] === empId) ur += urSmene(sh);
    }
  }
  return Math.round(ur * 100) / 100;
}

/** Koliko ur v mesecu je osebi še ostalo do polnega mesečnega fonda. */
export function preostanekMeseca(urnikDays, month, empId, config, dailyNorm = 8) {
  const [y, m] = month.split('-').map(Number);
  const fond = mesecniFond(y, m - 1, dailyNorm);
  const ze = ureVMesecu(urnikDays, month, empId, config);
  return { fond, ze, ostane: Math.round((fond - ze) * 100) / 100 };
}

/**
 * Število tednov od danega ponedeljka do konca meseca, ki še vsebujejo
 * kakšen dan tega meseca (vključno s tekočim tednom). Najmanj 1.
 */
export function tedniDoKoncaMeseca(month, mondayStr) {
  let m = mondayStr;
  let n = 0;
  for (let i = 0; i < 8; i++) {
    if (dneviTedna(m).some((d) => d.startsWith(month))) n += 1;
    else if (n > 0) break;
    m = premakniTeden(m, 1);
  }
  return Math.max(1, n);
}

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
  dailyNorm = 8,
  obstojeci,
}) {
  // Vključi tudi prejšnji dan, da pravilo "kdor zapira, ne odpira" deluje
  // čez mejo tedna.
  const days = { ...(obstojeci || {}) };
  for (const d of dni) days[d] = { ...(obstojeci?.[d] || {}) };

  const monday = dni[0];
  const meseciTedna = Array.from(new Set(dni.map((d) => d.slice(0, 7))));

  // Ure, ki so v mesecu razporejene ZUNAJ tega tedna - te so že "porabljene"
  // iz mesečnega fonda.
  const izvenTedna = {};
  for (const [date, dan] of Object.entries(obstojeci || {})) {
    if (dni.includes(date)) continue;
    izvenTedna[date] = dan;
  }

  /**
   * Tedenski cilj zaposlene za vsak mesec, ki ga teden zajema:
   * preostanek mesečnega fonda, razdeljen na preostale tedne meseca.
   * Študentka ima svojo tedensko kvoto (velja za cel teden, ne po mesecih).
   */
  const cilj = {};
  for (const e of employees) {
    cilj[e.id] = {};
    if (e.kind === 'studentka') continue;
    for (const m of meseciTedna) {
      const [y, mm] = m.split('-').map(Number);
      const fond = Number(e.weeklyNorm)
        ? Number(e.weeklyNorm) * tedniDoKoncaMeseca(m, monday)
        : mesecniFond(y, mm - 1, dailyNorm);
      const ze = ureVMesecu(izvenTedna, m, e.id, config);
      const tedni = tedniDoKoncaMeseca(m, monday);
      // Cilj ne more preseči tega, kar je v tem tednu sploh mogoče odslužiti
      // v tem mesecu (pomembno, ko teden sega čez mejo meseca).
      const dniTegaMeseca = dni.filter((d) => d.startsWith(m)).length;
      const zgornjaMeja = dniTegaMeseca * (Number(dailyNorm) || 8);
      cilj[e.id][m] = Math.max(
        0,
        Math.round(Math.min((fond - ze) / tedni, zgornjaMeja) * 100) / 100
      );
    }
  }

  // Stanje v tem tednu: ure skupaj, ure po mesecih, zasedeni dnevi.
  const stanje = {};
  for (const e of employees) {
    stanje[e.id] = { ur: 0, poMesecih: {}, dnevi: new Set() };
  }
  for (const d of dni) {
    for (const sh of smeneZaDan(config, d)) {
      const id = days[d][sh.key];
      if (id && stanje[id]) {
        const m = d.slice(0, 7);
        stanje[id].ur += urSmene(sh);
        stanje[id].poMesecih[m] = (stanje[id].poMesecih[m] || 0) + urSmene(sh);
        stanje[id].dnevi.add(d);
      }
    }
  }

  for (const d of dni) {
    const mesecDneva = d.slice(0, 7);
    for (const sh of smeneZaDan(config, d)) {
      if (days[d][sh.key]) continue; // že zaseden

      const kandidati = employees
        .filter((e) => e.active !== false)
        .filter((e) => !stanje[e.id].dnevi.has(d))
        .filter((e) => jeProsta(e.id, d, sh, nemorem, evidenca, config))
        // kdor je sinoči zapiral, zjutraj ne odpira
        .filter((e) => !krsiPocitek(e.id, d, sh.key, days, config))
        .map((e) => {
          const zaposlena = e.kind !== 'studentka';
          let norma;
          let doslej;
          if (zaposlena) {
            // cilj za mesec, v katerega pade ta dan
            norma = cilj[e.id][mesecDneva];
            doslej = stanje[e.id].poMesecih[mesecDneva] || 0;
          } else {
            norma =
              e.weeklyNorm == null || e.weeklyNorm === '' ? null : Number(e.weeklyNorm);
            doslej = stanje[e.id].ur;
          }
          const brezKvote = norma == null;
          const manjka = brezKvote ? 0 : Math.round((norma - doslej) * 100) / 100;
          // šest zaporednih delovnih dni je zgornja meja - sedmi dan naj bo prost
          const preveDni = stanje[e.id].dnevi.size >= 6;
          // Prednost ima, dokler ji do cilja manjka vsaj pol smene;
          // zadnjih par ur ne pobira na račun drugih.
          const potrebuje = !brezKvote && manjka >= urSmene(sh) / 2;
          return { e, manjka, zaposlena, potrebuje, brezKvote, ur: stanje[e.id].ur, preveDni };
        })
        .sort((a, b) => {
          if (a.preveDni !== b.preveDni) return a.preveDni ? 1 : -1;
          // 0 = še potrebuje ure do svoje kvote, 1 = študentka brez vpisane
          // kvote, 2 = kvoto je že dosegla
          const prio = (x) => (x.potrebuje ? 0 : x.brezKvote ? 1 : 2);
          const ap = prio(a);
          const bp = prio(b);
          if (ap !== bp) return ap - bp;
          // Znotraj istega razreda gre smena tisti, ki ji manjka največ ur.
          // Ker ima zaposlena bistveno večjo kvoto od študentke, se najprej
          // zapolni njen delovnik, študentke pa se vmes razporedijo sproti.
          if (b.manjka !== a.manjka) return b.manjka - a.manjka;
          if (a.zaposlena !== b.zaposlena) return a.zaposlena ? -1 : 1;
          return a.ur - b.ur;
        });

      const dodeli = (id) => {
        days[d][sh.key] = id;
        stanje[id].ur += urSmene(sh);
        stanje[id].poMesecih[mesecDneva] =
          (stanje[id].poMesecih[mesecDneva] || 0) + urSmene(sh);
        stanje[id].dnevi.add(d);
      };

      const izbrana = kandidati[0];
      if (!izbrana) continue;
      // kdor je že krepko čez svoj cilj, raje ne
      if (izbrana.manjka <= -urSmene(sh) && kandidati[1]) {
        dodeli(kandidati[1].e.id);
        continue;
      }
      dodeli(izbrana.e.id);
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
