import test from 'node:test';
import assert from 'node:assert/strict';
import { studentsFor, deliveryTotals } from './excel-distribution.mjs';
const order = (row,student,group,count=1) => ({row,student,group,buyer:'Niet op leveringsblad',items:[{key:'kerstrozen_rood',count},{key:'truffels_250_melk',count:2}]});
test('same pupil in same class combines orders without removing any quantities', () => {
  const students=studentsFor([order(2,'Anna','L1',2),order(3,' anna  ','L1',3),order(4,'Anna','L2',7)],'L1');
  assert.equal(students.length,1); assert.equal(students[0].counts.kerstrozen_rood,5);
  assert.equal(students[0].counts.truffels_250_melk,4); assert.equal(students[0].total,9);
  assert.equal(students[0].orderCount,2); assert.equal('buyer' in students[0],false);
  assert.deepEqual(deliveryTotals(students).groups,[5,4,0]);
});
test('different spellings and unnamed pupils remain separate; classes remain separate', () => {
  const students=studentsFor([order(2,'Anna','K1'),order(3,'Ana','K1'),order(4,'','K1'),order(5,'','K1'),order(6,'Anna','K2')]);
  assert.equal(students.length,5); assert.equal(deliveryTotals(students).total,15);
});
test('empty class has zero totals for all nine variants', () => {
  const students=studentsFor([order(2,'Anna','K1')],'AKB');
  assert.deepEqual(students,[]); const totals=deliveryTotals(students);
  assert.equal(Object.keys(totals.counts).length,9); assert.equal(totals.total,0);
});
test('reversed full name combines buyers in one pupil, within the same class only', () => {
  const rows=[order(2,'Symons Yliana','L3'),order(3,'Yliana symons','L3'),order(4,'Yliana Symons','L4'),order(5,'Yliana Simons','L3')];
  const students=studentsFor(rows,'L3');
  assert.equal(students.length,2);
  const combined=students.find(s=>s.orderCount===2);
  assert.ok(combined);assert.equal(combined.total,6);
  assert.deepEqual(combined.orders.map(o=>o.row),[2,3]);
  assert.equal(studentsFor(rows,'L4').length,1);
});
test('explicit spelling correction combines delivery sheets without changing original names', () => {
  const rows=[order(2,'Voorbeeld Anna','L3'),order(3,'Anna Voorbeel','L3')];
  rows[1].deliveryStudent='Voorbeeld Anna';
  const students=studentsFor(rows,'L3');assert.equal(students.length,1);
  assert.equal(students[0].total,6);assert.equal(rows[1].student,'Anna Voorbeel');
});
