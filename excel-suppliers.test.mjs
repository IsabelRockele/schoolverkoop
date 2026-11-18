import test from 'node:test';
import assert from 'node:assert/strict';
import { supplierSections, supplierTotal, supplierTotalRow } from './excel-suppliers.mjs';
test('supplier splits weights and totals the full ordered quantities', () => {
  const products=[{supplier:'Truffels',key:'truffels_250_melk',sold:13,boxes:2,ordered:24,surplus:11,pack:12,cost:4800},
    {supplier:'Truffels',key:'truffels_500_wit',sold:1,boxes:1,ordered:8,surplus:7,pack:8,cost:3200}];
  const sections=supplierSections({products},'Truffels');
  assert.deepEqual(sections.map(s => s.title),['Truffels 250 g','Truffels 500 g']);
  assert.match(sections[0].note,/12 doosjes/);assert.match(sections[1].note,/8 doosjes/);
  assert.deepEqual(supplierTotal(products),{sold:14,boxes:3,ordered:32,surplus:18,cost:8000});
});
test('missing price never yields a misleading complete supplier total', () => {
  const section={total:supplierTotal([{sold:1,boxes:1,ordered:12,surplus:11,cost:null}])};
  assert.equal(section.total.cost,null);
  assert.equal(supplierTotalRow(section,'Truffels').at(-1),'Niet volledig');
});
test('different packs remain explicit and no orders has zero invoice', () => {
  const products=[{supplier:'Truffels',key:'truffels_250_melk',sold:1,boxes:1,ordered:12,surplus:11,pack:12,cost:0},
    {supplier:'Truffels',key:'truffels_250_wit',sold:1,boxes:1,ordered:24,surplus:23,pack:24,cost:0}];
  const sections=supplierSections({products},'Truffels');
  assert.match(sections[0].note,/melk: 12/);assert.match(sections[0].note,/wit: 24/);
  assert.equal(sections[1].total.cost,0);
});
