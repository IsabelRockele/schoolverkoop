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
      status.textContent = 'Bedankt voor je bestelling!';
      const o = result.order;
      uitleg.textContent = 'Je testbetaling is geslaagd en je bestelling is ontvangen.';
      const gegevens = document.getElementById('betaalGegevens');
      const dl = document.createElement('dl');
      for (const [label, value] of [['Leerling', o.names[0]], ['Klas', o.names[1]], ['Bestelnummer', payment.id]]) {
        const dt = document.createElement('dt'); dt.textContent = label;
        const dd = document.createElement('dd'); dd.textContent = value;
        dl.append(dt, dd);
      }
      gegevens.replaceChildren(dl);
      const delivery = /^\d{4}-\d{2}-\d{2}$/.test(o.delivery || '') ? new Date(`${o.delivery}T12:00:00`) : null;
      document.getElementById('leverDatum').textContent = delivery && !Number.isNaN(delivery.getTime())
        ? `Voorziene leverdatum: ${new Intl.DateTimeFormat('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' }).format(delivery)}.`
        : 'De leverdatum wordt nog meegedeeld.';
      document.getElementById('levering').hidden = false;
      const overview = document.getElementById('betaalOverzicht');
      overview.replaceChildren();
      const heading = document.createElement('h3'); heading.textContent = 'Je bestelling';
      const list = document.createElement('ul'); list.className = 'bestelregels';
      const lines = o.lines.map(([i,a,p]) => [`${a} × ${labels[i]}`, money(a*p)]);
      if (o.sponsor) lines.push(['Sponsoring', money(o.sponsor)]);
      for (const [label, amount] of lines) {
        const li = document.createElement('li'); li.className = 'bestelregel';
        const name = document.createElement('span'); name.textContent = label;
        const price = document.createElement('span'); price.className = 'bedrag'; price.textContent = amount;
        li.append(name, price); list.append(li);
      }
      const total = document.createElement('p'); total.className = 'totaal';
      const totalLabel = document.createElement('span'); totalLabel.textContent = 'Totaal';
      const totalAmount = document.createElement('span'); totalAmount.className = 'bedrag'; totalAmount.textContent = money(o.total);
      total.append(totalLabel, totalAmount); overview.append(heading, list, total);
      localStorage.removeItem('mandje'); localStorage.removeItem('sponsor'); sessionStorage.removeItem('mollie-poging');
      button.hidden = true;
      document.getElementById('naarMandje').hidden = true;
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
