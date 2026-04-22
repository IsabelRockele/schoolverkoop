function haalProductenUitBestelling(data) {
  return Object.values(data.bestelling || {});
}

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";


// 🔹 Actieve verkoopactie
const ACTIEVE_ACTIE = "kerstverkoop_2026";

// 🔹 Verpakkingseenheden per leverancier
// Truffels worden per grote doos geleverd. Het bedrijf rondt altijd naar boven af:
// verkoop je bv. 14 × 250 g, dan lever je 2 grote dozen (= 24 stuks) en heb je 10 overschot.
const DOZEN_PER_GROTE_DOOS = {
  truffel250: 12,
  truffel500: 8
};

// 🔹 Helper: berekent grote dozen + bestelaantal + overschot
function berekenDozenInfo(verkocht, perGroteDoos) {
  const grote = verkocht > 0 ? Math.ceil(verkocht / perGroteDoos) : 0;
  const bestellen = grote * perGroteDoos;
  const overschot = bestellen - verkocht;
  return { grote, bestellen, overschot };
}

// 🔹 Inkoopprijzen (gedeeld via Firestore, localStorage als cache/fallback)
// Zelfde key als in winst.js: winst_<actieId>_inkoopprijzen
const LS_INKOOP_KEY = `winst_${ACTIEVE_ACTIE}_inkoopprijzen`;

