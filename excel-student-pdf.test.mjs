import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { buyersFor, createStudentPdf } from './excel-student-pdf.mjs';
const {jsPDF}=createRequire(import.meta.url)('./vendor/jspdf.umd.min.js');
const student=(name,count) => ({name,group:'L3',total:count*3,orders:Array.from({length:count},(_,i)=>({row:i+2,buyer:`Testkoper ${i+1}`,gift:0,total:1800,items:[{key:'kerstrozen_wit',count:1,price:600},{key:'truffels_250_melk',count:2,price:600}]}))});
const save=(pdf,name) => {if(process.env.PDF_QA_DIR){mkdirSync(process.env.PDF_QA_DIR,{recursive:true});writeFileSync(join(process.env.PDF_QA_DIR,name),Buffer.from(pdf.output('arraybuffer')));}};
test('three buyers share a pupil page; next pupil starts a fresh page',()=>{
  const pdf=createStudentPdf([student('Anna Voorbeeld',3),student('Bram Voorbeeld',1)],2026,jsPDF);
  assert.equal(pdf.getNumberOfPages(),2);
  const first=pdf.internal.pages[1].join('\n'),second=pdf.internal.pages[2].join('\n');
  for(const text of ['Anna Voorbeeld','Koper 1: Testkoper 1','Koper 2: Testkoper 2','Koper 3: Testkoper 3']) assert.ok(first.includes(text),text);
  assert.ok(!first.includes('Bram Voorbeeld'));assert.ok(second.includes('Bram Voorbeeld'));
  assert.doesNotMatch(pdf.output(),/Meegegeven op|Gecontroleerd/);
  save(pdf,'leerlingen-meerdere-kopers.pdf');
});
test('many buyers continue with pupil identity and per-pupil page count',()=>{
  const pdf=createStudentPdf([student('Anna Veelkopers',18)],2026,jsPDF);
  assert.ok(pdf.getNumberOfPages()>1);
  for(let i=1;i<=pdf.getNumberOfPages();i++){
    const page=pdf.internal.pages[i].join('\n');
    assert.ok(page.includes('Anna Veelkopers'));assert.ok(page.includes('Klas: L3'));
    assert.ok(page.includes(`Blad ${i} van ${pdf.getNumberOfPages()} voor deze leerling`));
  }
  const raw=pdf.output();
  for(let i=1;i<=18;i++) assert.equal(raw.split(`Koper ${i}: Testkoper ${i})`).length-1,1);
  save(pdf,'leerling-veel-kopers.pdf');
});
test('repeated buyer combines quantities but preserves different unit prices',()=>{
  const pupil=student('Anna',3);pupil.orders[1].buyer=' testkoper 1 ';pupil.orders[1].items[0].price=700;
  const buyers=buyersFor(pupil);assert.equal(buyers.length,2);
  assert.equal(buyers[0].count,6);assert.equal(buyers[0].items.length,3);
  assert.equal(buyers[0].items.find(i=>i.key==='truffels_250_melk').count,4);
});
