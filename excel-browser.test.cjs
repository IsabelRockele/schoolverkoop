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
    const errors=[]; page.on('pageerror',error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/excel.html`);
    await page.locator('#file').setInputFiles(process.argv[3]);
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('26 gecontroleerde'));
    assert.equal(await page.locator('.error').count(),0);
    assert.match(await page.locator('#issues').innerText(),/19 en 20/);
    await page.locator('#confirm').check();
    assert.equal(await page.locator('[data-pdf="winst"]').isDisabled(),true);
    for (const input of await page.locator('[data-field="cost"]').all()) await input.fill('2,00');
    await page.locator('#fees').fill('0'); await page.locator('#transport').fill('0');
    assert.match(await page.locator('#profit').innerText(),/443,00/);
    for (const [selector,name] of [['[data-pdf="Kerstrozen"]','kerstrozen.pdf'],['[data-pdf="Truffels"]','truffels.pdf'],['[data-pdf="winst"]','winst.pdf'],['#allClassesPdf','klassen.pdf']]) {
      const pending = page.waitForEvent('download'); await page.locator(selector).click();
      const download=await pending; await download.saveAs(path.join(output,name));
      assert.ok(fs.statSync(path.join(output,name)).size>1000);
    }
    await page.locator('#group').selectOption('AKB');
    assert.match(await page.locator('#classList').innerText(),/Geen bestellingen/);
    await page.screenshot({path:path.join(output,'desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:path.join(output,'mobile.png'),fullPage:true});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
    await page.screenshot({path:path.join(output,'mobile.png'),fullPage:true});
    await page.locator('#file').setInputFiles(process.argv[3]);
    await page.waitForFunction(() => !document.querySelector('#review').hidden);
    assert.equal(await page.locator('#confirm').isChecked(),false);
    assert.equal(await page.locator('#reports').isHidden(),true);
    await page.locator('#confirm').check();
    assert.equal(await page.locator('[data-pdf="winst"]').isDisabled(),true);
    await page.locator('#clear').click();
    assert.equal(await page.locator('#review').isHidden(),true);
    assert.equal(await page.locator('#preview').innerHTML(),'');
    assert.deepEqual(errors,[]);
    console.log('Browser checks passed: import, totals, costs, four PDFs, AKB, mobile layout, replacement and clear.');
  } finally { await browser.close(); server.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
