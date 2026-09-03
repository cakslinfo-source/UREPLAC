// Datumski pripomočki + slovenski prazniki. Brez knjižnic, brez časovnih pasov:
// datume vedno vodimo kot niz "YYYY-MM-DD".

export const MESECI = [
  'Januar', 'Februar', 'Marec', 'April', 'Maj', 'Junij',
  'Julij', 'Avgust', 'September', 'Oktober', 'November', 'December',
];

export const DNEVI_KRATKO = ['Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob', 'Ned'];
export const DNEVI_DOLGO = [
  'ponedeljek', 'torek', 'sreda', 'četrtek', 'petek', 'sobota', 'nedelja',
];

export const pad = (n) => String(n).padStart(2, '0');

export function monthId(year, month0) {
  return `${year}-${pad(month0 + 1)}`;
}

export function parseMonthId(id) {
  const [y, m] = id.split('-').map(Number);
  return { year: y, month0: m - 1 };
}

export function daysInMonth(year, month0) {
  return new Date(year, month0 + 1, 0).getDate();
}

export function dateId(year, month0, day) {
  return `${year}-${pad(month0 + 1)}-${pad(day)}`;
}

export function todayId() {
  const d = new Date();
  return dateId(d.getFullYear(), d.getMonth(), d.getDate());
}

export function currentMonthId() {
  const d = new Date();
  return monthId(d.getFullYear(), d.getMonth());
}

// 0 = ponedeljek ... 6 = nedelja
export function weekdayIndex(year, month0, day) {
  const js = new Date(year, month0, day).getDay(); // 0 = nedelja
  return (js + 6) % 7;
}

export function isWeekend(year, month0, day) {
  return weekdayIndex(year, month0, day) >= 5;
}

export function shiftMonth(id, delta) {
  const { year, month0 } = parseMonthId(id);
  const d = new Date(year, month0 + delta, 1);
  return monthId(d.getFullYear(), d.getMonth());
}

export function monthLabel(id) {
  const { year, month0 } = parseMonthId(id);
  return `${MESECI[month0]} ${year}`;
}

// --- prazniki ---------------------------------------------------------

// Anonymous Gregorian (Meeus/Jones/Butcher) algoritem za veliko noc.
function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month0 = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month0, day);
}

const cache = {};

// Vrne { "YYYY-MM-DD": "Ime praznika" } za dano leto.
// dela_prosti: samo dela prosti dnevi (tako kot jih steje ZDR).
export function prazniki(year) {
  if (cache[year]) return cache[year];
  const map = {};
  const add = (m0, d, name) => {
    map[dateId(year, m0, d)] = name;
  };

  add(0, 1, 'Novo leto');
  add(0, 2, 'Novo leto');
  add(1, 8, 'Prešernov dan');
  add(3, 27, 'Dan upora proti okupatorju');
  add(4, 1, 'Praznik dela');
  add(4, 2, 'Praznik dela');
  add(5, 25, 'Dan državnosti');
  add(7, 15, 'Marijino vnebovzetje');
  add(9, 31, 'Dan reformacije');
  add(10, 1, 'Dan spomina na mrtve');
  add(11, 25, 'Božič');
  add(11, 26, 'Dan samostojnosti in enotnosti');

  const easter = easterSunday(year);
  map[dateId(easter.getFullYear(), easter.getMonth(), easter.getDate())] =
    'Velika noč';
  const easterMonday = new Date(easter.getTime());
  easterMonday.setDate(easterMonday.getDate() + 1);
  map[
    dateId(
      easterMonday.getFullYear(),
      easterMonday.getMonth(),
      easterMonday.getDate()
    )
  ] = 'Velikonočni ponedeljek';
  const pentecost = new Date(easter.getTime());
  pentecost.setDate(pentecost.getDate() + 49);
  map[
    dateId(pentecost.getFullYear(), pentecost.getMonth(), pentecost.getDate())
  ] = 'Binkošti';

  cache[year] = map;
  return map;
}

/**
 * Število delovnih dni v mesecu: ponedeljek-petek, brez praznikov,
 * ki padejo na delovni dan (ti so plačani posebej in v fond ne štejejo).
 */
export function delovniDnevi(year, month0) {
  const p = prazniki(year);
  let n = 0;
  const skupaj = daysInMonth(year, month0);
  for (let d = 1; d <= skupaj; d++) {
    if (isWeekend(year, month0, d)) continue;
    if (p[dateId(year, month0, d)]) continue;
    n += 1;
  }
  return n;
}

/** Prazniki, ki v tem mesecu padejo na delovni dan (pon-pet). */
export function prazniciNaDelovniDan(year, month0) {
  const p = prazniki(year);
  const out = [];
  const skupaj = daysInMonth(year, month0);
  for (let d = 1; d <= skupaj; d++) {
    if (isWeekend(year, month0, d)) continue;
    const id = dateId(year, month0, d);
    if (p[id]) out.push({ date: id, name: p[id] });
  }
  return out;
}

/** Mesečni fond ur za polni delovni čas. */
export function mesecniFond(year, month0, dailyNorm = 8) {
  return Math.round(delovniDnevi(year, month0) * (Number(dailyNorm) || 8) * 100) / 100;
}

export function praznikZa(dateStr) {
  const year = Number(dateStr.slice(0, 4));
  return prazniki(year)[dateStr] || null;
}