// Synchrone lezer (uit localStorage-cache)
function leesInkoopMap() {
  try {
    return JSON.parse(localStorage.getItem(LS_INKOOP_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

// Ophalen uit Firestore bij opstart en in localStorage cachen
async function laadInkoopMapVanFirestore() {
  try {
    const ref = doc(db, "instellingen", ACTIEVE_ACTIE);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      if (data.inkoopprijzen && typeof data.inkoopprijzen === "object") {
        localStorage.setItem(LS_INKOOP_KEY, JSON.stringify(data.inkoopprijzen));
      }
    }
  } catch (err) {
    console.warn("Kon inkoopprijzen niet uit Firestore laden:", err);
  }
}

// 🔹 Van (productnaam, variant) naar de vaste inkoop-key uit winst.js
// Resultaat: "kerstrozen_wit", "truffels_250_melk", "truffels_500_donker", …
function inkoopKeyVoor(productNaam, variant) {
  const v = String(variant || "").toLowerCase().trim();
  if (!v) return null;

  if (productNaam === "Kerstrozen") {
    return `kerstrozen_${v}`;
  }
  if (productNaam.includes("Truffels 250")) {
    return `truffels_250_${v}`;
  }
  if (productNaam.includes("Truffels 500")) {
    return `truffels_500_${v}`;
  }
  return null;
}

// 🔹 Euro-formatter (zelfde stijl als in winst.js)
function euro(n) {
  const v = Number(n || 0);
  return "€ " + v.toFixed(2).replace(".", ",");
}

// 🔹 Firebase configuratie
const firebaseConfig = {
  apiKey: "AIzaSyD4Pd3z6WpGbDwtpKV5glvrvJ5Ks-qCPz0",
  authDomain: "schoolverkoop-3d82d.firebaseapp.com",
  projectId: "schoolverkoop-3d82d",
  storageBucket: "schoolverkoop-3d82d.firebasestorage.app",
  messagingSenderId: "74076660432",
  appId: "1:74076660432:web:2e94c19700a076458cb4d5"
};

// 🔹 Firebase starten
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 🔹 DOM
const tabelKerstrozen = document.getElementById("tabelKerstrozen");
const tabelTruffels250 = document.getElementById("tabelTruffels250");
const tabelTruffels500 = document.getElementById("tabelTruffels500");
const klasFilter = document.getElementById("klasFilter");
const tabelKlas = document.querySelector("#totaalPerKlas tbody");
const downloadPdfBtn = document.getElementById("downloadPdfKlas");
const downloadLeveranciersPdf = document.getElementById("downloadLeveranciersPdf");
const downloadPdfPerKind = document.getElementById("downloadPdfPerKind");


// 🔹 Leveranciers-data (wordt gevuld door laadTotaalPerProduct)
// Deze variabele wordt hergebruikt door de PDF-functies zodat we niet
// afhankelijk zijn van de HTML-tabel (waar nu ook totaalrijen in staan).
let leveranciersData = {
  Kerstrozen: {},
  Truffels250: {},
  Truffels500: {}
};

// ============================
// A) TOTAAL PER PRODUCT (PER LEVERANCIER)
// ============================
async function laadTotaalPerProduct() {
tabelKerstrozen.innerHTML = "";
tabelTruffels250.innerHTML = "";
tabelTruffels500.innerHTML = "";

  const snapshot = await getDocs(
  query(
    collection(db, "bestellingen_test"),
    where("actieId", "==", ACTIEVE_ACTIE)
  )
);


  // leverancier-indeling (simpel en duidelijk)
const leveranciers = {
  Kerstrozen: {},
  Truffels250: {},
  Truffels500: {}
};


  snapshot.forEach(doc => {
  const data = doc.data();
  const producten = haalProductenUitBestelling(data);

  producten.forEach(p => {
    let leverancier = null;

if (p.naam === "Kerstrozen") {
  leverancier = "Kerstrozen";
} else if (p.naam.includes("Truffels 250")) {
  leverancier = "Truffels250";
} else if (p.naam.includes("Truffels 500")) {
  leverancier = "Truffels500";
}
if (!leverancier) return;

const key = `${p.naam}|||${p.variant}`;
leveranciers[leverancier][key] =
  (leveranciers[leverancier][key] || 0) + p.aantal;

  });
});


  // Beschikbaar maken voor PDF-functies
  leveranciersData = leveranciers;

  // Inkoopprijzen (gedeeld met winstpagina)
  const inkoopMap = leesInkoopMap();

  // -----------------------
  // Kerstrozen (5 kolommen + totaalrij + factuurbalk)
  // -----------------------
  if (Object.keys(leveranciers.Kerstrozen).length === 0) {
    tabelKerstrozen.innerHTML =
      `<tr><td colspan="5" class="muted">Geen bestellingen</td></tr>`;
    zetFactuurBalk("kerstrozen", 0, false);
  } else {
    let totaalKerstrozen = 0;
    let factuurKerstrozen = 0;
    let heeftOntbrekendePrijs = false;

    Object.keys(leveranciers.Kerstrozen).forEach(k => {
      const [naam, variant] = k.split("|||");
      const aantal = leveranciers.Kerstrozen[k];
      totaalKerstrozen += aantal;

      // Prijs uit de gedeelde inkoopMap
      const inkKey = inkoopKeyVoor(naam, variant);
      const prijsStuk = inkKey ? Number(inkoopMap[inkKey] || 0) : 0;
      const regelTotaal = prijsStuk * aantal;
      factuurKerstrozen += regelTotaal;

      const prijsCel = prijsStuk > 0
        ? euro(prijsStuk)
        : `<span class="prijs-ontbreekt" title="Inkoopprijs invullen via 'Bekijk winstberekening'">–</span>`;
      const totaalCel = prijsStuk > 0 ? euro(regelTotaal) : "–";
      if (prijsStuk === 0) heeftOntbrekendePrijs = true;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${naam}</td>
        <td>${variant}</td>
        <td class="num">${aantal}</td>
        <td class="num">${prijsCel}</td>
        <td class="num">${totaalCel}</td>
      `;
      tabelKerstrozen.appendChild(tr);
    });

    // Totaalrij
    const trTotaal = document.createElement("tr");
    trTotaal.className = "totaalrij";
    trTotaal.innerHTML = `
      <td colspan="2"><strong>Totaal kerstrozen</strong></td>
      <td class="num"><strong>${totaalKerstrozen}</strong></td>
      <td></td>
      <td class="num"><strong>${euro(factuurKerstrozen)}</strong></td>
    `;
    tabelKerstrozen.appendChild(trTotaal);

    // Bewaar voor PDF
    leveranciersData._kerstrozenFactuur = factuurKerstrozen;
    leveranciersData._kerstrozenOntbreektPrijs = heeftOntbrekendePrijs;

    zetFactuurBalk("kerstrozen", factuurKerstrozen, heeftOntbrekendePrijs);
  }

  // -----------------------
  // Truffels 250 g (7 kolommen + totaalrij)
  // -----------------------
  const factuur250 = renderTruffelTabel(
    tabelTruffels250,
    leveranciers.Truffels250,
    DOZEN_PER_GROTE_DOOS.truffel250,
    inkoopMap
  );

  // -----------------------
  // Truffels 500 g (7 kolommen + totaalrij)
  // -----------------------
  const factuur500 = renderTruffelTabel(
    tabelTruffels500,
    leveranciers.Truffels500,
    DOZEN_PER_GROTE_DOOS.truffel500,
    inkoopMap
  );

  // Gezamenlijke factuurbalk voor alle truffels
  const totaalTruffels = factuur250.bedrag + factuur500.bedrag;
  const heeftTruffelsBestellingen =
    Object.keys(leveranciers.Truffels250).length > 0 ||
    Object.keys(leveranciers.Truffels500).length > 0;
  const truffelsOntbreektPrijs = factuur250.ontbreekt || factuur500.ontbreekt;

  leveranciersData._truffels250Factuur = factuur250.bedrag;
  leveranciersData._truffels500Factuur = factuur500.bedrag;
  leveranciersData._truffelsFactuur = totaalTruffels;
  leveranciersData._truffelsOntbreektPrijs = truffelsOntbreektPrijs;

  if (heeftTruffelsBestellingen) {
    zetFactuurBalk("truffels", totaalTruffels, truffelsOntbreektPrijs);
  } else {
    zetFactuurBalk("truffels", 0, false);
  }
}

// ============================
// Helper: factuurbalk onder een leverancierstabel
// ============================
function zetFactuurBalk(leverancier, bedrag, ontbreektPrijs) {
  const containerId = leverancier === "kerstrozen"
    ? "kerstrozenFactuurTotaal"
    : "truffelsFactuurTotaal";
  const bedragId = leverancier === "kerstrozen"
    ? "kerstrozenFactuurBedrag"
    : "truffelsFactuurBedrag";

  const container = document.getElementById(containerId);
  const bedragEl = document.getElementById(bedragId);
  if (!container || !bedragEl) return;

  if (bedrag === 0 && !ontbreektPrijs) {
    container.classList.add("verborgen");
    return;
  }

  container.classList.remove("verborgen");
  bedragEl.textContent = euro(bedrag);

  // Hint als inkoopprijs nog niet ingevuld is
  let hintEl = container.querySelector(".prijs-hint");
  if (ontbreektPrijs) {
    if (!hintEl) {
      hintEl = document.createElement("div");
      hintEl.className = "prijs-hint";
      hintEl.textContent =
        "Vul de inkoopprijzen in via 'Bekijk winstberekening' voor een volledig totaal.";
      container.appendChild(hintEl);
    }
  } else if (hintEl) {
    hintEl.remove();
  }
}

// ============================
// Helper: render één truffel-tabel met dozen-berekening + inkoopprijzen
// Retourneert: { bedrag: totale factuur, ontbreekt: boolean }
// ============================
function renderTruffelTabel(tbodyEl, data, perGroteDoos, inkoopMap) {
  if (Object.keys(data).length === 0) {
    tbodyEl.innerHTML =
      `<tr><td colspan="7" class="muted">Geen bestellingen</td></tr>`;
    return { bedrag: 0, ontbreekt: false };
  }

  let totVerkocht = 0;
  let totGrote = 0;
  let totBestellen = 0;
  let totOverschot = 0;
  let totFactuur = 0;
  let ontbreekt = false;

  Object.keys(data).forEach(k => {
    const [naam, variant] = k.split("|||");
    const verkocht = data[k];
    const info = berekenDozenInfo(verkocht, perGroteDoos);

    totVerkocht += verkocht;
    totGrote += info.grote;
    totBestellen += info.bestellen;
    totOverschot += info.overschot;

    // Inkoopprijs uit gedeelde inkoopMap
    const inkKey = inkoopKeyVoor(naam, variant);
    const prijsStuk = inkKey ? Number(inkoopMap[inkKey] || 0) : 0;
    // Let op: factuur = bestellen (inclusief overschot) × prijs
    const regelFactuur = prijsStuk * info.bestellen;
    totFactuur += regelFactuur;

    const prijsCel = prijsStuk > 0
      ? euro(prijsStuk)
      : `<span class="prijs-ontbreekt" title="Inkoopprijs invullen via 'Bekijk winstberekening'">–</span>`;
    const totaalCel = prijsStuk > 0 ? euro(regelFactuur) : "–";
    if (prijsStuk === 0) ontbreekt = true;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${variant}</td>
      <td class="num">${verkocht}</td>
      <td class="num">${info.grote}</td>
      <td class="num">${info.bestellen}</td>
      <td class="num ${info.overschot > 0 ? "overschot-pos" : ""}">${info.overschot}</td>
      <td class="num">${prijsCel}</td>
      <td class="num">${totaalCel}</td>
    `;
    tbodyEl.appendChild(tr);
  });

  // Totaalrij
  const trTotaal = document.createElement("tr");
  trTotaal.className = "totaalrij";
  trTotaal.innerHTML = `
    <td><strong>Totaal</strong></td>
    <td class="num"><strong>${totVerkocht}</strong></td>
    <td class="num"><strong>${totGrote}</strong></td>
    <td class="num"><strong>${totBestellen}</strong></td>
    <td class="num"><strong>${totOverschot}</strong></td>
    <td></td>
    <td class="num"><strong>${euro(totFactuur)}</strong></td>
  `;
  tbodyEl.appendChild(trTotaal);

  return { bedrag: totFactuur, ontbreekt };
}


// ============================
// B) TOTAAL PER KLAS
// ============================
async function laadTotaalPerKlas(klas) {
  tabelKlas.innerHTML = "";

  if (!klas) {
    tabelKlas.innerHTML =
      `<tr><td colspan="3" class="muted">Kies eerst een klas</td></tr>`;
    return;
  }

  const snapshot = await getDocs(
  query(
    collection(db, "bestellingen_test"),
    where("actieId", "==", ACTIEVE_ACTIE)
  )
);

  const totalen = {};

  snapshot.forEach(doc => {
  const data = doc.data();
  if (data.leerling?.klas !== klas) return;

  const producten = haalProductenUitBestelling(data);

  producten.forEach(p => {
    const key = `${p.naam}|||${p.variant}`;
    totalen[key] = (totalen[key] || 0) + p.aantal;
  });
});


  const keys = Object.keys(totalen);
  if (keys.length === 0) {
    tabelKlas.innerHTML =
      `<tr><td colspan="3" class="muted">Geen bestellingen</td></tr>`;
    return;
  }

  keys.forEach(k => {
    const [naam, variant] = k.split("|||");
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${naam}</td><td>${variant}</td><td>${totalen[k]}</td>`;
    tabelKlas.appendChild(tr);
  });
}
// ============================
// D) DATA PER KIND (ALFABETISCH + PER KOPER)
// ============================
async function verzamelBestellingenPerKind(klas) {
 const snapshot = await getDocs(
  query(
    collection(db, "bestellingen_test"),
    where("actieId", "==", ACTIEVE_ACTIE)
  )
);


  const resultaat = {};
  /*
    structuur:
    {
      leerling: {
        koperNaam: [
          { naam, variant, aantal, prijs }
        ]
      }
    }
  */

  snapshot.forEach(doc => {
  const d = doc.data();

  // ✅ juiste klas controleren
  if (d.leerling?.klas !== klas) return;

  // ✅ juiste namen ophalen
  const leerling = d.leerling?.naam || "Onbekend";
  const koper = d.koper?.naam || "Onbekend";

  if (!resultaat[leerling]) resultaat[leerling] = {};
  if (!resultaat[leerling][koper]) resultaat[leerling][koper] = [];

  // ✅ producten uit bestelling halen
  const producten = haalProductenUitBestelling(d);

  producten.forEach(p => {
    resultaat[leerling][koper].push({
      naam: p.naam,
      variant: p.variant,
      aantal: p.aantal,
      prijs: p.prijs
    });
  });

  // ✅ sponsor als speciaal item toevoegen (zonder variant)
  const sponsor = Number(d.sponsorBedrag || 0);
  if (sponsor > 0) {
    resultaat[leerling][koper].push({
      naam: "Sponsoring",
      variant: "",
      aantal: 1,
      prijs: sponsor
    });
  }
});


  // leerlingen alfabetisch sorteren
  const gesorteerd = {};
  Object.keys(resultaat)
    .sort((a, b) => a.localeCompare(b, "nl"))
    .forEach(leerling => {
      gesorteerd[leerling] = resultaat[leerling];
    });

  return gesorteerd;
}

// ============================
// E) TEST: PDF VOOR ÉÉN KIND (STAAND)
// ============================
async function testPdfVoorEénKind(klas, leerlingNaam) {
   const vandaag = new Date().toLocaleDateString("nl-BE");
  const data = await verzamelBestellingenPerKind(klas);
  const kindData = data[leerlingNaam];

  if (!kindData) {
    alert("Geen data voor dit kind.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  let y = 25;
  const MAX_Y = 230; // stop vroeger, veilige witmarge onderaan
  const marginL = 20;
  const pageW = pdf.internal.pageSize.getWidth();

  // Titel
  pdf.setFontSize(18);
  pdf.setFont(undefined, "bold");
  pdf.text("Besteloverzicht schoolverkoop", pageW / 2, y, { align: "center" });
  y += 14;

  pdf.setFontSize(11);
  pdf.setFont(undefined, "normal");
  pdf.text(`Leerling: ${leerlingNaam}`, marginL, y);
  y += 7;
  pdf.text(`Klas: ${klas}`, marginL, y);
  y += 14;

  let totaalKind = 0;

  // Per koper
  Object.keys(kindData).forEach(koper => {
  // schatting: hoeveel ruimte dit koperblok nodig heeft
  const aantalRegels = Object.keys(
    kindData[koper].reduce((acc, item) => {
      const sleutel = `${item.naam}|||${item.variant}|||${item.prijs}`;
      acc[sleutel] = true;
      return acc;
    }, {})
  ).length;

  const benodigdeHoogte =
    8 +                // titel "Besteld door"
    (aantalRegels * 6.5) +
    14;                // subtotaal + ruimte

  // past dit koperblok nog op deze pagina?
  if (y + benodigdeHoogte > 270) {
    pdf.addPage();
    y = tekenVervolgKop();
  }

    pdf.setFont(undefined, "bold");
    pdf.setFontSize(13);
pdf.text(`Besteld door: ${koper}`, marginL, y);
y += 8;
pdf.setFontSize(11);


    pdf.setFont(undefined, "normal");

    let subtotaalKoper = 0;

// 1. samenvoegen per product + variant + prijs
const samengevoegd = {};

kindData[koper].forEach(item => {
  const sleutel = `${item.naam}|||${item.variant}|||${item.prijs}`;
  if (!samengevoegd[sleutel]) {
    samengevoegd[sleutel] = {
      naam: item.naam,
      variant: item.variant,
      prijs: item.prijs,
      aantal: 0
    };
  }
  samengevoegd[sleutel].aantal += item.aantal;
});

// 2. nu pas uitschrijven in PDF
Object.values(samengevoegd).forEach(item => {
  const regelTotaal = item.aantal * item.prijs;
  subtotaalKoper += regelTotaal;
  totaalKind += regelTotaal;

  // Sponsoring: toon zonder variant en zonder "1 ×"
  const regelTekst = item.variant
    ? `${item.naam} – ${item.variant}: ${item.aantal} × €${item.prijs} = €${regelTotaal}`
    : `${item.naam}: €${regelTotaal}`;

  pdf.text(regelTekst, marginL + 5, y);
  y += 6.5;

  if (y > 270) {
    pdf.addPage();
y = 25;

// kop opnieuw tekenen op vervolgpagina
const pageW = pdf.internal.pageSize.getWidth();

pdf.setFontSize(18);
pdf.setFont(undefined, "bold");
pdf.text("Besteloverzicht schoolverkoop", pageW / 2, y, { align: "center" });
y += 10;

pdf.setFontSize(10);
pdf.setFont(undefined, "normal");
pdf.text(`Gegenereerd op: ${vandaag}`, pageW / 2, y, { align: "center" });
y += 12;

pdf.setFontSize(12);
pdf.text(`Leerling: ${leerlingNaam} (vervolg)`, marginL, y);
y += 7;
pdf.text(`Klas: ${klas}`, marginL, y);
y += 14;

  }
});


    pdf.setFont(undefined, "bold");
    pdf.setFont(undefined, "bold");
pdf.text(`Subtotaal ${koper}: €${subtotaalKoper}`, marginL + 5, y);
y += 12;
pdf.setFont(undefined, "normal");

  });

  // Totaal kind
  pdf.setFontSize(12);
  pdf.setFont(undefined, "bold");
  y += 10;
pdf.setFontSize(13);
pdf.setFont(undefined, "bold");
if (y > MAX_Y) {
  pdf.addPage();
y = 25;

// kop opnieuw tekenen op vervolgpagina
const pageW = pdf.internal.pageSize.getWidth();

pdf.setFontSize(18);
pdf.setFont(undefined, "bold");
pdf.text("Besteloverzicht schoolverkoop", pageW / 2, y, { align: "center" });
y += 10;

pdf.setFontSize(10);
pdf.setFont(undefined, "normal");
pdf.text(`Gegenereerd op: ${vandaag}`, pageW / 2, y, { align: "center" });
y += 12;

pdf.setFontSize(12);
pdf.text(`Leerling: ${leerlingNaam} (vervolg)`, marginL, y);
y += 7;
pdf.text(`Klas: ${klas}`, marginL, y);
y += 14;

}

pdf.text(`Totaal betaald: €${totaalKind}`, marginL, y);



  pdf.save(`besteloverzicht_${leerlingNaam}_${klas}.pdf`);
}
// ============================
// F) PDF PER KIND – HELE KLAS
// ============================
async function genereerPdfPerKind(klas) {
  const data = await verzamelBestellingenPerKind(klas);
  const leerlingen = Object.keys(data);

  if (leerlingen.length === 0) {
    alert("Geen bestellingen voor deze klas.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const vandaag = new Date().toLocaleDateString("nl-BE");

  leerlingen.forEach((leerlingNaam, index) => {
    if (index > 0) pdf.addPage();

    let y = 25;
    const MAX_Y = 240; // veilige ondermarge (printer)
    const marginL = 20;
    const pageW = pdf.internal.pageSize.getWidth();
    let totaalKind = 0;

    // Titel
    pdf.setFontSize(18);
    pdf.setFont(undefined, "bold");
    pdf.text("Besteloverzicht schoolverkoop", pageW / 2, y, { align: "center" });
    y += 10;

    pdf.setFontSize(10);
    pdf.setFont(undefined, "normal");
    pdf.text(`Gegenereerd op: ${vandaag}`, pageW / 2, y, { align: "center" });
    y += 12;

    pdf.setFontSize(12);
    pdf.text(`Leerling: ${leerlingNaam}`, marginL, y);
    y += 7;
    pdf.text(`Klas: ${klas}`, marginL, y);
    y += 14;

    const kindData = data[leerlingNaam];

 Object.keys(kindData).forEach(koper => {

// === vooraf check: past deze koper nog volledig? ===
const uniekeProducten = Object.keys(
  kindData[koper].reduce((acc, item) => {
    const sleutel = `${item.naam}|||${item.variant}|||${item.prijs}`;
    acc[sleutel] = true;
    return acc;
  }, {})
).length;

const geschatteHoogte =
  8 +                 // titel "Besteld door"
  (uniekeProducten * 6.5) +
  14;                // subtotaal + witruimte

if (y + geschatteHoogte > MAX_Y) {
 pdf.addPage();
y = 25;

// kop opnieuw tekenen op vervolgpagina
const pageW = pdf.internal.pageSize.getWidth();

pdf.setFontSize(18);
pdf.setFont(undefined, "bold");
pdf.text("Besteloverzicht schoolverkoop", pageW / 2, y, { align: "center" });
y += 10;

pdf.setFontSize(10);
pdf.setFont(undefined, "normal");
pdf.text(`Gegenereerd op: ${vandaag}`, pageW / 2, y, { align: "center" });
y += 12;

pdf.setFontSize(12);
pdf.text(`Leerling: ${leerlingNaam} (vervolg)`, marginL, y);
y += 7;
pdf.text(`Klas: ${klas}`, marginL, y);
y += 14;

}

      pdf.setFontSize(13);
      pdf.setFont(undefined, "bold");
      pdf.text(`Besteld door: ${koper}`, marginL, y);
      y += 8;

      pdf.setFontSize(11);
      pdf.setFont(undefined, "normal");

      let subtotaalKoper = 0;
      const samengevoegd = {};

      kindData[koper].forEach(item => {
        const sleutel = `${item.naam}|||${item.variant}|||${item.prijs}`;
        if (!samengevoegd[sleutel]) {
          samengevoegd[sleutel] = { ...item, aantal: 0 };
        }
        samengevoegd[sleutel].aantal += item.aantal;
      });

      Object.values(samengevoegd).forEach(item => {
        const regelTotaal = item.aantal * item.prijs;
        subtotaalKoper += regelTotaal;
        totaalKind += regelTotaal;

        // Sponsoring: toon zonder variant en zonder "1 ×"
        const regelTekst = item.variant
          ? `${item.naam} – ${item.variant}: ${item.aantal} × €${item.prijs} = €${regelTotaal}`
          : `${item.naam}: €${regelTotaal}`;

        pdf.text(regelTekst, marginL + 5, y);
        y += 6.5;
      });

      pdf.setFont(undefined, "bold");
      pdf.text(`Subtotaal ${koper}: €${subtotaalKoper}`, marginL + 5, y);
      y += 14;

    });

    pdf.setFontSize(13);
    pdf.setFont(undefined, "bold");
    pdf.text(`Totaal betaald: €${totaalKind}`, marginL, y);
  });

  pdf.save(`besteloverzichten_${klas}.pdf`);
}

// ============================
// C) PDF PER KLAS
// ============================
async function genereerPdfPerKlas(klas) {
  const snapshot = await getDocs(collection(db, "bestellingen_test"));

  // =========================
  // 1. VASTE PRODUCTSTRUCTUUR
  // =========================
  const productStructuur = [
    { naam: "Kerstrozen", varianten: ["wit", "roze", "rood"] },
    { naam: "Truffels 250 g", varianten: ["wit", "melk", "donker"] },
    { naam: "Truffels 500 g", varianten: ["wit", "melk", "donker"] }
  ];

  const kolommen = [];
  productStructuur.forEach(p => {
    p.varianten.forEach(v => {
      kolommen.push({
        product: p.naam,
        variant: v,
        key: `${p.naam}|||${v}`
      });
    });
  });

  // =========================
  // 2. DATA PER LEERLING
  // =========================
  const leerlingenSet = new Set();
  const matrix = {};        // leerling -> key -> aantal
  const kolomTotalen = {};  // key -> totaal

  kolommen.forEach(k => (kolomTotalen[k.key] = 0));

 snapshot.forEach(doc => {
  const d = doc.data();

  // ✅ juiste klas filteren
  if (d.leerling?.klas !== klas) return;

  // ✅ leerlingnaam ophalen
  const leerling = d.leerling?.naam || "Onbekend";
  leerlingenSet.add(leerling);
  if (!matrix[leerling]) matrix[leerling] = {};

  // ✅ producten uit bestelling halen
  const producten = haalProductenUitBestelling(d);

  producten.forEach(p => {
    const key = `${p.naam}|||${p.variant}`;
    if (!matrix[leerling][key]) matrix[leerling][key] = 0;
    matrix[leerling][key] += p.aantal;

    if (kolomTotalen[key] !== undefined) {
      kolomTotalen[key] += p.aantal;
    }
  });
});


  const leerlingen = Array.from(leerlingenSet).sort((a, b) =>
    a.localeCompare(b, "nl")
  );

  // =========================
  // 3. PDF OPMAAK
  // =========================
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  const marginL = 10;
  const marginT = 15;
  const rowH = 8;
  const nameColW = 45;

  const usableW = pageW - marginL * 2 - nameColW;
  const colW = Math.min(24, usableW / kolommen.length);

  let y = marginT;

  // Titel
  pdf.setFontSize(16);
  pdf.setFont(undefined, "bold");
  pdf.text(`Schoolverkoop – Klas ${klas}`, marginL, y);
  y += 12;

  pdf.setFontSize(9);

  // =========================
  // 4. KOPRIJ 1 – PRODUCT
  // =========================
  pdf.rect(marginL, y, nameColW, rowH);
  pdf.text("Leerling", marginL + 2, y + 5);

  kolommen.forEach((k, i) => {
    const x = marginL + nameColW + i * colW;
    pdf.rect(x, y, colW, rowH);
    pdf.text(k.product, x + 1, y + 5);
  });

  y += rowH;

  // =========================
  // 5. KOPRIJ 2 – VARIANT
  // =========================
  pdf.rect(marginL, y, nameColW, rowH);

  kolommen.forEach((k, i) => {
    const x = marginL + nameColW + i * colW;
    pdf.rect(x, y, colW, rowH);
    pdf.text(k.variant, x + colW / 2, y + 5, { align: "center" });
  });

  y += rowH;
  pdf.setFont(undefined, "normal");

  // =========================
  // 6. LEERLINGENRIJEN
  // =========================
  leerlingen.forEach(leerling => {
    if (y + rowH > pageH - marginT) {
      pdf.addPage();
      y = marginT;
    }

    pdf.rect(marginL, y, nameColW, rowH);
    pdf.text(leerling, marginL + 2, y + 5);

    kolommen.forEach((k, i) => {
      const x = marginL + nameColW + i * colW;
      pdf.rect(x, y, colW, rowH);

      const aantal =
        matrix[leerling] && matrix[leerling][k.key]
          ? String(matrix[leerling][k.key])
          : "–";

      pdf.text(aantal, x + colW / 2, y + 5, { align: "center" });
    });

    y += rowH;
  });

// =========================
// 7. TOTAALRIJ ONDERAAN
// =========================
if (y + rowH > pageH - marginT) {
  pdf.addPage();
  y = marginT;
}

// ----------
// LICHTGRIJZE ACHTERGROND (1 grote strook)
// ----------
pdf.setFillColor(230, 230, 230); // lichtgrijs
pdf.rect(
  marginL,
  y,
  nameColW + kolommen.length * colW,
  rowH,
  "F"
);

// ----------
// TEKST + RASTER
// ----------
pdf.setDrawColor(0, 0, 0);
pdf.setTextColor(0, 0, 0);
pdf.setFont(undefined, "bold");

// cel: TOTAAL
pdf.rect(marginL, y, nameColW, rowH);
pdf.text("TOTAAL", marginL + 2, y + 5);

// productcellen
kolommen.forEach((k, i) => {
  const x = marginL + nameColW + i * colW;

  pdf.rect(x, y, colW, rowH);

  const totaal =
    kolomTotalen[k.key] && kolomTotalen[k.key] > 0
      ? String(kolomTotalen[k.key])
      : "–";

  pdf.text(totaal, x + colW / 2, y + 5, { align: "center" });
});

// reset
pdf.setFont(undefined, "normal");
pdf.setTextColor(0, 0, 0);

  pdf.save(`schoolverkoop_${klas}.pdf`);
}

window.verzamelBestellingenPerKind = verzamelBestellingenPerKind;
window.testPdfVoorEénKind = testPdfVoorEénKind;


// ============================
// EVENTS
// ============================
const btnPdfKerstrozen = document.getElementById("downloadPdfKerstrozen");
const btnPdfTruffels = document.getElementById("downloadPdfTruffels");

if (btnPdfKerstrozen) {
  btnPdfKerstrozen.addEventListener("click", () => {
    genereerPdfKerstrozen();
  });
}

if (btnPdfTruffels) {
  btnPdfTruffels.addEventListener("click", () => {
    genereerPdfTruffels();
  });
}



klasFilter.addEventListener("change", () => {
  laadTotaalPerKlas(klasFilter.value);
});

downloadPdfBtn.addEventListener("click", () => {
  if (!klasFilter.value) {
    alert("Kies eerst een klas.");
    return;
  }
  genereerPdfPerKlas(klasFilter.value);
});

downloadPdfPerKind.addEventListener("click", () => {
  const klas = klasFilter.value;

  if (!klas) {
    alert("Kies eerst een klas.");
    return;
  }

  genereerPdfPerKind(klas);
});
// ============================
// LEVERANCIERS-PDF (2 aparte bestanden)
// - leverancier_truffels.pdf
// - leverancier_kerstrozen.pdf
// Met logo + schoolgegevens bovenaan en facturatiegegevens onderaan
// ============================

async function _loadImageAsDataURL(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Kon logo niet laden: " + url);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function _tekenKopEnVoet(pdf, titel) {
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  // Logo (geschaald) + schoolgegevens
  const logoDataUrl = await _loadImageAsDataURL("afbeeldingen/schoollogo.png");

  // Logo links (kleiner maken)
  pdf.addImage(logoDataUrl, "PNG", 15, 10, 22, 22);

  // Schooltekst naast logo
  pdf.setFontSize(11);
  pdf.setFont(undefined, "bold");
  pdf.text("GO! Basisschool De Linde", 42, 18);

  pdf.setFont(undefined, "normal");
  pdf.text("Lindestraat 123a", 42, 24);
  pdf.text("2880 Bornem", 42, 30);

  // Titel
  pdf.setFontSize(15);
  pdf.setFont(undefined, "bold");
  pdf.text(titel, pageW / 2, 45, { align: "center" });

  // Voettekst (facturatie)
  pdf.setFontSize(9);
  pdf.setFont(undefined, "normal");
  pdf.text(
    "BTW-nummer: BE0850.037.427  •  e-mail: administratie@bsdelinde.net",
    pageW / 2,
    pageH - 12,
    { align: "center" }
  );

  // y-start voor inhoud
  return 55;
}

function _tekenKaderTitel(pdf, x, y, w, titel) {
  pdf.setFillColor(245, 247, 249); // lichtgrijs
  pdf.rect(x, y, w, 10, "F");
  pdf.setDrawColor(200, 200, 200);
  pdf.rect(x, y, w, 10);

  pdf.setFontSize(12);
  pdf.setFont(undefined, "bold");
  pdf.text(titel, x + 4, y + 7);

  return y + 14;
}

// ----------------------------
// FACTUUR-BALK IN PDF (groene balk met "Te betalen aan leverancier")
// ----------------------------
function _tekenFactuurBalk(pdf, x, y, w, label, bedrag) {
  const h = 11;
  pdf.setFillColor(230, 240, 234);  // licht groen
  pdf.setDrawColor(45, 125, 78);    // groene rand (bovenlijn)
  pdf.setLineWidth(0.6);
  pdf.rect(x, y, w, h, "F");
  // Bovenlijn dikker voor visueel effect
  pdf.line(x, y, x + w, y);
  pdf.setLineWidth(0.2);

  pdf.setTextColor(26, 92, 58);     // donkergroen voor tekst
  pdf.setFont(undefined, "bold");
  pdf.setFontSize(12);
  pdf.text(label, x + 5, y + 7.5);
  pdf.text(bedrag, x + w - 5, y + 7.5, { align: "right" });

  // reset
  pdf.setTextColor(0, 0, 0);
  pdf.setFont(undefined, "normal");
  return y + h + 6;
}

// ----------------------------
// KERSTROZEN-TABEL IN PDF
// product | variant | aantal | prijs/stuk | totaal + totaalrij
// ----------------------------
function _tekenKerstrozenTabel(pdf, x, y, w, data, inkoopMap) {
  // Kolom-x-posities: Product links, Variant iets verder,
  // rechts-uitgelijnde cijferkolommen met voldoende ruimte ertussen.
  // Voor A4 portrait met w ≈ 170mm:
  //   Product (links) | Variant (links) | Aantal (rechts) | Prijs (rechts) | Totaal (rechts)
  const xProduct = x + 5;
  const xVariant = x + 55;
  const xAantal = x + 100;   // tekst eindigt hier (rechts-uitgelijnd)
  const xPrijs = x + 135;    // tekst eindigt hier
  const xTotaal = x + w - 5; // tekst eindigt hier (helemaal rechts)

  pdf.setFontSize(11);

  // Kolomkoppen
  pdf.setFont(undefined, "bold");
  pdf.setFillColor(252, 252, 252);
  pdf.rect(x, y - 5, w, 7, "F");
  pdf.text("Product", xProduct, y);
  pdf.text("Variant", xVariant, y);
  pdf.text("Aantal", xAantal, y, { align: "right" });
  pdf.text("Prijs/stuk", xPrijs, y, { align: "right" });
  pdf.text("Totaal", xTotaal, y, { align: "right" });
  y += 3;
  pdf.setDrawColor(210);
  pdf.line(x, y, x + w, y);
  y += 6;
  pdf.setFont(undefined, "normal");

  const keys = Object.keys(data);

  if (keys.length === 0) {
    pdf.setTextColor(130, 130, 130);
    pdf.text("Geen bestellingen", xProduct, y);
    pdf.setTextColor(0, 0, 0);
    return { y: y + 6, factuur: 0 };
  }

  let totaal = 0;
  let factuur = 0;

  keys.forEach(k => {
    const [naam, variant] = k.split("|||");
    const aantal = data[k];
    totaal += aantal;

    const inkKey = inkoopKeyVoor(naam, variant);
    const prijs = inkKey ? Number(inkoopMap[inkKey] || 0) : 0;
    const regelTotaal = prijs * aantal;
    factuur += regelTotaal;

    pdf.text(naam, xProduct, y);
    pdf.text(variant, xVariant, y);
    pdf.text(String(aantal), xAantal, y, { align: "right" });
    pdf.text(prijs > 0 ? euro(prijs) : "–", xPrijs, y, { align: "right" });
    pdf.text(prijs > 0 ? euro(regelTotaal) : "–", xTotaal, y, { align: "right" });
    y += 6.5;
  });

  // Totaalrij
  y += 1;
  pdf.setDrawColor(180);
  pdf.line(x, y - 3, x + w, y - 3);
  pdf.setFont(undefined, "bold");
  pdf.text("Totaal kerstrozen", xProduct, y + 2);
  pdf.text(String(totaal), xAantal, y + 2, { align: "right" });
  pdf.text(euro(factuur), xTotaal, y + 2, { align: "right" });
  pdf.setFont(undefined, "normal");
  y += 8;

  return { y, factuur };
}

// ----------------------------
// TRUFFEL-TABEL IN PDF (landscape: 7 kolommen)
// smaak | verkocht | grote dozen | bestellen | overschot | prijs/stuk | totaal
// ----------------------------
function _tekenTruffelTabel(pdf, x, y, w, data, perGroteDoos, inkoopMap) {
  // x-posities voor 7 kolommen (landscape, w ≈ 267mm)
  // Smaak links, de rest rechts-uitgelijnd met ruime tussenafstand.
  const xSmaak = x + 5;
  const xVerkocht = x + w - 220;
  const xGrote = x + w - 175;
  const xBestellen = x + w - 130;
  const xOverschot = x + w - 90;
  const xPrijs = x + w - 50;
  const xTotaal = x + w - 5;

  // Kolomkoppen
  pdf.setFont(undefined, "bold");
  pdf.setFontSize(10);
  pdf.setFillColor(252, 252, 252);
  pdf.rect(x, y - 5, w, 7, "F");
  pdf.text("Smaak", xSmaak, y);
  pdf.text("Verkocht", xVerkocht, y, { align: "right" });
  pdf.text("Grote dozen", xGrote, y, { align: "right" });
  pdf.text("Bestellen", xBestellen, y, { align: "right" });
  pdf.text("Overschot", xOverschot, y, { align: "right" });
  pdf.text("Prijs/stuk", xPrijs, y, { align: "right" });
  pdf.text("Totaal", xTotaal, y, { align: "right" });
  y += 3;
  pdf.setDrawColor(210);
  pdf.line(x, y, x + w, y);
  y += 6;
  pdf.setFont(undefined, "normal");
  pdf.setFontSize(11);

  const keys = Object.keys(data);

  if (keys.length === 0) {
    pdf.setTextColor(130, 130, 130);
    pdf.text("Geen bestellingen", xSmaak, y);
    pdf.setTextColor(0, 0, 0);
    return { y: y + 6, factuur: 0 };
  }

  let totVerkocht = 0;
  let totGrote = 0;
  let totBestellen = 0;
  let totOverschot = 0;
  let totFactuur = 0;

  keys.forEach(k => {
    const [naam, variant] = k.split("|||");
    const verkocht = data[k];
    const info = berekenDozenInfo(verkocht, perGroteDoos);

    totVerkocht += verkocht;
    totGrote += info.grote;
    totBestellen += info.bestellen;
    totOverschot += info.overschot;

    const inkKey = inkoopKeyVoor(naam, variant);
    const prijs = inkKey ? Number(inkoopMap[inkKey] || 0) : 0;
    // factuur = bestellen × prijs (inclusief overschot — dat is wat er gefactureerd wordt)
    const regelFactuur = prijs * info.bestellen;
    totFactuur += regelFactuur;

    pdf.text(variant, xSmaak, y);
    pdf.text(String(verkocht), xVerkocht, y, { align: "right" });
    pdf.text(String(info.grote), xGrote, y, { align: "right" });
    pdf.text(String(info.bestellen), xBestellen, y, { align: "right" });
    pdf.text(String(info.overschot), xOverschot, y, { align: "right" });
    pdf.text(prijs > 0 ? euro(prijs) : "–", xPrijs, y, { align: "right" });
    pdf.text(prijs > 0 ? euro(regelFactuur) : "–", xTotaal, y, { align: "right" });
    y += 6.5;
  });

  // Totaalrij
  y += 1;
  pdf.setDrawColor(180);
  pdf.line(x, y - 3, x + w, y - 3);
  pdf.setFont(undefined, "bold");
  pdf.text("Totaal", xSmaak, y + 2);
  pdf.text(String(totVerkocht), xVerkocht, y + 2, { align: "right" });
  pdf.text(String(totGrote), xGrote, y + 2, { align: "right" });
  pdf.text(String(totBestellen), xBestellen, y + 2, { align: "right" });
  pdf.text(String(totOverschot), xOverschot, y + 2, { align: "right" });
  pdf.text(euro(totFactuur), xTotaal, y + 2, { align: "right" });
  pdf.setFont(undefined, "normal");
  y += 8;

  // Info-regeltje onder de tabel
  pdf.setFontSize(9);
  pdf.setTextColor(110, 110, 110);
  pdf.text(
    `${perGroteDoos} doosjes per grote doos • "Bestellen" = aantal grote dozen × ${perGroteDoos} • "Totaal" = bestellen × prijs/stuk`,
    x,
    y + 2
  );
  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(11);
  y += 6;

  return { y, factuur: totFactuur };
}

async function genereerPdfTruffels() {
  const { jsPDF } = window.jspdf;
  // ⭐ LANDSCAPE — 7 kolommen passen niet netjes op portrait
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  let y = await _tekenKopEnVoet(pdf, "Overzicht leverancier – Truffels");

  const inkoopMap = leesInkoopMap();

  const x = 15;
  const pageW = pdf.internal.pageSize.getWidth();
  const w = pageW - x * 2;

  // Truffels 250 g
  y = _tekenKaderTitel(pdf, x, y, w, "Truffels 250 g");
  const res250 = _tekenTruffelTabel(
    pdf, x, y, w,
    leveranciersData.Truffels250,
    DOZEN_PER_GROTE_DOOS.truffel250,
    inkoopMap
  );
  y = res250.y + 6;

  // Truffels 500 g
  y = _tekenKaderTitel(pdf, x, y, w, "Truffels 500 g");
  const res500 = _tekenTruffelTabel(
    pdf, x, y, w,
    leveranciersData.Truffels500,
    DOZEN_PER_GROTE_DOOS.truffel500,
    inkoopMap
  );
  y = res500.y + 8;

  // Gezamenlijke factuurbalk
  const totaalTruffels = res250.factuur + res500.factuur;
  if (totaalTruffels > 0) {
    _tekenFactuurBalk(
      pdf, x, y, w,
      "Te betalen aan leverancier truffels (250 g + 500 g)",
      euro(totaalTruffels)
    );
  }

  pdf.save("leverancier_truffels.pdf");
}

async function genereerPdfKerstrozen() {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  let y = await _tekenKopEnVoet(pdf, "Overzicht leverancier – Kerstrozen");

  const inkoopMap = leesInkoopMap();

  const x = 20;
  const pageW = pdf.internal.pageSize.getWidth();
  const w = pageW - x * 2;

  y = _tekenKaderTitel(pdf, x, y, w, "Kerstrozen");
  const res = _tekenKerstrozenTabel(pdf, x, y, w, leveranciersData.Kerstrozen, inkoopMap);
  y = res.y + 6;

  if (res.factuur > 0) {
    _tekenFactuurBalk(
      pdf, x, y, w,
      "Te betalen aan leverancier kerstrozen",
      euro(res.factuur)
    );
  }

  pdf.save("leverancier_kerstrozen.pdf");
}

// Deze functie blijft de "entry point" voor je bestaande knop
async function genereerLeveranciersPdf() {
  // Eerst truffels, daarna kerstrozen (2 aparte downloads)
  await genereerPdfTruffels();
  await genereerPdfKerstrozen();
}


// ============================
// SPONSORING – laden, tonen, PDF
// ============================
let sponsorLijst = []; // { koperNaam, koperEmail, leerling, klas, bedrag, datum }

async function laadSponsoring() {
  const snapshot = await getDocs(
    query(
      collection(db, "bestellingen_test"),
      where("actieId", "==", ACTIEVE_ACTIE)
    )
  );

  sponsorLijst = [];

  snapshot.forEach(doc => {
    const d = doc.data();
    const bedrag = Number(d.sponsorBedrag || 0);
    if (bedrag <= 0) return;

    sponsorLijst.push({
      koperNaam: d.koper?.naam || "Onbekend",
      koperEmail: d.koper?.email || "",
      leerling: d.leerling?.naam || "",
      klas: d.leerling?.klas || "",
      bedrag
    });
  });

  // Alfabetisch op koper sorteren
  sponsorLijst.sort((a, b) =>
    a.koperNaam.localeCompare(b.koperNaam, "nl")
  );

  renderSponsoring();
}

function renderSponsoring() {
  const tbody = document.getElementById("tabelSponsoring");
  const totaalBedragEl = document.getElementById("sponsorTotaalBedrag");
  const aantalEl = document.getElementById("sponsorAantal");
  const metaSp = document.getElementById("tabMetaSponsoring");

  if (!tbody) return;
  tbody.innerHTML = "";

  let totaal = 0;

  if (sponsorLijst.length === 0) {
    tbody.innerHTML =
      `<tr><td colspan="5" class="muted">Nog geen sponsorbijdragen</td></tr>`;
    if (totaalBedragEl) totaalBedragEl.textContent = euro(0);
    if (aantalEl) aantalEl.textContent = "";
    if (metaSp) metaSp.textContent = "geen";
    return;
  }

  sponsorLijst.forEach(s => {
    totaal += s.bedrag;
    const leerlingLabel = s.leerling
      ? `${s.leerling} (${s.klas})`
      : `(${s.klas})`;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${s.koperNaam}</td>
      <td>${s.koperEmail}</td>
      <td>${s.leerling}</td>
      <td>${s.klas}</td>
      <td class="num">${euro(s.bedrag)}</td>
    `;
    tbody.appendChild(tr);
  });

  if (totaalBedragEl) totaalBedragEl.textContent = euro(totaal);
  if (aantalEl) aantalEl.textContent =
    `(${sponsorLijst.length} ${sponsorLijst.length === 1 ? "bijdrage" : "bijdragen"})`;
  if (metaSp) metaSp.textContent = `${sponsorLijst.length} · ${euro(totaal)}`;
}

async function genereerPdfSponsoring() {
  if (sponsorLijst.length === 0) {
    alert("Er zijn nog geen sponsorbijdragen.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  let y = await _tekenKopEnVoet(pdf, "Overzicht sponsoring");

  const x = 20;
  const pageW = pdf.internal.pageSize.getWidth();
  const w = pageW - x * 2;

  y = _tekenKaderTitel(pdf, x, y, w, "Sponsorbijdragen");

  // Kolom-x-posities
  const xKoper = x + 5;
  const xLeerling = x + 75;
  const xKlas = x + 135;
  const xBedrag = x + w - 5;

  // Kolomkoppen
  pdf.setFont(undefined, "bold");
  pdf.setFontSize(11);
  pdf.text("Koper", xKoper, y);
  pdf.text("Via leerling", xLeerling, y);
  pdf.text("Klas", xKlas, y);
  pdf.text("Bedrag", xBedrag, y, { align: "right" });
  y += 3;
  pdf.setDrawColor(210);
  pdf.line(x, y, x + w, y);
  y += 6;
  pdf.setFont(undefined, "normal");

  let totaal = 0;
  const pageH = pdf.internal.pageSize.getHeight();

  sponsorLijst.forEach(s => {
    if (y > pageH - 25) {
      pdf.addPage();
      y = 25;
    }
    totaal += s.bedrag;

    const koperTekst = s.koperNaam.length > 30
      ? s.koperNaam.slice(0, 29) + "…"
      : s.koperNaam;
    const leerlingTekst = (s.leerling || "").length > 22
      ? s.leerling.slice(0, 21) + "…"
      : (s.leerling || "");

    pdf.text(koperTekst, xKoper, y);
    pdf.text(leerlingTekst, xLeerling, y);
    pdf.text(s.klas || "", xKlas, y);
    pdf.text(euro(s.bedrag), xBedrag, y, { align: "right" });
    y += 6.5;
  });

  // Totaalrij
  y += 2;
  pdf.setDrawColor(180);
  pdf.line(x, y - 3, x + w, y - 3);
  pdf.setFont(undefined, "bold");
  pdf.text(`Totaal (${sponsorLijst.length} bijdragen)`, xKoper, y + 2);
  pdf.text(euro(totaal), xBedrag, y + 2, { align: "right" });
  y += 10;

  // Groene factuurbalk-achtige regel
  pdf.setFillColor(230, 240, 234);
  pdf.setDrawColor(45, 125, 78);
  pdf.setLineWidth(0.6);
  pdf.rect(x, y, w, 11, "F");
  pdf.line(x, y, x + w, y);
  pdf.setLineWidth(0.2);
  pdf.setTextColor(26, 92, 58);
  pdf.setFontSize(12);
  pdf.text("Totale sponsorbijdrage", x + 5, y + 7.5);
  pdf.text(euro(totaal), x + w - 5, y + 7.5, { align: "right" });
  pdf.setTextColor(0, 0, 0);

  pdf.save("sponsoring.pdf");
}

// ============================
// TABBLADEN (compacte knoppenbalk)
// ============================
function activeerTab(tabNaam) {
  document.querySelectorAll(".tab-knop").forEach(btn => {
    const actief = btn.dataset.tab === tabNaam;
    btn.setAttribute("aria-selected", actief ? "true" : "false");
  });
  document.querySelectorAll(".tab-panel").forEach(panel => {
    panel.hidden = panel.dataset.panel !== tabNaam;
  });
  const hint = document.getElementById("tabHint");
  if (hint) hint.hidden = true;
}

function bindTabKnoppen() {
  document.querySelectorAll(".tab-knop").forEach(btn => {
    btn.addEventListener("click", () => activeerTab(btn.dataset.tab));
  });
}

// ============================
// META-LABELS IN TABS BIJWERKEN
// (vb. "5 • € 12,50" naast 'Kerstrozen')
// ============================
function updateTabMetas() {
  const metaK = document.getElementById("tabMetaKerstrozen");
  const metaT = document.getElementById("tabMetaTruffels");

  // Kerstrozen: aantal + factuur
  let aantalK = 0;
  Object.values(leveranciersData.Kerstrozen || {}).forEach(v => aantalK += v);
  if (metaK) {
    if (aantalK === 0) {
      metaK.textContent = "geen bestellingen";
    } else {
      const factuur = leveranciersData._kerstrozenFactuur || 0;
      metaK.textContent = factuur > 0
        ? `${aantalK} stuks • ${euro(factuur)}`
        : `${aantalK} stuks`;
    }
  }

  // Truffels: aantal doosjes over beide gewichten + gezamenlijke factuur
  let aantalT = 0;
  Object.values(leveranciersData.Truffels250 || {}).forEach(v => aantalT += v);
  Object.values(leveranciersData.Truffels500 || {}).forEach(v => aantalT += v);
  if (metaT) {
    if (aantalT === 0) {
      metaT.textContent = "geen bestellingen";
    } else {
      const factuur = leveranciersData._truffelsFactuur || 0;
      metaT.textContent = factuur > 0
        ? `${aantalT} doosjes • ${euro(factuur)}`
        : `${aantalT} doosjes`;
    }
  }
}

// ============================
// INIT
// ============================
bindTabKnoppen();

// Eerst Firestore-inkoopprijzen cachen, dán renderen (zodat prijzen meteen juist zijn)
laadInkoopMapVanFirestore()
  .then(() => laadTotaalPerProduct())
  .then(updateTabMetas);
laadSponsoring();

// Automatisch bijwerken als iemand terugkomt van de winstpagina
window.addEventListener("focus", () => {
  laadInkoopMapVanFirestore()
    .then(() => laadTotaalPerProduct())
    .then(updateTabMetas);
  laadSponsoring();
});

const winstBtn = document.getElementById("openWinstBerekening");

if (winstBtn) {
  winstBtn.addEventListener("click", () => {
    window.location.href = "winst.html";
  });
}

const sponsorPdfBtn = document.getElementById("downloadPdfSponsoring");
if (sponsorPdfBtn) {
  sponsorPdfBtn.addEventListener("click", genereerPdfSponsoring);
}
