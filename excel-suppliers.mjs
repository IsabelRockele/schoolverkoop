// Supplier layout from the original school.js supplier PDFs: same school identity,
// separate weight tables, subtotals and invoice band. Inputs are in integer cents.
export const SCHOOL = {
  name:'GO! Basisschool De Linde', street:'Lindestraat 123a', town:'2880 Bornem',
  vat:'BE0850.037.427', email:'administratie@bsdelinde.net', logo:'afbeeldingen/schoollogo.png'
};
export const supplierMoney = cents => cents == null ? 'Nog in te vullen' : new Intl.NumberFormat('nl-BE',{style:'currency',currency:'EUR'}).format(cents/100);
export function supplierTotal(products) {
  return {sold:products.reduce((s,p) => s+p.sold,0),boxes:products.reduce((s,p) => s+p.boxes,0),ordered:products.reduce((s,p) => s+p.ordered,0),surplus:products.reduce((s,p) => s+p.surplus,0),cost:products.some(p => p.cost==null) ? null : products.reduce((s,p) => s+p.cost,0)};
}
export function supplierSections(summary,supplier) {
  const products=summary.products.filter(p => p.supplier===supplier && p.sold>0);
  if (supplier==='Kerstrozen') return [{title:'Kerstrozen',note:'Pot diameter 10,5 cm (min. 5 bloemen)',products,total:supplierTotal(products)}];
  return [250,500].map(size => {
    const items=products.filter(p => p.key.startsWith(`truffels_${size}_`));
    const packs=[...new Set(items.map(p => p.pack))];
    const packaging=packs.length===1 ? `${packs[0]} doosjes per grote doos.` : items.map(p => `${variant(p)}: ${p.pack} doosjes per grote doos`).join('; ');
    return {title:`Truffels ${size} g`,products:items,total:supplierTotal(items),note:items.length ? `${packaging} Bestellen = te leveren doosjes, inclusief overschot. Totaal = bestellen x prijs/stuk.` : 'Geen bestellingen voor dit gewicht.'};
  });
}
export function variant(product) { return product.key.split('_').at(-1); }
export function supplierRows(section,supplier) {
  if (supplier==='Kerstrozen') return section.products.map(p => ['Kerstrozen',variant(p),p.sold,supplierMoney(p.unitCost),supplierMoney(p.cost)]);
  return section.products.map(p => [variant(p),p.sold,p.boxes,p.ordered,p.surplus,supplierMoney(p.unitCost),supplierMoney(p.cost)]);
}
export const SUPPLIER_HEADERS = {
  Kerstrozen:['Product','Variant','Aantal','Prijs/stuk','Totaal'],
  Truffels:['Smaak','Verkocht','Grote dozen','Bestellen','Overschot','Prijs/stuk','Totaal']
};
export function supplierTotalRow(section,supplier) {
  const t=section.total;
  return supplier==='Kerstrozen' ? ['Totaal kerstrozen','',t.sold,'',t.cost==null ? 'Niet volledig' : supplierMoney(t.cost)] : ['Totaal',t.sold,t.boxes,t.ordered,t.surplus,'',t.cost==null ? 'Niet volledig' : supplierMoney(t.cost)];
}
async function logoData() {
  const response=await fetch(SCHOOL.logo);
  if (!response.ok) throw Error('Het schoollogo kon niet worden geladen. Probeer opnieuw.');
  const blob=await response.blob();
  return await new Promise((resolve,reject) => {const reader=new FileReader();reader.onload=() => resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});
}
export async function downloadSupplierPdf(summary,supplier,year) {
  if (!window.jspdf) throw Error('De PDFbibliotheek kon niet worden geladen.');
  const logo=await logoData();
  const roses=supplier==='Kerstrozen';
  const pdf=new window.jspdf.jsPDF({orientation:roses ? 'portrait' : 'landscape',unit:'mm',format:'a4'});
  const pageW=pdf.internal.pageSize.getWidth(),pageH=pdf.internal.pageSize.getHeight();
  const x=roses ? 20 : 15,w=pageW-x*2;
  const text=value => String(value).replace(/€/g,'EUR').replace(/\u00a0/g,' ');
  pdf.addImage(logo,'PNG',15,10,22,22);
  pdf.setFont('helvetica','bold');pdf.setFontSize(11);pdf.text(SCHOOL.name,42,18);
  pdf.setFont('helvetica','normal');pdf.text(SCHOOL.street,42,24);pdf.text(SCHOOL.town,42,30);
  pdf.setFontSize(9);pdf.text(`Verkoopjaar ${year}`,pageW-15,18,{align:'right'});
  pdf.setFont('helvetica','bold');pdf.setFontSize(15);pdf.text(`Overzicht leverancier - ${supplier}`,pageW/2,45,{align:'center'});
  pdf.setFont('helvetica','normal');pdf.setFontSize(9);
  pdf.text(`BTW-nummer: ${SCHOOL.vat}  |  e-mail: ${SCHOOL.email}`,pageW/2,pageH-12,{align:'center'});
  let y=55;
  const sections=supplierSections(summary,supplier);
  for (const section of sections) {
    pdf.setFillColor(245,247,249);pdf.setDrawColor(200,200,200);pdf.rect(x,y,w,10,'FD');
    pdf.setFont('helvetica','bold');pdf.setFontSize(12);pdf.text(section.title,x+4,y+7);y+=14;
    if (roses) {pdf.setFont('helvetica','normal');pdf.setFontSize(10);pdf.text(section.note,x,y);y+=7;}
    const widths=roses ? [47,28,22,34,39] : [37,31,39,39,35,42,w-223];
    const headers=SUPPLIER_HEADERS[supplier];
    function row(values,heading=false,total=false) {
      pdf.setFont('helvetica',heading || total ? 'bold' : 'normal');pdf.setFontSize(roses ? 10 : 10);
      let left=x;
      if (heading) {pdf.setFillColor(252,252,252);pdf.rect(x,y-5,w,8,'F');}
      if (total) {pdf.setDrawColor(180);pdf.line(x,y-5,x+w,y-5);}
      values.forEach((value,i) => {
        const align=(roses ? i>=2 : i>=1) ? 'right' : 'left';
        pdf.text(text(value),align==='right' ? left+widths[i]-3 : left+3,y,{align});
        left+=widths[i];
      });
      y+=7;
    }
    row(headers,true);
    if (!section.products.length) {pdf.setFont('helvetica','normal');pdf.text('Geen bestellingen',x+3,y);y+=7;}
    else supplierRows(section,supplier).forEach(values => row(values));
    y+=1;row(supplierTotalRow(section,supplier),false,true);
    if (!roses) {
      pdf.setFont('helvetica','normal');pdf.setFontSize(8);pdf.setTextColor(100,100,100);
      const lines=pdf.splitTextToSize(section.note,w);pdf.text(lines,x,y);y+=lines.length*3.2+5;pdf.setTextColor(0,0,0);
    } else y+=6;
  }
  const total=supplierTotal(sections.flatMap(section => section.products));
  // Keep the prominent payment band, but never present a partial amount as complete.
  const label=roses ? 'Te betalen aan leverancier kerstrozen' : 'Te betalen aan leverancier truffels (250 g + 500 g)';
  const value=total.cost==null ? 'Niet volledig' : supplierMoney(total.cost);
  pdf.setFillColor(230,240,234);pdf.setDrawColor(45,125,78);pdf.setLineWidth(.6);pdf.rect(x,y,w,11,'F');pdf.line(x,y,x+w,y);
  pdf.setTextColor(26,92,58);pdf.setFont('helvetica','bold');pdf.setFontSize(roses ? 10 : 12);
  pdf.text(label,x+4,y+7.5);pdf.text(text(value),x+w-4,y+7.5,{align:'right'});
  if (total.cost==null) {pdf.setFont('helvetica','normal');pdf.setFontSize(9);pdf.text('Inkoopprijs ontbreekt bij een of meer producten. Bestelaantallen zijn volledig.',x,y+17);}
  pdf.save(`leverancier_${supplier.toLowerCase()}.pdf`);
}
