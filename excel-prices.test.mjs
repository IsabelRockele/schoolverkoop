import test from 'node:test';
import assert from 'node:assert/strict';
import { decodePrices, encodePrices, cachedPrices, cachePrices, actionId } from './excel-prices.mjs';
const storage = () => { const map = new Map(); return {getItem:key => map.get(key) ?? null, setItem:(key,value) => map.set(key,value)}; };
test('existing euro prices convert to cents, missing prices remain unknown', () => {
  const data = decodePrices({inkoopprijzen:{kerstrozen_wit:2.35,truffels_250_wit:0},mollieKost:.39,transportKost:15});
  assert.equal(data.settings.kerstrozen_wit.cost,235);
  assert.equal(data.settings.truffels_250_wit.cost,0);
  assert.equal(data.settings.kerstrozen_rood.cost,null);
  assert.equal(data.fees,''); // Old per-order fee must never become a total fee.
  assert.equal(data.transport,'15.00');
  assert.equal(data.mollieMode,'total');
  assert.equal(data.mollieTotal,''); // Do not reuse the old per-payment rate as an invoice.
});
test('Mollie invoice survives saving; legacy combined cost is not counted twice', () => {
  const settings=decodePrices({}).settings;
  const encoded=encodePrices(settings,{fees:0,transport:0,mollieSettings:{mode:'total',total:2530}});
  assert.equal(decodePrices(encoded).mollieTotal,'25.30');
  assert.equal(decodePrices(encoded).mollieMode,'total');
  assert.equal(decodePrices({excelKosten:{fees:25.30}}).mollieMode,'included');
});
test('legacy prices load for matching year only and saved years stay separate', () => {
  const s = storage(); s.setItem('winst_kerstverkoop_2026_inkoopprijzen',JSON.stringify({kerstrozen_wit:2.35}));
  assert.equal(cachedPrices(s,2026).data.inkoopprijzen.kerstrozen_wit,2.35);
  assert.deepEqual(cachedPrices(s,2027).data,{});
  cachePrices(s,2027,{inkoopprijzen:{kerstrozen_wit:3}});
  assert.equal(cachedPrices(s,2026).data.inkoopprijzen.kerstrozen_wit,2.35);
  assert.equal(cachedPrices(s,2027).data.inkoopprijzen.kerstrozen_wit,3);
});
test('round trip preserves zero, unknown prices, packaging and costs', () => {
  const decoded=decodePrices({inkoopprijzen:{kerstrozen_wit:0},excelVerpakking:{truffels_250_wit:24},excelKosten:{fees:0,transport:null}});
  const encoded=encodePrices(decoded.settings,{fees:0,transport:null});
  assert.equal(encoded.inkoopprijzen.kerstrozen_wit,0);
  assert.equal(encoded.inkoopprijzen.kerstrozen_rood,null);
  assert.equal(encoded.excelVerpakking.truffels_250_wit,24);
  assert.equal(encoded.excelKosten.fees,0);
  assert.equal(decodePrices(encoded).transport,'');
});
test('invalid year, prices and packaging are rejected', () => {
  for (const value of ['../2026','2026.5','',2019,2101]) assert.throws(() => actionId(value));
  assert.throws(() => decodePrices({inkoopprijzen:{kerstrozen_wit:-1}}));
  assert.throws(() => decodePrices({excelVerpakking:{truffels_250_wit:0}}));
});
