import { PRODUCTS } from './excel-import.mjs';

export function buyersFor(student) {
  const buyers=new Map();
  for (const order of student.orders) {
    const name=String(order.buyer || '').trim().replace(/\s+/g,' ');
    const key=name ? `name:${name.toLocaleLowerCase('nl')}` : `row:${order.row}`;
    if (!buyers.has(key)) buyers.set(key,{name:name || '(kopernaam ontbreekt)',items:new Map(),gift:0,total:0,count:0});
    const buyer=buyers.get(key);
    buyer.gift+=order.gift; buyer.total+=order.total;
    for (const item of order.items.filter(i => i.count)) {
      const itemKey=JSON.stringify([item.key,item.price]);
      if (!buyer.items.has(itemKey)) buyer.items.set(itemKey,{...item,count:0});
      buyer.items.get(itemKey).count+=item.count; buyer.count+=item.count;
    }
  }
  return [...buyers.values()].map(buyer => ({...buyer,items:[...buyer.items.values()]}));
}

// One document for the selected class; each pupil starts a fresh section/page.
// Buyers share pages. Keep a buyer together when it fits on one page; repeat both
// the pupil and buyer identity if an exceptionally long buyer block must continue.
export function createStudentPdf(students,year,JsPDF) {
  const pdf=new JsPDF({unit:'mm',format:'a4'});
  const left=15,width=180,bottom=262;
  const money=cents => `EUR ${(cents/100).toFixed(2).replace('.',',')}`;
  const columns=[100,18,30,32];
  students.forEach((student,studentIndex) => {
    if (studentIndex) pdf.addPage();
    const firstPage=pdf.getNumberOfPages();
    let y,contentTop;
    function pageHeader(continued=false) {
      pdf.setTextColor(25,55,47);pdf.setFont('helvetica','normal');pdf.setFontSize(10);
      pdf.text(`GO! Basisschool De Linde | Schoolverkoop ${year}`,left,16);
      pdf.setFont('helvetica','bold');pdf.setFontSize(22);
      const nameLines=pdf.splitTextToSize(student.name,width);
      pdf.text(nameLines,left,29);
      y=29+nameLines.length*8;
      pdf.setFontSize(12);pdf.text(`Klas: ${student.group}`,left,y);y+=8;
      pdf.setFont('helvetica','normal');pdf.setFontSize(10);
      pdf.text(continued ? 'Leveringslijst - vervolg van dezelfde leerling' : 'Leveringslijst - alle kopers van deze leerling',left,y);
      y+=10;contentTop=y;
    }
    function nextPage() { pdf.addPage();pageHeader(true); }
    function linesFor(values) {
      pdf.setFont('helvetica','normal');pdf.setFontSize(10);
      return values.map((value,i) => pdf.splitTextToSize(String(value),columns[i]-6));
    }
    function rowHeight(lines) { return Math.max(...lines.map(line => line.length))*4.5+4; }
    function drawRow(values,heading=false) {
      const lines=linesFor(values),height=rowHeight(lines);
      if (heading) {pdf.setFillColor(243,247,244);pdf.rect(left,y,width,height,'F');}
      let x=left;
      lines.forEach((line,i) => {
        pdf.setFont('helvetica',heading || i===1 ? 'bold' : 'normal');pdf.setFontSize(10);
        pdf.setTextColor(25,55,47);
        pdf.text(line,i===0 ? x+3 : x+columns[i]-3,y+5,{align:i===0 ? 'left' : 'right'});
        x+=columns[i];
      });
      pdf.setDrawColor(219,228,221);pdf.line(left,y+height,left+width,y+height);y+=height;
    }
    function buyerHeader(buyer,index,continued=false) {
      pdf.setFont('helvetica','bold');pdf.setFontSize(12);
      const lines=pdf.splitTextToSize(`Koper ${index+1}: ${buyer.name}${continued ? ' (vervolg)' : ''}`,width-8);
      const h=lines.length*5+7;
      pdf.setFillColor(225,237,229);pdf.rect(left,y,width,h,'F');pdf.setTextColor(25,55,47);
      pdf.text(lines,left+4,y+6);y+=h;
      drawRow(['Product','Aantal','Prijs/stuk','Bedrag'],true);
    }
    pageHeader();
    const buyers=buyersFor(student);
    buyers.forEach((buyer,index) => {
      const rows=buyer.items.map(item => [PRODUCTS.find(p => p.key===item.key).label,item.count,money(item.price),money(item.count*item.price)]);
      if (buyer.gift) rows.push(['Gift (geen product)','-','-',money(buyer.gift)]);
      if (!rows.length) rows.push(['Geen producten','-','-','-']);
      pdf.setFont('helvetica','bold');pdf.setFontSize(12);
      const headerHeight=pdf.splitTextToSize(`Koper ${index+1}: ${buyer.name}`,width-8).length*5+7;
      const blockHeight=headerHeight+8.5+rows.reduce((sum,row) => sum+rowHeight(linesFor(row)),0)+10;
      const minimum=headerHeight+8.5+rowHeight(linesFor(rows[0]))+10;
      if (y>contentTop && (y+minimum>bottom || (blockHeight<=bottom-contentTop && y+blockHeight>bottom))) nextPage();
      buyerHeader(buyer,index);
      for (const values of rows) {
        if (y+rowHeight(linesFor(values))+10>bottom) {nextPage();buyerHeader(buyer,index,true);}
        drawRow(values);
      }
      pdf.setFillColor(243,247,244);pdf.rect(left,y,width,10,'F');pdf.setFont('helvetica','bold');pdf.setFontSize(10);
      pdf.text(`Totaal voor deze koper: ${buyer.count} stuks`,left+3,y+6);
      pdf.text(money(buyer.total),left+width-3,y+6,{align:'right'});y+=17;
    });
    if (y+19>bottom) nextPage();
    pdf.setFillColor(25,78,70);pdf.rect(left,y,width,18,'F');pdf.setTextColor(255,255,255);pdf.setFont('helvetica','bold');pdf.setFontSize(11);
    pdf.text(`Totaal voor deze leerling: ${student.total} stuks`,left+4,y+7);
    pdf.text(`Totaal bestellingen: ${money(student.orders.reduce((sum,order) => sum+order.total,0))}`,left+4,y+14);
    const lastPage=pdf.getNumberOfPages();
    for (let page=firstPage;page<=lastPage;page++) {
      pdf.setPage(page);pdf.setTextColor(75,95,83);pdf.setFont('helvetica','normal');pdf.setFontSize(9);
      const footerName=pdf.splitTextToSize(`${student.name} | ${student.group}`,105);
      pdf.text(footerName,left,275);
      pdf.text(`Blad ${page-firstPage+1} van ${lastPage-firstPage+1} voor deze leerling`,195,275,{align:'right'});
      pdf.setFontSize(8);pdf.text('Bedragen volgens de bestellingen. Betaalstatus niet beschikbaar in Excel.',left,289);
    }
    pdf.setPage(lastPage);
  });
  return pdf;
}
