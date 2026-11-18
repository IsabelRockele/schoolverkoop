import { createStudentPdf } from './excel-student-pdf.mjs?v=20261118-compact';
import { PRODUCTS, readOrders, summarize, money, quantity, columnName } from './excel-import.mjs';
import { priceYear, decodePrices, encodePrices, cachedPrices, cachePrices } from './excel-prices.mjs?v=20261118-eenvoudig';
import { DELIVERY_GROUPS, DELIVERY_KEYS, studentsFor, deliveryTotals } from './excel-distribution.mjs?v=20261118-automatisch';
import { profitDetails } from './excel-profit.mjs?v=20261118-eenvoudig';
import { supplierSections, supplierTotal, supplierRows as supplierTableRows, supplierTotalRow, SUPPLIER_HEADERS, downloadSupplierPdf } from './excel-suppliers.mjs';
const $ = id => document.getElementById(id);
const euro = cents => cents == null ? 'Nog in te vullen' : new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const table = (headers, rows) => `<table><thead><tr>${headers.map(h => `<th>${escape(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${escape(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
let workbook, result, filename = '', settings = {}, summary, costs, loadVersion = 0;
let activeYear = '2026', priceRevision = 0, pricesDirty = false, priceRequest = 0;
let validPrices = false;
function showPanel(name) {
  document.querySelectorAll('[data-panel]').forEach(panel => panel.hidden = panel.dataset.panel !== name);
  document.querySelectorAll('[data-tab]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.tab === name)));
  window.scrollTo({top:0});
}
document.querySelectorAll('[data-tab], [data-go]').forEach(button => button.onclick = () => showPanel(button.dataset.tab || button.dataset.go));
function enableReports(enabled) {
  $('reports').hidden = !enabled;
  document.querySelectorAll('[data-needs-orders]').forEach(button => button.disabled = !enabled);
}
function reset() {
  workbook = result = summary = null;
  filename = '';
  $('sheet').replaceChildren(); $('sheet').disabled = true;
  $('review').hidden = true;
  enableReports(false); showPanel('bestand');
  $('confirm').checked = false;
  for (const id of ['issues', 'mapping', 'preview', 'suppliers', 'classList', 'metrics', 'profitProducts']) $(id).replaceChildren();
  $('status').textContent = 'Nog geen bestand ingelezen.';
  $('fileSummary').textContent = 'Nog geen bestand';
}
$('clear').onclick = () => { loadVersion++; reset(); $('file').value = ''; };
$('file').onchange = async () => {
  const file = $('file').files[0], version = ++loadVersion;
  $('file').value = ''; // Allow selecting the same (corrected) export again.
  reset();
  if (!file) return;
  try {
    if (!/\.xlsx$/i.test(file.name)) throw Error('Kies een .xlsx-bestand.');
    if (file.size > 20 * 1024 * 1024) throw Error('Het bestand is groter dan 20 MB. Gebruik een kleinere export.');
    if (!window.XLSX) throw Error('De Excelbibliotheek kon niet worden geladen.');
    $('status').textContent = 'Excelbestand controleren…';
    const bytes = await file.arrayBuffer();
    if (version !== loadVersion) return;
    workbook = XLSX.read(bytes, { type: 'array', cellFormula: true });
    filename = file.name;
    $('sheet').replaceChildren(...workbook.SheetNames.map(name => new Option(name, name)));
    $('sheet').disabled = false;
    parseSheet();
  } catch (error) { if (version === loadVersion) { reset(); $('status').textContent = `Import mislukt: ${error.message}`; } }
};
$('sheet').onchange = parseSheet;
function parseSheet() {
  $('confirm').checked = false; enableReports(false); showPanel('bestand');
  const sheet = workbook.Sheets[$('sheet').value];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: true, raw: true });
  result = readOrders(rows);
  // WPForms exports are values. Never trust cached totals in formula cells.
  if (Object.values(sheet).some(cell => cell && typeof cell === 'object' && cell.f)) result.errors.push('Dit werkblad bevat formules. Gebruik de oorspronkelijke WPForms-export met vaste waarden.');
  $('review').hidden = false;
  $('confirm').disabled = result.errors.length > 0;
  $('status').textContent = `${filename} · ${$('sheet').value} · ${rows.slice(1).filter(row => row.some(v => String(v).trim())).length} rijen · ${result.orders.length} gecontroleerde bestellingen.`;
  $('fileSummary').textContent = `${result.orders.length} bestellingen · ${filename}`;
  $('issues').innerHTML = (result.errors.length ? `<div class="error"><strong>Import geblokkeerd. Corrigeer deze punten in Excel en lees het bestand opnieuw in.</strong><ul>${result.errors.map(e => `<li>${escape(e)}</li>`).join('')}</ul></div>` : '') + (result.warnings.length ? `<div class="warning"><strong>Controle nodig</strong><ul>${result.warnings.map(e => `<li>${escape(e)}</li>`).join('')}</ul></div>` : '');
  $('mapping').innerHTML = table(['Product', 'Stukprijs: Waarde', 'Aantal: Hoeveelheid'], result.mapping.map(p => [p.label, p.priceColumn == null ? 'Ontbreekt' : columnName(p.priceColumn), p.quantityColumn == null ? 'Ontbreekt' : columnName(p.quantityColumn)]));
  $('preview').innerHTML = table(['Excelrij', 'Leerling', 'Klas', 'Producten: aantal × stukprijs', 'Gift', 'Totaal (gecontroleerd)'], result.orders.map(order => [order.row, order.student, order.group, order.items.filter(i => i.count).map(i => `${PRODUCTS.find(p => p.key === i.key).label}: ${i.count} × ${euro(i.price)}`).join('; '), euro(order.gift), euro(order.total)]));
}
$('confirm').onchange = () => {
  enableReports($('confirm').checked && !result.errors.length);
  if ($('reports').hidden) return;
  const groups = [...new Set([...result.orders.map(o => o.group), 'AKB'])].sort((a,b) => a.localeCompare(b, 'nl', {numeric:true}));
  $('group').replaceChildren(...groups.map(group => new Option(group, group)));
  $('studentGroup').replaceChildren(...groups.map(group => new Option(group, group)));
  $('group').value=groups.find(group => result.orders.some(order => order.group===group)) || groups[0];
  refresh(); renderClass(); showPanel('leveranciers');
};
function renderSettings() {
  $('settings').innerHTML = `<table><thead><tr><th>Product</th><th>Inkoop per stuk / klein doosje (€)</th><th>Stuks per grote doos</th></tr></thead><tbody>${PRODUCTS.map(p => `<tr><td>${escape(p.label)}</td><td><input aria-label="Inkoop ${escape(p.label)}" data-key="${p.key}" data-field="cost" inputmode="decimal" placeholder="Nog invullen" value="${settings[p.key]?.cost == null ? '' : (settings[p.key].cost / 100).toFixed(2)}"></td><td><input aria-label="Doosinhoud ${escape(p.label)}" data-key="${p.key}" data-field="pack" type="number" min="1" step="1" value="${settings[p.key]?.pack ?? p.pack}" ${p.supplier === 'Kerstrozen' ? 'disabled' : ''}></td></tr>`).join('')}</tbody></table>`;
}
function priceChanged() {
  pricesDirty = true; priceRevision++;
  $('priceStatus').textContent = `Wijzigingen voor ${activeYear} nog niet bewaard. Klik op ‘Prijzen en kosten bewaren’.`;
  refresh();
}
$('settings').addEventListener('input', priceChanged);
$('transport').addEventListener('input', priceChanged);
$('mollieTotal').addEventListener('input',priceChanged);
function applyPrices(data) {
  const decoded = decodePrices(data);
  settings = decoded.settings;
  $('transport').value = decoded.transport; $('mollieTotal').value=decoded.mollieTotal;
  $('legacyCostNotice').hidden=!decoded.legacyFees || money(decoded.legacyFees)===0;
  $('legacyCostNotice').textContent=`Eerder ingevulde overige/gecombineerde kosten: ${decoded.legacyFees} euro. Deze worden niet meer apart afgetrokken. Controleer welke bedragen bij Factuur Mollie en Transportkosten horen.`;
  renderSettings(); refresh();
}
async function timeout(promise) {
  let timer;
  try { return await Promise.race([promise,new Promise((_,reject) => { timer = setTimeout(() => reject(Error('Geen verbinding met gedeelde prijzen.')),8000); })]); }
  finally { clearTimeout(timer); }
}
async function loadYear() {
  if (pricesDirty) { $('priceStatus').textContent = 'Bewaar eerst je gewijzigde prijzen en kosten voordat je een ander jaar laadt.'; return; }
  let year;
  try { year = priceYear($('priceYear').value); }
  catch (e) { $('priceStatus').textContent = e.message; return; }
  const request = ++priceRequest, revision = priceRevision;
  activeYear = year;
  $('yearSummary').textContent = `Verkoopjaar ${year}`;
  let source = 'Nog geen inkoopprijzen voor dit jaar', pending = false;
  try {
    const cached = cachedPrices(localStorage,year);
    applyPrices(cached.data); source = cached.source;
    pending = localStorage.getItem(`excel_${year}_pending`) === '1';
    localStorage.setItem('excel_verkoopjaar',year);
  } catch { applyPrices({}); source = 'Lokale prijzen niet beschikbaar'; }
  $('priceStatus').textContent = `${source} (${year}). Gedeelde prijzen controleren…`;
  try {
    const cloud = await timeout(import('./excel-cloud.mjs'));
    const response = await timeout(cloud.loadPrices(year));
    if (request !== priceRequest || revision !== priceRevision) return;
    $('priceLogin').hidden = response.signedIn;
    if (response.data && !pending) {
      applyPrices(response.data);
      try { cachePrices(localStorage,year,response.data); } catch { /* Shared values remain usable. */ }
      $('priceStatus').textContent = `Bestaande inkoopprijzen voor ${year} geladen uit de gedeelde winstberekening.`;
    } else {
      $('priceStatus').textContent = `${source} (${year}). ${pending ? 'Lokale wijzigingen nog niet gedeeld. Bewaar opnieuw om te synchroniseren.' : response.signedIn ? 'Geen gedeelde prijzen voor dit jaar gevonden.' : 'Meld je aan om eerder ingestelde gedeelde prijzen te laden.'}`;
    }
  } catch {
    if (request === priceRequest && revision === priceRevision) $('priceStatus').textContent = `${source} (${year}). Gedeelde prijzen niet bereikbaar; je kunt lokaal verderwerken.`;
  }
}
$('loadPrices').onclick = loadYear;
$('savePrices').onclick = async () => {
  refresh();
  if (!validPrices) { $('priceStatus').textContent = 'Corrigeer eerst de ongeldige prijzen, doosinhoud of kosten.'; return; }
  if ($('priceYear').value !== activeYear) { $('priceStatus').textContent = `Je bewerkt ${activeYear}. Zet het jaarveld terug op ${activeYear} om deze wijzigingen te bewaren.`; return; }
  const year = activeYear, revision = priceRevision, data = encodePrices(settings,costs);
  let local = false;
  try { cachePrices(localStorage,year,data); localStorage.setItem(`excel_${year}_pending`,'1'); local = true; } catch { /* Try the shared store. */ }
  $('savePrices').disabled = true; $('loadPrices').disabled = true;
  $('priceStatus').textContent = `Prijzen en kosten voor ${year} bewaren…`;
  let shared = false;
  try { const cloud = await timeout(import('./excel-cloud.mjs')); shared = await timeout(cloud.savePrices(year,data)); } catch { /* Report local-only storage below. */ }
  if (shared) { try { localStorage.removeItem(`excel_${year}_pending`); } catch {} }
  if (revision === priceRevision) {
    pricesDirty = !(local || shared);
    $('priceStatus').textContent = shared ? `Prijzen en kosten voor ${year} gedeeld bewaard. De bestaande winstberekening gebruikt dezelfde inkoopprijzen.` : local ? `Prijzen en kosten voor ${year} alleen op deze computer bewaard. Meld je aan en bewaar opnieuw om ze te delen.` : 'Bewaren mislukt. Houd deze pagina open en probeer opnieuw.';
  }
  $('savePrices').disabled = false; $('loadPrices').disabled = false;
};
$('saveCosts').onclick = async () => {
  $('saveCosts').disabled=true;
  try { await $('savePrices').onclick(); $('legacyCostNotice').hidden=false; $('legacyCostNotice').textContent=$('priceStatus').textContent; }
  finally { $('saveCosts').disabled=false; }
};
function refresh() {
  validPrices = false;
  try {
    const next = {};
    $('settings').querySelectorAll('input').forEach(input => {
      const { key, field } = input.dataset;
      next[key] ??= {};
      try {
        next[key][field] = field === 'cost' ? (input.value.trim() === '' ? null : money(input.value)) : quantity(input.value);
        if (field === 'pack' && next[key][field] < 1) throw Error('Minimaal 1');
        input.setCustomValidity('');
      } catch { input.setCustomValidity('Vul een geldig bedrag of positief geheel aantal in.'); throw Error(`Controleer ${PRODUCTS.find(p => p.key === key).label}: ${field === 'cost' ? 'inkoopprijs' : 'doosinhoud'}.`); }
    });
    settings = next;
    costs = {};
    for (const id of ['transport', 'mollieTotal']) {
      try { costs[id] = $(id).value.trim() === '' ? null : money($(id).value); }
      catch { throw Error(`Controleer ${id === 'mollieTotal' ? 'de Mollie-factuur' : 'de transportkosten'}.`); }
    }
    const total=costs.mollieTotal, rate=39, mode=total==null ? 'estimate' : 'total';
    costs.mollieSettings={mode,total,rate};
    costs.mollie=total ?? (result ? rate*result.orders.length : null);
    $('profitError').hidden=true;
    validPrices = true;
    if (!result || result.errors.length || !$('confirm').checked) return;
    summary = summarize(result.orders, settings);
    const details = profitDetails(summary,costs), profit = details.value;
    const note=[mode==='estimate' ? `Met geschatte Mollie-kosten: ${result.orders.length} × € 0,39 = ${euro(costs.mollie)}.` : `Mollie-factuur: ${euro(costs.mollie)}.`, costs.transport==null ? 'Zonder transportkosten (nog niet ingevuld).' : `Transport: ${euro(costs.transport)}.`, details.excluded.some(v => v.startsWith('inkoop ')) ? `Zonder ontbrekende inkoopprijzen: ${details.excluded.filter(v => v.startsWith('inkoop ')).map(v => v.slice(7)).join(', ')}.` : ''].filter(Boolean).join(' ');
    $('metrics').innerHTML = [['Bestellingen', result.orders.length], ['Omzet volgens Excel', euro(summary.revenue)], ['Waarvan giften', euro(summary.gifts)], ['Verkochte stuks', summary.products.reduce((s,p) => s + p.sold, 0)]].map(([label, value]) => `<div class="metric">${escape(label)}<strong>${escape(value)}</strong></div>`).join('')+`<div class="metric profit-metric" id="profit" aria-live="polite"><span>${details.provisional ? 'Voorlopige' : 'Berekende'} winst</span><strong>${escape(euro(profit))}</strong><small>${escape(note)}</small></div>`;
    renderSupplier();
    $('profitProducts').innerHTML = table(['Product','Verkocht','Besteld','Omzet','Inkoop','Marge'],summary.products.map(p => [p.label,p.sold,p.ordered,euro(p.revenue),euro(p.cost),p.cost == null ? 'Nog in te vullen' : euro(p.revenue-p.cost)]));
    document.querySelectorAll('[data-pdf]').forEach(button => button.disabled = button.dataset.pdf === 'winst' && profit == null);
  } catch (error) {
    summary = null;
    $('profitError').hidden=false; $('profitError').textContent=error.message;
    if ($('profit')) $('profit').innerHTML='<span>Winst</span><strong>—</strong><small>Controleer de ingevulde bedragen.</small>';
    $('suppliers').replaceChildren();
    $('profitProducts').replaceChildren();
    document.querySelectorAll('[data-pdf]').forEach(button => button.disabled = true);
  }
}
function renderSupplier() {
  const supplier = $('supplier').value;
  if (summary) {
    const sections=supplierSections(summary,supplier);
    const total=supplierTotal(sections.flatMap(section => section.products));
    $('suppliers').innerHTML=sections.map(section => `<h3>${escape(section.title)}</h3>${supplier==='Kerstrozen' ? `<p class="hint">${escape(section.note)}</p>` : ''}${table(SUPPLIER_HEADERS[supplier],[...supplierTableRows(section,supplier),supplierTotalRow(section,supplier)])}${supplier==='Truffels' ? `<p class="hint">${escape(section.note)}</p>` : ''}`).join('')+`<div class="supplier-invoice"><strong>Te betalen aan leverancier ${supplier.toLowerCase()}${supplier==='Truffels' ? ' (250 g + 500 g)' : ''}</strong><strong>${total.cost==null ? 'Niet volledig: inkoopprijs ontbreekt' : euro(total.cost)}</strong></div>`;
  } else $('suppliers').replaceChildren();
  document.querySelectorAll('[data-pdf="Kerstrozen"], [data-pdf="Truffels"]').forEach(button => button.hidden = button.dataset.pdf !== supplier);
}
$('supplier').onchange = renderSupplier;
function profitValue() { return summary ? profitDetails(summary,costs).value : null; }
function classData(group) {
  const students = studentsFor(result.orders,group), totals = deliveryTotals(students);
  const headers = ['Leerling', ...DELIVERY_GROUPS.flatMap(g => g.labels), 'Totaal stuks', 'Meegegeven'];
  const rows = students.map(s => [s.name,...DELIVERY_KEYS.map(key => s.counts[key] || '—'),s.total,'[  ]']);
  if (students.length) rows.push(['KLASTOTAAL',...DELIVERY_KEYS.map(key => totals.counts[key]),totals.total,'']);
  return {headers, rows, totals, students};
}
function renderClass() {
  $('studentGroup').value=$('group').value;
  const data = classData($('group').value);
  const cellClass = i => i===0 ? 'student-name' : i<=9 ? `${DELIVERY_GROUPS[Math.floor((i-1)/3)].style} ${(i-1)%3===0 ? 'group-start' : ''}` : 'delivery-end';
  $('classList').innerHTML = data.students.length ? `<table class="delivery-table"><thead><tr><th rowspan="2" scope="col">Leerling</th>${DELIVERY_GROUPS.map(g => `<th colspan="3" scope="colgroup" class="${g.style} group-start">${g.label}</th>`).join('')}<th rowspan="2" scope="col">Totaal<br>stuks</th><th rowspan="2" scope="col">Meegegeven</th></tr><tr>${DELIVERY_GROUPS.map(g => g.labels.map((label,i) => `<th scope="col" class="${g.style} ${i===0 ? 'group-start' : ''}">${label}</th>`).join('')).join('')}</tr></thead><tbody>${data.rows.slice(0,-1).map(row => `<tr>${row.map((value,i) => `<td class="${cellClass(i)}">${escape(value)}</td>`).join('')}</tr>`).join('')}</tbody><tfoot><tr>${data.rows.at(-1).map((value,i) => `<th class="${i===1 || i===4 || i===7 ? 'group-start' : ''}" ${i===0 ? 'scope="row"' : ''}>${escape(value)}</th>`).join('')}</tr><tr class="group-totals"><th scope="row">Per productgroep</th>${DELIVERY_GROUPS.map((g,i) => `<td colspan="3" class="${g.style} group-start">${data.totals.groups[i]} ${i===0 ? 'kerstrozen' : `doosjes ${i===1 ? '250' : '500'} g`}</td>`).join('')}<td colspan="2">${data.totals.total} stuks samen</td></tr></tfoot></table>` : '<p>Geen bestellingen voor deze groep in dit bestand.</p>';
  $('student').replaceChildren(...data.students.map(s => new Option(s.name,s.id)));
  $('classStudentsPdf').textContent=`Download PDF voor ${$('group').value} · ${data.students.length} leerlingen`;
  for (const id of ['classPdf','studentPdf','classStudentsPdf']) $(id).disabled = !data.students.length;
}
$('group').onchange = renderClass;
$('studentGroup').onchange = () => { $('group').value=$('studentGroup').value;renderClass(); };
// One table renderer for all PDFs: wraps text, repeats headers and paginates.
function pdfReport(sections, name, download=true) {
  try {
    if (!window.jspdf) throw Error('De PDFbibliotheek kon niet worden geladen.');
    const pdf = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const width = 277, left = 10, bottom = 190;
    let y;
    const text = value => String(value).replace(/€/g, 'EUR').replace(/—/g, '-');
    sections.forEach((section, sectionIndex) => {
      const weights = section.headers.map((_,i) => i === 0 ? 2 : 1);
      if (section.classroom) { weights[0] = 3.5; weights[weights.length-1] = 1.5; }
      const cols = weights.map(w => width * w / weights.reduce((a,b) => a+b,0));
      function row(cells, heading = false, total = false) {
        pdf.setFont('helvetica', heading || total ? 'bold' : 'normal'); pdf.setFontSize(section.classroom ? 9 : 8);
        const lines = cells.map((cell,i) => pdf.splitTextToSize(text(cell), cols[i] - 4));
        const height = Math.max(...lines.map(l => l.length), 1) * 3.7 + 5;
        if (y + height > bottom && !heading) { pdf.addPage(); pageHeader(); pdf.setFont('helvetica',total ? 'bold' : 'normal'); }
        let x = left;
        cells.forEach((_,i) => {
          const band = section.classroom && i>=1 && i<=9 ? DELIVERY_GROUPS[Math.floor((i-1)/3)] : null;
          pdf.setFillColor(...(total ? [25,78,70] : heading && band ? band.color : heading ? [228,238,232] : [250,251,250]));
          pdf.rect(x,y,cols[i],height,'F'); pdf.setTextColor(...(total ? [255,255,255] : [25,55,47]));
          if (band && (i-1)%3===0) { pdf.setDrawColor(175,185,178); pdf.line(x,y,x,y+height); }
          pdf.text(lines[i],i>0 && section.classroom ? x+cols[i]/2 : x+2,y+4,i>0 && section.classroom ? {align:'center'} : {}); x += cols[i];
        });
        y += height + .5;
      }
      function pageHeader() {
        pdf.setTextColor(25,55,47); pdf.setFont('helvetica','bold'); pdf.setFontSize(16); pdf.text(text(section.title),left,15);
        pdf.setFont('helvetica','normal'); pdf.setFontSize(8);
        const notes = pdf.splitTextToSize(text(`De Linde | Verkoopjaar ${activeYear} | ${filename} | ${$('sheet').value}\n${section.note || ''}`),width);
        pdf.text(notes,left,22); y = 25 + notes.length * 3.5;
        if (section.classroom) {
          let x = left+cols[0];
          DELIVERY_GROUPS.forEach((group,index) => {
            const w = cols.slice(1+index*3,4+index*3).reduce((a,b) => a+b,0);
            pdf.setFillColor(...group.color); pdf.rect(x,y,w,9,'F');
            pdf.setFont('helvetica','bold'); pdf.setFontSize(10); pdf.text(group.label,x+w/2,y+6,{align:'center'}); x+=w;
          });
          y+=9;
        }
        row(section.headers,true);
      }
      if (sectionIndex) pdf.addPage();
      pageHeader(); section.rows.forEach((cells,index) => row(cells,false,section.classroom && section.students.length>0 && index===section.rows.length-1));
      if (section.classroom && section.students.length) {
        if (y+14>bottom) { pdf.addPage(); pageHeader(); }
        pdf.setTextColor(25,55,47); pdf.setFont('helvetica','bold'); pdf.setFontSize(10);
        pdf.text(`Klastotalen: ${section.totals.groups[0]} kerstrozen | ${section.totals.groups[1]} doosjes truffels 250 g | ${section.totals.groups[2]} doosjes truffels 500 g | ${section.totals.total} stuks samen`,left,y+8);
      }
    });
    for (let page = 1; page <= pdf.getNumberOfPages(); page++) { pdf.setPage(page); pdf.setFontSize(8); pdf.text(`${page} / ${pdf.getNumberOfPages()}`, 280, 202, {align:'right'}); }
    if(download) pdf.save(name);
    return pdf;
  } catch (error) { if(!download) throw error; $('status').textContent = `PDF maken mislukt: ${error.message}`; }
}
document.querySelectorAll('[data-pdf]').forEach(button => button.onclick = async () => {
  if (!summary) return;
  const supplier = button.dataset.pdf;
  if (supplier === 'winst') {
    const profit = profitValue(); if (profit == null) return;
    const details = profitDetails(summary,costs);
    pdfReport([{ title:details.provisional ? 'Voorlopige winstberekening schoolverkoop' : 'Winstberekening schoolverkoop', note:`${details.provisional ? 'Voorlopige' : 'Berekende'} winst: ${euro(profit)}${details.suffix}.\nAlle bestellingen uit Excel, betaalstatus onbekend. Omzet ${euro(summary.revenue)} (waarvan gift ${euro(summary.gifts)}). Bekende inkoop inclusief overschot ${euro(details.knownCost)}. Mollie ${euro(costs.mollie)}${costs.mollieSettings.mode==='estimate' ? ` (schatting: ${result.orders.length} bestellingen x EUR 0,39)` : ' (factuur)'}. Transport ${euro(costs.transport)}.`, headers:['Product','Verkocht','Besteld','Omzet','Inkoop','Marge voor overige kosten'], rows:summary.products.map(p => [p.label,p.sold,p.ordered,euro(p.revenue),euro(p.cost),`${euro(p.revenue-(p.cost ?? 0))}${p.cost == null ? ' (zonder inkoop)' : ''}`]) }], 'winstberekening.pdf');
  } else {
    button.disabled=true;
    try { await downloadSupplierPdf(summary,supplier,activeYear); }
    catch (error) { alert(`PDF maken mislukt: ${error.message}`); }
    finally { button.disabled=false; }
  }
});
function classSection(group) { return { title:`Uitdeellijst - ${group}`, classroom:true, note:'Aantallen per leerling. Bestellingen met dezelfde leerlingnaam binnen deze klas zijn samengevoegd. Vink af bij het meegeven.', ...classData(group) }; }
$('classPdf').onclick = () => pdfReport([classSection($('group').value)], `klas_${$('group').value.replace(/[^a-z0-9]/gi,'_')}.pdf`);
$('allClassesPdf').onclick = () => pdfReport([...$('group').options].map(o => classSection(o.value)).map(section => section.rows.length ? section : {...section, rows:[section.headers.map((_,i) => i === 0 ? 'Geen bestellingen' : '')]}), 'alle_klassen_en_AKB.pdf');
function studentSheets(students, name) {
  if (!students.length) return;
  try {
    if (!window.jspdf) throw Error('De PDFbibliotheek kon niet worden geladen.');
    const pdf=createStudentPdf(students,activeYear,window.jspdf.jsPDF);
    pdf.save(name);
  } catch (error) { $('status').textContent=`PDF maken mislukt: ${error.message}`; }
}
$('studentPdf').onclick = () => studentSheets(studentsFor(result.orders,$('group').value).filter(s => s.id===$('student').value),'levering_leerling.pdf');
$('classStudentsPdf').onclick = () => studentSheets(studentsFor(result.orders,$('group').value),`besteloverzichten_${$('group').value.replace(/[^a-z0-9]/gi,'_')}.pdf`);
async function downloadClassZip(studentSheets) {
  const buttons=[$('classesZip'),$('studentsZip')];
  buttons.forEach(button=>button.disabled=true);
  $('zipStatus').textContent='PDF’s per klas verzamelen…';
  try {
    await new Promise(resolve=>setTimeout(resolve,0));
    const groups=[...new Set(result.orders.map(order=>order.group))].sort((a,b)=>a.localeCompare(b,'nl',{numeric:true}));
    if(!groups.length) throw Error('Er zijn geen bestellingen om te downloaden.');
    if(!window.jspdf || !window.XLSX?.CFB) throw Error('De downloadbibliotheek kon niet worden geladen. Vernieuw de pagina.');
    const {CFB}=window.XLSX,zip=CFB.utils.cfb_new();
    const usedNames=new Set();
    for(const group of groups) {
      const base=group.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/g,'') || 'klas';
      let unique=base,suffix=2;
      while(usedNames.has(unique.toLowerCase())) unique=`${base}_${suffix++}`;
      usedNames.add(unique.toLowerCase());
      const pdf=studentSheets ? createStudentPdf(studentsFor(result.orders,group),activeYear,window.jspdf.jsPDF) : pdfReport([classSection(group)],null,false);
      CFB.utils.cfb_add(zip,`${studentSheets ? 'leerlingbladen' : 'klasoverzicht'}_${unique}.pdf`,new Uint8Array(pdf.output('arraybuffer')));
    }
    const bytes=CFB.write(zip,{type:'array',fileType:'zip',compression:true});
    const url=URL.createObjectURL(new Blob([bytes],{type:'application/zip'}));
    const link=document.createElement('a');link.href=url;link.download=`${studentSheets ? 'leerlingbladen_per_klas' : 'klasoverzichten'}_${activeYear}.zip`;
    document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    $('zipStatus').textContent=`ZIP gedownload: ${groups.length} PDF’s, één per klas met bestellingen.`;
  } catch(error) { $('zipStatus').textContent=`ZIP maken mislukt: ${error.message}`; }
  finally { buttons.forEach(button=>button.disabled=false); }
}
$('classesZip').onclick=()=>downloadClassZip(false);
$('studentsZip').onclick=()=>downloadClassZip(true);
try { $('priceYear').value = priceYear(localStorage.getItem('excel_verkoopjaar') || '2026'); } catch {}
await loadYear();
