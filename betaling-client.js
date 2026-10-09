import { PAYMENT_API } from './betaling-config.js';
export const mollieTestActief = Boolean(PAYMENT_API);
export async function startTestbetaling(order) {
  if (!/^https:\/\//.test(PAYMENT_API)) throw new Error('De testkoppeling is nog niet ingesteld.');
  const fingerprint = JSON.stringify(order);
  let attempt;
  try { attempt = JSON.parse(sessionStorage.getItem('mollie-poging')); } catch {}
  if (attempt?.fingerprint !== fingerprint) attempt = {fingerprint, requestId:crypto.randomUUID()};
  sessionStorage.setItem('mollie-poging', JSON.stringify(attempt));
  const r = await fetch(`${PAYMENT_API}/checkout`, { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...order,requestId:attempt.requestId}) });
  const result = await r.json();
  if (!r.ok) throw new Error(result.error || 'De testbetaling kon niet gestart worden.');
  const checkout = new URL(result.checkout);
  if (checkout.protocol !== 'https:' || !(checkout.hostname === 'mollie.com' || checkout.hostname.endsWith('.mollie.com'))) throw new Error('Ongeldige betaalpagina.');
  sessionStorage.setItem('mollie-testbetaling',JSON.stringify({id:result.id,token:result.token}));
  window.location.assign(checkout.href);
}
