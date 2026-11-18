import test from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCTS, readOrders, summarize, money, quantity } from './excel-import.mjs';

function fixture() {
  const headers = ['Naam: Voornaam','Naam: Achternaam','Naam van de leerling','Klas van de leerling','Gift','Ander bedrag:','Totaal', ...PRODUCTS.flatMap(p => [`${p.source}: Waarde`,`${p.source}: Hoeveelheid`])];
  const row = ['Test','Koper','Test leerling','L1','','','0,00 €',...PRODUCTS.flatMap(p => [p.pack === 1 ? '4,00 €' : p.pack === 12 ? '6,00 €' : '12,00 €',0])];
  const set = (label,value) => { row[headers.indexOf(label)] = value; };
  return {headers,row,set};
}
test('prices are never counted as quantities; reordered columns still match by header', () => {
  const f = fixture(); f.set(`${PRODUCTS[0].source}: Hoeveelheid`, 2); f.set('Totaal','8,00 €');
  const r = readOrders([f.headers.toReversed(),f.row.toReversed()]);
  assert.deepEqual(r.errors,[]); assert.equal(r.orders[0].items.reduce((s,i) => s+i.count,0),2);
  assert.equal(r.orders[0].total,800);
});
test('zero and missing quantities do not inherit a price', () => {
  const f=fixture(); f.set(`${PRODUCTS[0].source}: Hoeveelheid`,'');
  const r=readOrders([f.headers,f.row]); assert.deepEqual(r.errors,[]);
  assert.equal(summarize(r.orders).products.reduce((sum,p) => sum+p.sold,0),0);
});
test('euro money parser rejects invalid values and handles Dutch and numeric values', () => {
  assert.equal(money('1.234,56 €'),123456); assert.equal(money(4.5),450); assert.equal(money('4.50'),450);
  assert.equal(money('1.234 €'),123400);
  for (const v of ['','onbekend','-2',NaN,'4abc', '1,234', 'Infinity']) assert.throws(() => money(v));
  for (const v of [-1,1.5,'€ 4',NaN]) assert.throws(() => quantity(v));
});
test('gifts counted once and totals reconcile exactly in cents', () => {
  const f=fixture(); f.set('Gift','€ 5 - 5,00 €'); f.set('Totaal','5,00 €');
  let r=readOrders([f.headers,f.row]); assert.deepEqual(r.errors,[]); assert.equal(r.orders[0].gift,500);
  f.set('Gift','Ander bedrag'); f.set('Ander bedrag:','7,25 €'); f.set('Totaal','7,25 €');
  r=readOrders([f.headers,f.row]); assert.deepEqual(r.errors,[]); assert.equal(r.orders[0].gift,725);
  f.set('Gift','€ 5 - 5,00 €'); assert.match(readOrders([f.headers,f.row]).errors[0],/Zowel Gift/);
});
test('bad totals, missing and duplicate headers, unknown products block import', () => {
  const f=fixture(); f.set('Totaal','12,00 €'); assert.match(readOrders([f.headers,f.row]).errors[0],/Totaal wijkt af/);
  assert.ok(readOrders([f.headers.slice(1),f.row.slice(1)]).errors.length);
  assert.ok(readOrders([[...f.headers,'Totaal'],f.row]).errors.length);
  assert.ok(readOrders([[...f.headers,'Nieuw product: Hoeveelheid'],f.row]).errors.length);
});
test('full boxes rounded per flavour, zero sales cost zero and missing costs stay unknown', () => {
  const f=fixture(); f.set(`${PRODUCTS[3].source}: Hoeveelheid`,13); f.set(`${PRODUCTS[4].source}: Hoeveelheid`,1); f.set('Totaal','84,00 €');
  const r=readOrders([f.headers,f.row]); assert.deepEqual(r.errors,[]);
  let summary=summarize(r.orders); assert.equal(summary.cost,null); assert.equal(summary.products[0].cost,0);
  assert.equal(summary.products[3].boxes,2); assert.equal(summary.products[3].ordered,24); assert.equal(summary.products[3].surplus,11);
  assert.equal(summary.products[4].ordered,12);
  summary=summarize(r.orders,{[PRODUCTS[3].key]:{cost:200},[PRODUCTS[4].key]:{cost:200}});
  assert.equal(summary.cost,7200); assert.equal(summary.revenue,8400);
});
test('AKB normalized, duplicate rows warned but not silently removed, blank rows ignored', () => {
  const f=fixture(); f.set('Klas van de leerling','Atheneum Klein-Brabant');
  const r=readOrders([f.headers,f.row,[],f.row]); assert.deepEqual(r.errors,[]); assert.equal(r.orders.length,2); assert.equal(r.orders[0].group,'AKB'); assert.equal(r.warnings.length,1); assert.equal(r.orders[1].row,4);
});
