// Tanka ovojnica okoli Upstash Redis REST API-ja.
// Namenoma brez knjiznice (@upstash/redis), da ni tezav z avtomatsko
// deserializacijo - vse hranimo kot navaden JSON string.

const URL_ =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.REDIS_URL;

const TOKEN =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.REDIS_TOKEN;

export function redisConfigured() {
  return Boolean(URL_ && TOKEN);
}

async function cmd(command) {
  if (!redisConfigured()) {
    throw new Error(
      'Baza ni nastavljena. Manjkata KV_REST_API_URL in KV_REST_API_TOKEN.'
    );
  }
  const res = await fetch(URL_, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Napaka baze (${res.status}): ${text}`);
  }
  const json = await res.json();
  if (json.error) throw new Error(`Napaka baze: ${json.error}`);
  return json.result;
}

export async function getJSON(key, fallback = null) {
  const raw = await cmd(['GET', key]);
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export async function setJSON(key, value) {
  return cmd(['SET', key, JSON.stringify(value)]);
}

export async function del(key) {
  return cmd(['DEL', key]);
}

export async function keys(pattern) {
  const res = await cmd(['KEYS', pattern]);
  return Array.isArray(res) ? res : [];
}
