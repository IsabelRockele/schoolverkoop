import test from 'node:test';
import assert from 'node:assert/strict';
import {workbookStore} from './excel-workbook-store.mjs';
function setup(){
  const docs=new Map();let failPut=false;
  const store=workbookStore({get:async id=>docs.get(id)||null,put:async(id,data)=>{if(failPut)throw Error('offline');docs.set(id,data);},remove:async ids=>ids.forEach(id=>docs.delete(id)),swap:async(id,meta)=>{const old=docs.get(id);docs.set(id,meta);return old;}});
  return {store,docs,fail:()=>{failPut=true;}};
}
const file=(length,name='orders.xlsx')=>({bytes:new Uint8Array(length).fill(77),name,sheet:'Bestellingen',year:'2026'});
test('save/load preserves original bytes and replacement removes previous parts',async()=>{
  const {store,docs}=setup();await store.save(file(600000));
  assert.equal(docs.size,3);assert.deepEqual((await store.load()).bytes,file(600000).bytes);
  await store.save(file(120,'nieuw.xlsx'));assert.equal(docs.size,2);
  const loaded=await store.load();assert.equal(loaded.name,'nieuw.xlsx');assert.equal(loaded.bytes.length,120);
});
test('failed upload preserves previous confirmed workbook',async()=>{
  const {store,fail}=setup();await store.save(file(100));fail();
  await assert.rejects(store.save(file(200,'nieuw.xlsx')),/offline/);
  assert.equal((await store.load()).name,'orders.xlsx');
});
test('bad bytes are rejected by integrity check',async()=>{
  const {store,docs}=setup();await store.save(file(100));
  for(const value of docs.values())if(value instanceof Uint8Array)value[0]=0;
  await assert.rejects(store.load(),/betrouwbaar/);
});
test('invalid file cannot replace the stored export',async()=>{
  const {store}=setup();await store.save(file(100));
  await assert.rejects(store.save(file(0)),/Ongeldig/);
  assert.equal((await store.load()).bytes.length,100);
});
