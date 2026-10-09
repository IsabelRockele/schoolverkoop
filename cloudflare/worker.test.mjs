import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker, {prepare} from './worker.mjs';
const order={leerling:'Test leerling',klas:'2A',naamKoper:'Test koper',emailKoper:'test@example.com',producten:[{naam:'Kerstrozen',variant:'wit',aantal:2,prijs:0.01}],sponsorBedrag:5};
test('server prices, quantities, email and sale dates',()=>{
 assert.equal(prepare(order,{verkoopprijzen:{kerstrozen:7}}).total,1900);
 assert.throws(()=>prepare({...order,producten:[{...order.producten[0],aantal:-1}]},{}));
 assert.throws(()=>prepare(order,{eindOp:'2020-01-01'}));
 assert.throws(()=>prepare(order,{startOp:'2099-01-01'}));
 assert.throws(()=>prepare({...order,emailKoper:'fout'},{}));
});
test('live key refused',async()=>{
 const r=await worker.fetch(new Request('https://test.workers.dev/status',{method:'POST',body:JSON.stringify({id:'tr_test',token:'x'})}),{MOLLIE_TEST_API_KEY:'live_forbidden'});
 assert.equal(r.status,400); assert.match((await r.json()).error,/Live/);
});
test('checkout, verified status, webhook and duplicate handling',async()=>{
 const originalFetch=globalThis.fetch;
 const env={MOLLIE_TEST_API_KEY:'test_example'};
 let payment,writes=0;const stored=new Set();
 globalThis.fetch=async(url,options={})=>{
  if(url.endsWith('/publieke_instellingen/kerstverkoop_2026'))return Response.json({fields:{}});
  if(url==='https://api.mollie.com/v2/payments'){
   payment={...JSON.parse(options.body),id:'tr_abc123',mode:'test',status:'open',_links:{checkout:{href:'https://www.mollie.com/checkout/test'}}};return Response.json(payment);
  }
  if(url==='https://api.mollie.com/v2/payments/tr_abc123')return Response.json(payment);
  if(url.includes('/bestellingen_test?')){
   if(stored.has(url))return new Response('',{status:409});
   stored.add(url);writes++;
   const data=JSON.parse(options.body).fields;
   assert.equal(data.totaal.doubleValue,13);assert.equal(data.status.stringValue,'test');return Response.json({});
  }
  throw new Error(`Unexpected URL ${url}`);
 };
 const call=async(path,body)=>worker.fetch(new Request(`https://test.workers.dev/${path}`,{method:'POST',headers:{Origin:'https://isabelrockele.github.io'},body:JSON.stringify(body)}),env);
 try{
  const r=await call('checkout',{...order,requestId:crypto.randomUUID()});assert.equal(r.status,200);const p=await r.json();
  assert.equal((await(await call('status',p)).json()).saved,false);assert.equal(writes,0);
  payment.status='canceled';assert.equal((await(await call('status',p)).json()).saved,false);
  payment.status='paid';assert.equal((await call('status',{...p,token:'wrong'})).status,400);assert.equal(writes,0);
  assert.equal((await(await call('status',p)).json()).saved,true);
  assert.equal((await(await call('status',p)).json()).saved,true);assert.equal(writes,1);
  const hook=await worker.fetch(new Request('https://test.workers.dev/webhook',{method:'POST',body:'id=tr_abc123'}),env);assert.equal(hook.status,200);assert.equal(writes,1);
  payment.amount.value='0.01';assert.equal((await call('status',p)).status,400);
 }finally{globalThis.fetch=originalFetch;}
});
