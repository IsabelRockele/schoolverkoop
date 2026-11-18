import test from 'node:test';
import assert from 'node:assert/strict';
import { profitDetails } from './excel-profit.mjs';
const summary={revenue:10000,products:[{label:'Kerstroos wit',sold:10,cost:2000},{label:'Truffels 250 g melk',sold:3,cost:1000}]};
test('missing transport produces a provisional profit with an explicit exclusion', () => {
  const result=profitDetails(summary,{fees:100,transport:null});
  assert.equal(result.value,6900); assert.equal(result.suffix,' (zonder transportkosten)');
  assert.equal(result.provisional,true);
});
test('explicit zero means known zero, while missing cost categories are listed', () => {
  assert.equal(profitDetails(summary,{fees:0,transport:0}).suffix,'');
  assert.deepEqual(profitDetails(summary,{fees:null,transport:null}).excluded,['betaal- en overige kosten','transportkosten']);
});
test('unknown purchase costs are excluded explicitly and zero-sales products need no price', () => {
  const result=profitDetails({revenue:10000,products:[{label:'Kerstroos wit',sold:1,cost:null},{label:'Niet verkocht',sold:0,cost:0},{label:'Truffels',sold:3,cost:1000}]},{fees:0,transport:0});
  assert.equal(result.value,9000); assert.equal(result.knownCost,1000);
  assert.deepEqual(result.excluded,['inkoop Kerstroos wit']);
});
