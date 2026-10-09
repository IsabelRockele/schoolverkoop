import { PAYMENT_API } from './betaling-config.js';
const status = document.getElementById('betaalStatus');
const uitleg = document.getElementById('betaalUitleg');
const button = document.getElementById('controleer');
const money = n => new Intl.NumberFormat('nl-BE',{style:'currency',currency:'EUR'}).format(n/100);
const labels = ['Kerstrozen wit','Kerstrozen rood','Kerstrozen roze','Truffels 250 g wit','Truffels 250 g melk','Truffels 250 g donker','Truffels 500 g wit','Truffels 500 g melk','Truffels 500 g donker'];
async function check() {
  button.disabled = true;
  try {
    const payment = JSON.parse(sessionStorage.getItem('mollie-testbetaling'));
    if (!payment || !PAYMENT_API) throw new Error('Open deze pagina in dezelfde browser waarmee je de testbetaling gestart hebt.');
    const r = await fetch(`${PAYMENT_API}/status`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payment)});
    const result = await r.json();
    if (!r.ok) throw new Error(result.error);
    if (result.saved) {
      status.textContent = 'Bedankt! Je testbetaling is geslaagd en je bestelling is ontvangen.';
      const o = result.order;
      uitleg.textContent = `Bestelnummer ${payment.id}. Voor ${o.names[0]} (${o.names[1]}). ` + (o.delivery ? `Voorziene leverdatum: ${o.delivery}. ` : 'De leverdatum wordt nog meegedeeld. ') + 'De bestelling wordt met deze leerling meegegeven. Heb je een week na de leverdatum nog niets ontvangen? Mail administratie@bsdelinde.net.';
      const overview = document.getElementById('betaalOverzicht');
      overview.replaceChildren();
      const lines = o.lines.map(([i,a,p]) => `${a} × ${labels[i]} — ${money(a*p)}`);
      if (o.sponsor) lines.push(`Sponsoring — ${money(o.sponsor)}`);
      lines.push(`Totaal: ${money(o.total)}`);
      for (const line of lines) { const p = document.createElement('p'); p.textContent=line; overview.append(p); }
      localStorage.removeItem('mandje'); localStorage.removeItem('sponsor'); sessionStorage.removeItem('mollie-poging');
      button.hidden = true;
    } else {
      const terminal = ['failed','canceled','expired'].includes(result.status);
      status.textContent = terminal ? 'De testbetaling is niet geslaagd.' : 'De testbetaling is nog niet afgerond.';
      uitleg.textContent = 'Er is nog geen bestelling toegevoegd aan het secretariaatsoverzicht.';
      if (terminal) sessionStorage.removeItem('mollie-poging');
    }
  } catch(e) { status.textContent='Controle nog niet gelukt'; uitleg.textContent=e.message || 'Probeer opnieuw.'; }
  finally { button.disabled=false; }
}
button.addEventListener('click',check);
check();
