// TEST ONLY. No live keys, service-account keys or buyer-provided prices.
const ROOT = 'https://firestore.googleapis.com/v1/projects/schoolverkoop-3d82d/databases/(default)/documents';
const catalog = [
  ['kerstrozen', 'Kerstrozen', 'wit', 4], ['kerstrozen', 'Kerstrozen', 'rood', 4], ['kerstrozen', 'Kerstrozen', 'roze', 4],
  ['truffel250', 'Truffels 250 g', 'wit', 6], ['truffel250', 'Truffels 250 g', 'melk', 6], ['truffel250', 'Truffels 250 g', 'donker', 6],
  ['truffel500', 'Truffels 500 g', 'wit', 12], ['truffel500', 'Truffels 500 g', 'melk', 12], ['truffel500', 'Truffels 500 g', 'donker', 12]
];
function requireThat(ok, message) { if (!ok) throw new Error(message); }
export function encode(value) {
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'number') return { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k,v]) => [k,encode(v)])) } };
}
function decode(v) {
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k,x]) => [k,decode(x)]));
  return v.stringValue ?? v.timestampValue ?? (v.integerValue !== undefined ? Number(v.integerValue) : v.doubleValue);
}
async function settings() {
  const r = await fetch(`${ROOT}/publieke_instellingen/kerstverkoop_2026`);
  if (r.status === 404) return {};
  requireThat(r.ok, 'Verkoopinstellingen konden niet worden geladen.');
  return decode({mapValue: await r.json()});
}
export function prepare(body, config, now = Date.now()) {
  requireThat(!config.startOp || now >= Date.parse(config.startOp), 'De verkoop is nog niet gestart.');
  requireThat(!config.eindOp || now <= Date.parse(config.eindOp), 'De verkoop is afgesloten.');
  const names = ['leerling','klas','naamKoper','emailKoper'].map(k => String(body[k] || '').trim());
  requireThat(names.every(n => n.length > 0 && n.length <= 120) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(names[3]), 'Vul alle gegevens en een geldig e-mailadres in.');
  requireThat(Array.isArray(body.producten) && body.producten.length <= 9, 'Ongeldig mandje.');
  const lines = body.producten.map(p => {
    const i = catalog.findIndex(c => c[1] === p.naam && c[2] === p.variant);
    requireThat(i >= 0 && Number.isInteger(p.aantal) && p.aantal > 0 && p.aantal <= 100, 'Ongeldig product of aantal.');
    const price = config.verkoopprijzen?.[catalog[i][0]] ?? catalog[i][3];
    const cents = Math.round(Number(price) * 100);
    requireThat(Number.isFinite(cents) && cents > 0, 'Ongeldige verkoopprijs.');
    return [i, p.aantal, cents];
  });
  requireThat(new Set(lines.map(l => l[0])).size === lines.length, 'Dubbel product.');
  const sponsor = Math.round(Number(body.sponsorBedrag || 0) * 100);
  requireThat(Number.isFinite(sponsor) && sponsor >= 0 && sponsor <= 100000, 'Ongeldig sponsorbedrag.');
  const total = lines.reduce((n,l) => n + l[1]*l[2], sponsor);
  requireThat(total > 0 && total <= 500000, 'Ongeldig totaalbedrag.');
  const metadata = { app: 'delinde-test-v1', token: crypto.randomUUID(), names, lines, sponsor, total, delivery: config.leverdatum || '' };
  requireThat(new TextEncoder().encode(JSON.stringify(metadata)).length <= 950, 'De ingevulde gegevens zijn te lang.');
  return metadata;
}
async function mollie(env, path, body, idempotency) {
  requireThat(/^test_[A-Za-z0-9]+$/.test(env.MOLLIE_TEST_API_KEY || ''), 'De Mollie-testsleutel ontbreekt of is ongeldig. Live-sleutels zijn niet toegestaan.');
  const r = await fetch(`https://api.mollie.com/v2/payments${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${env.MOLLIE_TEST_API_KEY}`, 'Content-Type': 'application/json', ...(idempotency ? {'Idempotency-Key': idempotency} : {}) },
    ...(body ? {body: JSON.stringify(body)} : {})
  });
  requireThat(r.ok, 'Mollie kon de testbetaling niet verwerken. Controleer de testsleutel en betaalmethoden.');
  return r.json();
}
async function record(payment) {
  const m = payment.metadata;
  requireThat(payment.mode === 'test' && m?.app === 'delinde-test-v1', 'Onbekende testbetaling.');
  requireThat(payment.amount.currency === 'EUR' && Math.round(Number(payment.amount.value)*100) === m.total, 'Het betaalbedrag klopt niet.');
  if (payment.status !== 'paid') return false;
  const order = { actieId:'kerstverkoop_2026', leerling:m.names[0], klas:m.names[1], naamKoper:m.names[2], emailKoper:m.names[3],
    producten:m.lines.map(([i,a,p]) => ({naam:catalog[i][1], variant:catalog[i][2], aantal:a, prijs:p/100})),
    sponsorBedrag:m.sponsor/100, totaal:m.total/100, status:'test' };
  const fields = encode(order).mapValue.fields;
  fields.aangemaaktOp = {timestampValue: new Date().toISOString()};
  // Deterministic ID: repeated redirects/webhooks cannot add duplicate orders.
  const r = await fetch(`${ROOT}/bestellingen_test?documentId=mollie_${payment.id}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({fields}) });
  requireThat(r.ok || r.status === 409, 'Testbetaling geslaagd, maar opslaan is nog niet gelukt. Probeer de status opnieuw.');
  return true;
}
export default {
  async fetch(request, env) {
    env = {SITE_URL:'https://isabelrockele.github.io/schoolverkoop/', ...env};
    const url = new URL(request.url);
    const origin = new URL(env.SITE_URL).origin;
    const headers = {'Content-Type':'application/json', 'Cache-Control':'no-store', 'Access-Control-Allow-Origin':origin, 'Access-Control-Allow-Headers':'Content-Type', 'Access-Control-Allow-Methods':'POST, GET, OPTIONS', 'Vary':'Origin'};
    const reply = (data, status=200) => new Response(JSON.stringify(data), {status,headers});
    if (request.method === 'OPTIONS') return new Response(null,{status:204,headers});
    try {
      if (url.pathname === '/checkout' && request.method === 'POST') {
        requireThat(request.headers.get('Origin') === origin, 'Open de bestelling via de schoolwebsite.');
        const raw = await request.text(); requireThat(raw.length < 12000, 'Aanvraag te groot.');
        const body = JSON.parse(raw);
        requireThat(/^[a-f0-9-]{36}$/.test(body.requestId || ''), 'Ongeldige aanvraag.');
        const m = prepare(body, await settings());
        const p = await mollie(env, '', { amount:{currency:'EUR',value:(m.total/100).toFixed(2)}, description:'TEST schoolverkoop De Linde', locale:'nl_BE',
          redirectUrl: new URL('betaling.html',env.SITE_URL).href,
          webhookUrl:`${url.origin}/webhook`, metadata:m }, body.requestId);
        requireThat(p.mode === 'test' && p._links?.checkout?.href, 'Geen geldige testbetaling ontvangen.');
        return reply({id:p.id, token:p.metadata.token, checkout:p._links.checkout.href});
      }
      if (url.pathname === '/status' && request.method === 'POST') {
        const raw = await request.text(); requireThat(raw.length < 1000, 'Aanvraag te groot.');
        const b = JSON.parse(raw);
        requireThat(/^tr_[A-Za-z0-9]+$/.test(b.id || ''), 'Ongeldige betaling.');
        const p = await mollie(env,`/${b.id}`);
        requireThat(typeof b.token === 'string' && b.token === p.metadata?.token, 'Geen toegang tot deze bestelling.');
        const saved = await record(p);
        return reply({status:p.status,saved,order:saved ? p.metadata : null});
      }
      if (url.pathname === '/webhook' && request.method === 'POST') {
        const raw = await request.text(); requireThat(raw.length < 1000, 'Aanvraag te groot.');
        const id = new URLSearchParams(raw).get('id');
        requireThat(/^tr_[A-Za-z0-9]+$/.test(id || ''), 'Ongeldige betaling.');
        await record(await mollie(env,`/${id}`));
        return reply({ok:true});
      }
      return reply({error:'Niet gevonden'},404);
    } catch(e) { return reply({error: e instanceof SyntaxError ? 'Ongeldige aanvraag.' : e.message},400); }
  }
};
