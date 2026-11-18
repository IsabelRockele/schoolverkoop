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
