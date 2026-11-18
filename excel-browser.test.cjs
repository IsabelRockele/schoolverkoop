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
    assert.equal(await page.locator('[data-key="kerstrozen_wit"][data-field="cost"]').inputValue(),'2.35');
    await page.locator('#file').setInputFiles(process.argv[3]);
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('26 gecontroleerde'));
    assert.equal(await page.locator('.error').count(),0);
    assert.match(await page.locator('#issues').innerText(),/19 en 20/);
    await page.locator('#confirm').check();
    assert.equal(await page.locator('[data-panel="bestand"]').isHidden(),true);
    assert.equal(await page.locator('[data-panel="leveranciers"]').isVisible(),true);
    assert.equal(await page.locator('[data-pdf="winst"]').isDisabled(),true);
    await page.locator('[data-tab="prijzen"]').click();
    for (const input of await page.locator('[data-field="cost"]').all()) await input.fill('2,00');
    await page.locator('[data-tab="winst"]').click();
    await page.locator('#fees').fill('0'); await page.locator('#transport').fill('0');
    assert.match(await page.locator('#profit').innerText(),/443,00/);
    await page.locator('[data-tab="prijzen"]').click();
    await page.locator('#savePrices').click();
    await page.waitForFunction(() => document.querySelector('#priceStatus').textContent.includes('gedeeld bewaard'));
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
    await page.locator('#group').selectOption('AKB');
    assert.match(await page.locator('#classList').innerText(),/Geen bestellingen/);
    await page.locator('[data-tab="leveranciers"]').click();
    await page.screenshot({path:path.join(output,'desktop.png'),fullPage:true});
    assert.ok(await page.evaluate(() => document.documentElement.scrollHeight < 1100));
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
    await page.locator('#clear').click();
    assert.equal(await page.locator('#review').isHidden(),true);
    assert.equal(await page.locator('#preview').innerHTML(),'');
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#priceStatus').textContent.includes('geladen uit'));
    assert.equal(await page.locator('[data-key="kerstrozen_wit"][data-field="cost"]').inputValue(),'2.00');
    assert.equal(await page.locator('#fees').inputValue(),'0.00');
    assert.deepEqual(errors,[]);
    console.log('Browser checks passed: tabs, existing prices, saving per year, reload, retained prices on reimport, totals, four PDFs, AKB and mobile layout. Shared storage mocked.');
  } finally { await browser.close(); server.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
