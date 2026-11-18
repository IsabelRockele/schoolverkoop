// Usage: node excel-browser.test.cjs <playwright package> <xlsx fixture> <output directory>
const { chromium } = require(process.argv[2]);
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const http = require('node:http');
(async () => {
  const output = process.argv[4]; fs.mkdirSync(output, { recursive:true });
  const server = http.createServer((req,res) => {
    const name = path.resolve(__dirname, '.' + new URL(req.url,'http://localhost').pathname);
    if (!name.startsWith(__dirname + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(name,(error,data) => {
      if (error) { res.writeHead(404).end(); return; }
      res.setHeader('Content-Type', name.endsWith('.html') ? 'text/html' : name.endsWith('.css') ? 'text/css' : 'text/javascript'); res.end(data);
    });
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const browser = await chromium.launch({channel:'msedge',headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1400,height:1000},acceptDownloads:true});
    await page.route('**/excel-workbook-cloud.mjs',route=>route.fulfill({contentType:'text/javascript',body:`
      export async function loadWorkbook(){const data=localStorage.getItem('test_workbook');return {signedIn:true,file:data ? {...JSON.parse(data),bytes:new Uint8Array(JSON.parse(data).bytes)} : null};}
      export async function saveWorkbook(file){if(localStorage.getItem('test_save_fail'))throw Error('Testverbinding verbroken');const data={...file,bytes:Array.from(new Uint8Array(file.bytes)),savedAt:new Date().toISOString(),cleaned:true};localStorage.setItem('test_workbook',JSON.stringify(data));return {signedIn:true,file:data};}
    `}));
    // Isolated shared-settings adapter: tests must never write production prices.
    await page.route('**/excel-cloud.mjs', route => route.fulfill({contentType:'text/javascript',body:`
      export async function loadPrices(year) {
        const stored=localStorage.getItem('test_cloud_'+year);
        return {signedIn:true,data:stored ? JSON.parse(stored) : year==='2026' ? {inkoopprijzen:{kerstrozen_wit:2.35}} : null};
      }
      export async function savePrices(year,data) { localStorage.setItem('test_cloud_'+year,JSON.stringify(data)); return true; }
    `}));
    const errors=[]; page.on('pageerror',error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/excel.html`);
    await page.waitForFunction(() => document.querySelector('#priceStatus').textContent.includes('geladen uit'));
    await page.waitForFunction(() => document.querySelector('#savedStatus').textContent.includes('nog geen Excel'));
    assert.equal(await page.locator('[data-key="kerstrozen_wit"][data-field="cost"]').inputValue(),'2.35');
    await page.locator('#file').setInputFiles(process.argv[3]);
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('26 gecontroleerde'));
    assert.equal(await page.locator('.error:visible').count(),0);
    assert.match(await page.locator('#issues').innerText(),/19 en 20/);
    await page.locator('#confirm').check();
    await page.waitForFunction(()=>document.querySelector('#savedStatus').textContent.includes('Gedeeld bewaard'));
    await page.reload();
    await page.waitForFunction(()=>document.querySelector('#savedStatus').textContent.includes('Laatste Excel geopend'));
    assert.match(await page.locator('#fileSummary').innerText(),/26 bestellingen/);
    // Invalid uploads never replace the shared copy; it can be reopened immediately.
    await page.locator('[data-tab="bestand"]').click();
    await page.locator('#file').setInputFiles({name:'fout.xlsx',mimeType:'application/octet-stream',buffer:Buffer.from('geen excel')});
    await page.waitForFunction(()=>!document.querySelector('#review').hidden || document.querySelector('#status').textContent.includes('Import mislukt'));
    assert.equal(await page.locator('#reports').isHidden(),true);
    await page.locator('#restoreSaved').click();
    await page.waitForFunction(()=>document.querySelector('#savedStatus').textContent.includes('Laatste Excel geopend'));
    assert.match(await page.locator('#fileSummary').innerText(),/26 bestellingen/);
    assert.equal(await page.locator('[data-panel="bestand"]').isHidden(),true);
    assert.equal(await page.locator('[data-panel="leveranciers"]').isVisible(),true);
    assert.equal(await page.locator('[data-pdf="winst"]').isDisabled(),false);
    assert.match(await page.locator('#profit').innerText(),/Voorlopige winst/);
    assert.match(await page.locator('#profit').innerText(),/Zonder ontbrekende inkoopprijzen/);
    await page.locator('[data-tab="prijzen"]').click();
    for (const input of await page.locator('[data-field="cost"]').all()) await input.fill('2,00');
    await page.locator('[data-tab="winst"]').click();
    await page.locator('#transport').fill('0');
    assert.equal(await page.locator('#metrics > .metric').count(),5);
    assert.equal(await page.locator('[data-panel="winst"] input').count(),2);
    assert.equal(await page.locator('[data-panel="winst"] select').count(),0);
    assert.match(await page.locator('#profit small').innerText(),/26.*10,14/);
    assert.match(await page.locator('#profit strong').innerText(),/432,86/);
    await page.screenshot({path:path.join(output,'winst-desktop.png'),fullPage:true});
    assert.equal(await page.locator('#metrics > .metric').evaluateAll(tiles => new Set(tiles.map(tile => Math.round(tile.getBoundingClientRect().top))).size),1);
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:path.join(output,'winst-mobile.png'),fullPage:true});
    await page.setViewportSize({width:1400,height:1000});
    const estimatedDownload=page.waitForEvent('download');await page.locator('[data-pdf="winst"]').click();
    await (await estimatedDownload).saveAs(path.join(output,'winst-mollieschatting.pdf'));
    await page.locator('#mollieTotal').fill('10,14');
    assert.match(await page.locator('#profit').innerText(),/432,86/);
    assert.doesNotMatch(await page.locator('#profit').innerText(),/geschatte|Voorlopige/);
    await page.locator('#mollieTotal').fill('');
    assert.match(await page.locator('#profit small').innerText(),/geschatte Mollie/);
    await page.locator('#mollieTotal').fill('-1');
    assert.equal(await page.locator('[data-pdf="winst"]').isDisabled(),true);
    assert.equal(await page.locator('#profitError').isVisible(),true);
    await page.locator('#mollieTotal').fill('0'); await page.locator('#transport').fill('');
    assert.match(await page.locator('#profit').innerText(),/443,00/);
    assert.match(await page.locator('#profit small').innerText(),/Zonder transportkosten/);
    const provisionalDownload=page.waitForEvent('download'); await page.locator('[data-pdf="winst"]').click();
    await (await provisionalDownload).saveAs(path.join(output,'winst-voorlopig.pdf'));
    await page.locator('#transport').fill('0');
    assert.doesNotMatch(await page.locator('#profit').innerText(),/Voorlopige|zonder transportkosten/);
    assert.match(await page.locator('#profit').innerText(),/443,00/);
    await page.locator('#saveCosts').click();
    await page.waitForFunction(() => document.querySelector('#priceStatus').textContent.includes('gedeeld bewaard'));
    await page.locator('[data-tab="prijzen"]').click();
    await page.locator('#priceYear').fill('2027'); await page.locator('#loadPrices').click();
    await page.waitForFunction(() => document.querySelector('#priceStatus').textContent.includes('Geen gedeelde prijzen'));
    assert.equal(await page.locator('[data-key="kerstrozen_wit"][data-field="cost"]').inputValue(),'');
    await page.locator('[data-key="kerstrozen_wit"][data-field="cost"]').fill('3,50');
    await page.locator('#savePrices').click();
    await page.waitForFunction(() => document.querySelector('#priceStatus').textContent.includes('gedeeld bewaard'));
    await page.locator('#priceYear').fill('2026'); await page.locator('#loadPrices').click();
    await page.waitForFunction(() => document.querySelector('#priceStatus').textContent.includes('2026 geladen uit'));
    assert.equal(await page.locator('[data-key="kerstrozen_wit"][data-field="cost"]').inputValue(),'2.00');
    assert.match(await page.locator('#profit').innerText(),/443,00/);
    for (const [selector,name] of [['[data-pdf="Kerstrozen"]','kerstrozen.pdf'],['[data-pdf="Truffels"]','truffels.pdf'],['[data-pdf="winst"]','winst.pdf'],['#allClassesPdf','klassen.pdf']]) {
      const panel = name==='winst.pdf' ? 'winst' : name==='klassen.pdf' ? 'klassen' : 'leveranciers';
      await page.locator(`[data-tab="${panel}"]`).click();
      if (panel==='leveranciers') await page.locator('#supplier').selectOption(name==='truffels.pdf' ? 'Truffels' : 'Kerstrozen');
      const pending = page.waitForEvent('download'); await page.locator(selector).click();
      const download=await pending; await download.saveAs(path.join(output,name));
      assert.ok(fs.statSync(path.join(output,name)).size>1000);
    }
    assert.equal(await page.locator('#classListsPanel').isVisible(),true);
    assert.equal(await page.locator('#studentSheetsPanel').isHidden(),true);
    assert.equal(await page.locator('#classesZip').isVisible(),true);
    assert.equal(await page.locator('#studentsZip').isHidden(),true);
    await page.locator('#studentSheetsTab').click();
    assert.equal(await page.locator('#classList').isHidden(),true);
    assert.equal(await page.locator('#classesZip').isHidden(),true);
    assert.equal(await page.locator('#studentsZip').isVisible(),true);
    await page.locator('#studentGroup').selectOption('K1');
    assert.equal(await page.locator('#group').inputValue(),'K1');
    assert.equal(await page.locator('#allStudentsPdf').count(),0);
    assert.match(await page.locator('#classStudentsPdf').innerText(),/K1.*4 leerlingen/);
    assert.equal(await page.locator('#classList tbody tr').count(),4);
    assert.equal(await page.locator('#classList').getByText('Koper',{exact:true}).count(),0);
    assert.match(await page.locator('#classList tfoot').innerText(),/KLASTOTAAL/);
    await page.locator('#student').selectOption({label:'Leonardo'});
    for (const [selector,name] of [['#studentPdf','leerling.pdf'],['#classStudentsPdf','leerlingen-klas.pdf']]) {
      const pending=page.waitForEvent('download'); await page.locator(selector).click();
      await (await pending).saveAs(path.join(output,name));
    }
    await page.screenshot({path:path.join(output,'klas-desktop.png'),fullPage:true});
    assert.equal(await page.locator('#mergeStudents').count(),0);
    assert.equal(await page.locator('#classList tbody tr').count(),4);
    await page.locator('#studentGroup').selectOption('L3');
    assert.equal(await page.locator('#classList tbody tr').count(),2);
    await page.locator('#student').selectOption({label:'Symons Yliana'});
    const reversedDownload=page.waitForEvent('download'); await page.locator('#studentPdf').click();
    await (await reversedDownload).saveAs(path.join(output,'yliana-samengevoegd.pdf'));
    await page.locator('#studentGroup').selectOption('AKB');
    assert.equal(await page.locator('#studentGroup').inputValue(),'AKB');
    assert.match(await page.locator('#classList').innerText(),/Geen bestellingen/);
    assert.equal(await page.locator('#studentPdf').isDisabled(),true);
    assert.equal(await page.locator('#classStudentsPdf').isDisabled(),true);
    // Each ZIP contains one PDF per populated class, even while empty AKB is selected.
    for(const [selector,zipName] of [['#classesZip','klasoverzichten.zip'],['#studentsZip','leerlingbladen.zip']]) {
      await page.locator(selector==='#classesZip' ? '#classListsTab' : '#studentSheetsTab').click();
      const downloadReady=page.waitForEvent('download');await page.locator(selector).click();
      await (await downloadReady).saveAs(path.join(output,zipName));
      const {CFB}=require('./vendor/xlsx.full.min.js');
      const archive=CFB.read(fs.readFileSync(path.join(output,zipName)),{type:'buffer'});
      const files=archive.FileIndex.filter(file=>file.name.endsWith('.pdf'));
      assert.equal(files.length,8);
      assert.ok(files.some(file=>file.name.endsWith('_K1.pdf')));
      assert.ok(files.some(file=>file.name.endsWith('_L3.pdf')));
      assert.ok(!files.some(file=>file.name.endsWith('_AKB.pdf')));
      for(const file of files)assert.equal(Buffer.from(file.content).subarray(0,5).toString(),'%PDF-');
      const pupilPdf=files.find(file=>file.name==='leerlingbladen_L3.pdf');
      if(pupilPdf)assert.equal((Buffer.from(pupilPdf.content).toString().match(/\/Type \/Page\b/g)||[]).length,2);
      assert.match(await page.locator('#zipStatus').innerText(),/8 PDF/);
    }
    await page.locator('[data-tab="leveranciers"]').click();
    await page.screenshot({path:path.join(output,'desktop.png'),fullPage:true});
    // Includes one compact, always-visible shared-file status line.
    assert.ok(await page.evaluate(() => document.documentElement.scrollHeight < 1160));
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:path.join(output,'mobile.png'),fullPage:true});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
    await page.locator('[data-tab="bestand"]').click();
    await page.locator('#file').setInputFiles(process.argv[3]);
    await page.waitForFunction(() => !document.querySelector('#review').hidden);
    assert.equal(await page.locator('#confirm').isChecked(),false);
    assert.equal(await page.locator('#reports').isHidden(),true);
    await page.locator('#confirm').check();
    assert.equal(await page.locator('[data-pdf="winst"]').isDisabled(),false);
    assert.match(await page.locator('#profit').innerText(),/443,00/);
    await page.locator('[data-tab="bestand"]').click();
    // Exercise repeated class headers and totals across PDF page breaks.
    const XLSX = require('./vendor/xlsx.full.min.js');
    const source = XLSX.read(fs.readFileSync(process.argv[3]));
    const rows = XLSX.utils.sheet_to_json(source.Sheets[source.SheetNames[0]],{header:1,defval:''});
    const nameCol = rows[0].indexOf('Naam van de leerling'), classCol = rows[0].indexOf('Klas van de leerling');
    const stressRows = [rows[0],...Array.from({length:45},(_,i) => {const row=[...rows[1]];row[nameCol]=`Leerling ${String(i+1).padStart(2,'0')}`;row[classCol]='TESTKLAS';return row;})];
    const stressBook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(stressBook,XLSX.utils.aoa_to_sheet(stressRows),'Test');
    await page.locator('#file').setInputFiles({name:'paginatest.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(XLSX.write(stressBook,{type:'buffer',bookType:'xlsx'}))});
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('45 gecontroleerde'));
    const previousSaved=await page.evaluate(()=>localStorage.getItem('test_workbook'));
    await page.evaluate(()=>localStorage.setItem('test_save_fail','1'));
    await page.locator('#confirm').check();
    await page.waitForFunction(()=>document.querySelector('#savedStatus').textContent.includes('niet bevestigd'));
    assert.equal(await page.evaluate(()=>localStorage.getItem('test_workbook')),previousSaved);
    await page.evaluate(()=>localStorage.removeItem('test_save_fail'));
    await page.locator('[data-tab="bestand"]').click();await page.locator('#retrySave').click();
    await page.waitForFunction(()=>document.querySelector('#savedStatus').textContent.includes('Gedeeld bewaard'));
    await page.locator('[data-tab="klassen"]').click();
    await page.locator('#group').selectOption('TESTKLAS');
    const paginationDownload=page.waitForEvent('download'); await page.locator('#classPdf').click();
    await (await paginationDownload).saveAs(path.join(output,'klas-paginatest.pdf'));
    await page.locator('[data-tab="bestand"]').click();
    await page.locator('#clear').click();
    assert.equal(await page.locator('#review').isHidden(),true);
    assert.equal(await page.locator('#preview').innerHTML(),'');
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#priceStatus').textContent.includes('geladen uit'));
    await page.waitForFunction(()=>document.querySelector('#savedStatus').textContent.includes('Laatste Excel geopend'));
    assert.match(await page.locator('#fileSummary').innerText(),/45 bestellingen/);
    assert.equal(await page.locator('[data-key="kerstrozen_wit"][data-field="cost"]').inputValue(),'2.00');
    assert.equal(await page.locator('#mollieTotal').inputValue(),'0.00');
    assert.deepEqual(errors,[]);
    console.log('Browser checks passed: tabs, existing prices, saving per year, reload, retained prices on reimport, totals, four PDFs, AKB and mobile layout. Shared storage mocked.');
  } finally { await browser.close(); server.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
