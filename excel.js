import { PRODUCTS, readOrders, summarize, money, quantity, columnName } from './excel-import.mjs';
const $ = id => document.getElementById(id);
const euro = cents => cents == null ? 'Nog in te vullen' : new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const table = (headers, rows) => `<table><thead><tr>${headers.map(h => `<th>${escape(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${escape(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
let workbook, result, filename = '', settings = {}, summary, costs, loadVersion = 0;
function reset() {
  workbook = result = summary = null;
  filename = '';
  settings = {};
  $('fees').value = $('transport').value = '';
  $('sheet').replaceChildren(); $('sheet').disabled = true;
  $('review').hidden = $('reports').hidden = true;
  $('confirm').checked = false;
  for (const id of ['issues', 'mapping', 'preview', 'settings', 'suppliers', 'classList', 'metrics', 'profit']) $(id).replaceChildren();
  $('status').textContent = 'Nog geen bestand ingelezen.';
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
  $('confirm').checked = false; $('reports').hidden = true;
  const sheet = workbook.Sheets[$('sheet').value];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: true, raw: true });
  result = readOrders(rows);
  // WPForms exports are values. Never trust cached totals in formula cells.
  if (Object.values(sheet).some(cell => cell && typeof cell === 'object' && cell.f)) result.errors.push('Dit werkblad bevat formules. Gebruik de oorspronkelijke WPForms-export met vaste waarden.');
  $('review').hidden = false;
  $('confirm').disabled = result.errors.length > 0;
  $('status').textContent = `${filename} · ${$('sheet').value} · ${rows.slice(1).filter(row => row.some(v => String(v).trim())).length} rijen · ${result.orders.length} gecontroleerde bestellingen.`;
  $('issues').innerHTML = (result.errors.length ? `<div class="error"><strong>Import geblokkeerd. Corrigeer deze punten in Excel en lees het bestand opnieuw in.</strong><ul>${result.errors.map(e => `<li>${escape(e)}</li>`).join('')}</ul></div>` : '') + (result.warnings.length ? `<div class="warning"><strong>Controle nodig</strong><ul>${result.warnings.map(e => `<li>${escape(e)}</li>`).join('')}</ul></div>` : '');
  $('mapping').innerHTML = table(['Product', 'Stukprijs: Waarde', 'Aantal: Hoeveelheid'], result.mapping.map(p => [p.label, p.priceColumn == null ? 'Ontbreekt' : columnName(p.priceColumn), p.quantityColumn == null ? 'Ontbreekt' : columnName(p.quantityColumn)]));
  $('preview').innerHTML = table(['Excelrij', 'Leerling', 'Klas', 'Producten: aantal × stukprijs', 'Gift', 'Totaal (gecontroleerd)'], result.orders.map(order => [order.row, order.student, order.group, order.items.filter(i => i.count).map(i => `${PRODUCTS.find(p => p.key === i.key).label}: ${i.count} × ${euro(i.price)}`).join('; '), euro(order.gift), euro(order.total)]));
}
$('confirm').onchange = () => {
  $('reports').hidden = !$('confirm').checked || !!result.errors.length;
  if ($('reports').hidden) return;
  $('settings').innerHTML = `<table><thead><tr><th>Product</th><th>Inkoop per stuk / klein doosje (€)</th><th>Stuks per grote doos</th></tr></thead><tbody>${PRODUCTS.map(p => `<tr><td>${escape(p.label)}</td><td><input aria-label="Inkoop ${escape(p.label)}" data-key="${p.key}" data-field="cost" inputmode="decimal" placeholder="Nog invullen" value="${settings[p.key]?.cost == null ? '' : (settings[p.key].cost / 100).toFixed(2)}"></td><td><input aria-label="Doosinhoud ${escape(p.label)}" data-key="${p.key}" data-field="pack" type="number" min="1" step="1" value="${settings[p.key]?.pack ?? p.pack}" ${p.supplier === 'Kerstrozen' ? 'disabled' : ''}></td></tr>`).join('')}</tbody></table>`;
  const groups = [...new Set([...result.orders.map(o => o.group), 'AKB'])].sort((a,b) => a.localeCompare(b, 'nl', {numeric:true}));
  $('group').replaceChildren(...groups.map(group => new Option(group, group)));
  refresh(); renderClass();
};
$('settings').addEventListener('input', refresh);
$('fees').addEventListener('input', refresh);
$('transport').addEventListener('input', refresh);
function refresh() {
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
    summary = summarize(result.orders, settings);
    costs = {};
    for (const id of ['fees', 'transport']) {
      try { costs[id] = $(id).value.trim() === '' ? null : money($(id).value); }
      catch { throw Error(`Controleer ${id === 'fees' ? 'betaal- en overige kosten' : 'transportkosten'}.`); }
    }
    $('metrics').innerHTML = [['Bestellingen', result.orders.length], ['Omzet volgens Excel', euro(summary.revenue)], ['Waarvan giften', euro(summary.gifts)], ['Verkochte stuks', summary.products.reduce((s,p) => s + p.sold, 0)]].map(([label, value]) => `<div class="metric">${escape(label)}<strong>${escape(value)}</strong></div>`).join('');
    const profit = profitValue();
    $('profit').textContent = profit == null ? 'Winst nog niet volledig: vul de ontbrekende inkoopprijzen en beide kostenvelden in (ook wanneer ze 0 zijn).' : `Berekende winst: ${euro(profit)} = omzet ${euro(summary.revenue)} − inkoop volledige bestelling ${euro(summary.cost)} − overige kosten ${euro(costs.fees)} − transport ${euro(costs.transport)}. Op basis van alle bestellingen in deze export.`;
    $('suppliers').innerHTML = ['Kerstrozen', 'Truffels'].map(supplier => `<h3>${supplier}</h3>${table(supplierHeaders, supplierRows(supplier))}`).join('');
    document.querySelectorAll('[data-pdf]').forEach(button => button.disabled = button.dataset.pdf === 'winst' && profit == null);
  } catch (error) {
    summary = null;
    $('profit').textContent = error.message;
    $('suppliers').replaceChildren();
    document.querySelectorAll('[data-pdf]').forEach(button => button.disabled = true);
  }
}
function profitValue() { return summary?.cost == null || costs.fees == null || costs.transport == null ? null : summary.revenue - summary.cost - costs.fees - costs.transport; }
const supplierHeaders = ['Product', 'Verkocht', 'Stuks/doos', 'Grote dozen', 'Bestellen (stuks)', 'Overschot', 'Inkoop/stuk', 'Inkooptotaal'];
function supplierRows(supplier) { return summary.products.filter(p => p.supplier === supplier).map(p => [p.label, p.sold, p.pack, supplier === 'Truffels' ? p.boxes : '—', p.ordered, p.surplus, euro(p.unitCost), euro(p.cost)]); }
function classData(group) {
  const orders = result.orders.filter(o => o.group === group).sort((a,b) => a.student.localeCompare(b.student, 'nl') || a.row - b.row);
  const active = PRODUCTS.filter(p => orders.some(o => o.items.some(i => i.key === p.key && i.count)));
  const headers = ['Excelrij', 'Leerling', 'Koper', ...active.map(p => p.label), 'Meegegeven'];
  const rows = orders.map(o => [o.row, o.student || '(naam ontbreekt)', o.buyer, ...active.map(p => o.items.find(i => i.key === p.key)?.count || '—'), '[  ]']);
  if (orders.length) rows.push(['', 'TOTAAL', '', ...active.map(p => orders.reduce((sum,o) => sum + (o.items.find(i => i.key === p.key)?.count || 0), 0)), '']);
  return { headers, rows };
}
function renderClass() { const data = classData($('group').value); $('classList').innerHTML = data.rows.length ? table(data.headers, data.rows) : '<p>Geen bestellingen voor deze groep in dit bestand.</p>'; $('classPdf').disabled = !data.rows.length; }
$('group').onchange = renderClass;
// One table renderer for all PDFs: wraps text, repeats headers and paginates.
function pdfReport(sections, name) {
  try {
    if (!window.jspdf) throw Error('De PDFbibliotheek kon niet worden geladen.');
    const pdf = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const width = 277, left = 10, bottom = 190;
    let y;
    const text = value => String(value).replace(/€/g, 'EUR').replace(/—/g, '-');
    sections.forEach((section, sectionIndex) => {
      const weights = section.headers.map((_,i) => i === 0 ? 2 : 1);
      if (section.classroom) { weights[0] = .65; weights[1] = 1.8; weights[2] = 1.8; }
      const cols = weights.map(w => width * w / weights.reduce((a,b) => a+b,0));
      function row(cells, heading = false) {
        pdf.setFont('helvetica', heading ? 'bold' : 'normal'); pdf.setFontSize(8);
        const lines = cells.map((cell,i) => pdf.splitTextToSize(text(cell), cols[i] - 4));
        const height = Math.max(...lines.map(l => l.length), 1) * 3.7 + 5;
        if (y + height > bottom && !heading) { pdf.addPage(); pageHeader(); pdf.setFont('helvetica','normal'); }
        let x = left;
        cells.forEach((_,i) => { pdf.setFillColor(heading ? 228 : 250, heading ? 238 : 251, heading ? 232 : 250); pdf.rect(x,y,cols[i],height,'F'); pdf.setTextColor(25,55,47); pdf.text(lines[i],x+2,y+4); x += cols[i]; });
        y += height + .5;
      }
      function pageHeader() {
        pdf.setTextColor(25,55,47); pdf.setFont('helvetica','bold'); pdf.setFontSize(16); pdf.text(text(section.title),left,15);
        pdf.setFont('helvetica','normal'); pdf.setFontSize(8);
        const notes = pdf.splitTextToSize(text(`De Linde | ${filename} | ${$('sheet').value}\n${section.note || ''}`),width);
        pdf.text(notes,left,22); y = 25 + notes.length * 3.5;
        row(section.headers,true);
      }
      if (sectionIndex) pdf.addPage();
      pageHeader(); section.rows.forEach(cells => row(cells));
    });
    for (let page = 1; page <= pdf.getNumberOfPages(); page++) { pdf.setPage(page); pdf.setFontSize(8); pdf.text(`${page} / ${pdf.getNumberOfPages()}`, 280, 202, {align:'right'}); }
    pdf.save(name);
  } catch (error) { $('status').textContent = `PDF maken mislukt: ${error.message}`; }
}
document.querySelectorAll('[data-pdf]').forEach(button => button.onclick = () => {
  if (!summary) return;
  const supplier = button.dataset.pdf;
  if (supplier === 'winst') {
    const profit = profitValue(); if (profit == null) return;
    pdfReport([{ title:'Winstberekening schoolverkoop', note:`Alle bestellingen uit Excel, betaalstatus onbekend. Inkoop inclusief overschot. Omzet ${euro(summary.revenue)} (waarvan gift ${euro(summary.gifts)}). Inkoop ${euro(summary.cost)}. Overige kosten ${euro(costs.fees)}. Transport ${euro(costs.transport)}. Berekende winst ${euro(profit)}.`, headers:['Product','Verkocht','Besteld','Omzet','Inkoop','Marge voor overige kosten'], rows:summary.products.map(p => [p.label,p.sold,p.ordered,euro(p.revenue),euro(p.cost),euro(p.revenue-p.cost)]) }], 'winstberekening.pdf');
  } else {
    const products = summary.products.filter(p => p.supplier === supplier);
    const total = products.some(p => p.cost == null) ? null : products.reduce((sum,p) => sum+p.cost,0);
    pdfReport([{title:`Bestelling leverancier - ${supplier}`, note:`Bestellen = aantal te leveren stuks, inclusief afronding naar volle dozen per soort. Inkooptotaal: ${euro(total)}.`, headers:supplierHeaders, rows:supplierRows(supplier)}], `leverancier_${supplier.toLowerCase()}.pdf`);
  }
});
function classSection(group) { return { title:`Uitdeellijst - ${group}`, classroom:true, note:'Aantallen per bestelling. Vink af bij het meegeven.', ...classData(group) }; }
$('classPdf').onclick = () => pdfReport([classSection($('group').value)], `klas_${$('group').value.replace(/[^a-z0-9]/gi,'_')}.pdf`);
$('allClassesPdf').onclick = () => pdfReport([...$('group').options].map(o => classSection(o.value)).map(section => section.rows.length ? section : {...section, rows:[section.headers.map((_,i) => i === 1 ? 'Geen bestellingen' : '')]}), 'alle_klassen_en_AKB.pdf');
