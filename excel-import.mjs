// WPForms exports contain UNIT prices in : Waarde, including for zero quantities.
export const PRODUCTS = [
  ...['wit', 'rood', 'roze'].map(color => ({ key: `kerstrozen_${color}`, label: `Kerstroos ${color}`, source: `Kerstroos - ${color}`, supplier: 'Kerstrozen', pack: 1 })),
  ...[250, 500].flatMap(size => [['zwarte chocolade', 'donker'], ['witte chocolade', 'wit'], ['melkchocolade', 'melk']].map(([name, key]) => ({ key: `truffels_${size}_${key}`, label: `Truffels ${size} g ${key}`, source: `Truffels ${name} - ${size}gr`, supplier: 'Truffels', pack: size === 250 ? 12 : 8 })))
];
const normalize = value => String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
const empty = value => value == null || String(value).trim() === '';
export function money(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0 || Math.abs(value * 100 - Math.round(value * 100)) > 0.00001) throw Error('Ongeldig bedrag');
    return Math.round(value * 100);
  }
  const s = String(value ?? '').replace(/€/g, '').replace(/\s/g, '');
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(s) && !/^\d+\.\d{1,2}$/.test(s)) throw Error('Ongeldig bedrag');
  const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : /^\d{1,3}(?:\.\d{3})+$/.test(s) ? s.replace(/\./g, '') : s);
  if (!Number.isFinite(n) || !Number.isSafeInteger(Math.round(n * 100))) throw Error('Ongeldig bedrag');
  return Math.round(n * 100);
}
export function quantity(value) {
  if (empty(value)) return 0;
  if (!/^\d+$/.test(String(value).trim())) throw Error('Aantal moet een geheel getal van nul of meer zijn');
  const n = Number(value);
  if (!Number.isSafeInteger(n)) throw Error('Aantal is te groot');
  return n;
}
export function columnName(index) {
  let result = '';
  for (let n = index + 1; n; n = Math.floor((n - 1) / 26)) result = String.fromCharCode(65 + (n - 1) % 26) + result;
  return result;
}
export function readOrders(rows) {
  const errors = [], warnings = [], orders = [], mapping = [];
  const headers = (rows[0] || []).map(normalize);
  const index = label => {
    const matches = headers.flatMap((header, i) => header === normalize(label) ? [i] : []);
    if (matches.length !== 1) errors.push(`Kolom ‘${label}’ ${matches.length ? 'komt meermaals voor' : 'ontbreekt'}.`);
    return matches[0];
  };
  const fields = Object.fromEntries(['Naam: Voornaam', 'Naam: Achternaam', 'Naam van de leerling', 'Klas van de leerling', 'Gift', 'Ander bedrag:', 'Totaal'].map(label => [label, index(label)]));
  PRODUCTS.forEach(product => mapping.push({ ...product, priceColumn: index(`${product.source}: Waarde`), quantityColumn: index(`${product.source}: Hoeveelheid`) }));
  headers.forEach(header => {
    if (/:( waarde| hoeveelheid)$/.test(header) && !mapping.some(p => [normalize(`${p.source}: Waarde`), normalize(`${p.source}: Hoeveelheid`)].includes(header))) errors.push(`Onbekende productkolom ‘${header}’. Werk de productkoppeling bij.`);
  });
  if (errors.length) return { errors, warnings, orders, mapping };
  const signatures = new Map();
  rows.slice(1).forEach((row, i) => {
    const rowNumber = i + 2;
    if (!row.some(v => !empty(v))) return;
    const value = name => row[fields[name]];
    try {
      const items = mapping.map(p => {
        let count, price;
        try { count = quantity(row[p.quantityColumn]); } catch (e) { throw Error(`${columnName(p.quantityColumn)} (${p.label}, aantal): ${e.message}`); }
        try { price = empty(row[p.priceColumn]) && count === 0 ? 0 : money(row[p.priceColumn]); } catch (e) { throw Error(`${columnName(p.priceColumn)} (${p.label}, stukprijs): ${e.message}`); }
        return { key: p.key, count, price, revenue: count * price };
      });
      const giftText = String(value('Gift') ?? '').trim();
      const other = value('Ander bedrag:');
      let gift = 0;
      if (/ander/i.test(giftText)) {
        if (empty(other)) throw Error('Ander giftbedrag ontbreekt');
        gift = money(other);
      } else {
        if (giftText) {
          const match = giftText.match(/(?:^| - )([\d.,]+\s*€?)\s*$/);
          if (!match) throw Error('Gift niet herkenbaar');
          gift = money(match[1]);
        }
        if (!empty(other) && money(other) !== 0) {
          if (gift !== 0) throw Error('Zowel Gift als Ander bedrag ingevuld; controleer welke gift geldt');
          gift = money(other);
        }
      }
      const total = money(value('Totaal'));
      const calculated = items.reduce((sum, item) => sum + item.revenue, gift);
      if (total !== calculated) throw Error(`Totaal wijkt af: Excel € ${(total / 100).toFixed(2)}, berekend € ${(calculated / 100).toFixed(2)} (prijs × aantal + gift)`);
      const rawClass = String(value('Klas van de leerling') ?? '').trim();
      const group = /^(akb|atheneum klein[- ]brabant)$/i.test(rawClass) ? 'AKB' : rawClass || 'Klas ontbreekt';
      const student = String(value('Naam van de leerling') ?? '').trim();
      const buyer = [value('Naam: Voornaam'), value('Naam: Achternaam')].filter(Boolean).join(' ');
      if (!rawClass || !student) warnings.push(`Rij ${rowNumber}: ${!rawClass ? 'klas' : 'leerlingnaam'} ontbreekt. Controleer de uitdeellijst.`);
      const signature = JSON.stringify(row);
      if (signatures.has(signature)) warnings.push(`Rijen ${signatures.get(signature)} en ${rowNumber} zijn identiek. Beide tellen mee; controleer op dubbele bestellingen.`);
      signatures.set(signature, rowNumber);
      orders.push({ row: rowNumber, student, buyer, group, items, gift, total });
    } catch (error) { errors.push(`Rij ${rowNumber}: ${error.message}.`); }
  });
  if (!orders.length && !errors.length) errors.push('Geen bestellingen gevonden.');
  return { errors, warnings, orders, mapping };
}
export function summarize(orders, settings = {}) {
  const products = PRODUCTS.map(product => {
    const items = orders.flatMap(order => order.items.filter(item => item.key === product.key));
    const sold = items.reduce((sum, item) => sum + item.count, 0);
    const pack = settings[product.key]?.pack ?? product.pack;
    if (!Number.isSafeInteger(pack) || pack < 1) throw Error(`${product.label}: ongeldige doosinhoud`);
    const boxes = Math.ceil(sold / pack), ordered = boxes * pack;
    const unitCost = settings[product.key]?.cost;
    if (unitCost != null && (!Number.isSafeInteger(unitCost) || unitCost < 0)) throw Error(`${product.label}: ongeldige inkoopprijs`);
    return { ...product, pack, sold, boxes, ordered, surplus: ordered - sold, revenue: items.reduce((sum, item) => sum + item.revenue, 0), unitCost, cost: sold === 0 ? 0 : unitCost == null ? null : ordered * unitCost };
  });
  return { products, revenue: orders.reduce((sum, order) => sum + order.total, 0), gifts: orders.reduce((sum, order) => sum + order.gift, 0), cost: products.some(p => p.cost === null) ? null : products.reduce((sum, p) => sum + p.cost, 0) };
}
