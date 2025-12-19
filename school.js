function haalProductenUitBestelling(data) {
  return Object.values(data.bestelling || {});
}

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";


// 🔹 Actieve verkoopactie
const ACTIEVE_ACTIE = "kerstverkoop_2026";

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


  // niets besteld
  if (
  Object.keys(leveranciers.Kerstrozen).length === 0
) {
  tabelKerstrozen.innerHTML =
    `<tr><td colspan="3" class="muted">Geen bestellingen</td></tr>`;
}

  // Kerstrozen
  if (Object.keys(leveranciers.Kerstrozen).length > 0) {
  Object.keys(leveranciers.Kerstrozen).forEach(k => {
    const [naam, variant] = k.split("|||");
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${naam}</td><td>${variant}</td><td>${leveranciers.Kerstrozen[k]}</td>`;
    tabelKerstrozen.appendChild(tr);
  });
}


  // Truffels 250 g
Object.keys(leveranciers.Truffels250).forEach(k => {
  const [naam, variant] = k.split("|||");
  const tr = document.createElement("tr");
  tr.innerHTML = `<td>${naam}</td><td>${variant}</td><td>${leveranciers.Truffels250[k]}</td>`;
  tabelTruffels250.appendChild(tr);
});

// Truffels 500 g
Object.keys(leveranciers.Truffels500).forEach(k => {
  const [naam, variant] = k.split("|||");
  const tr = document.createElement("tr");
  tr.innerHTML = `<td>${naam}</td><td>${variant}</td><td>${leveranciers.Truffels500[k]}</td>`;
  tabelTruffels500.appendChild(tr);
});


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

  pdf.text(
    `${item.naam} – ${item.variant}: ${item.aantal} × €${item.prijs} = €${regelTotaal}`,
    marginL + 5,
    y
  );
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

        pdf.text(
          `${item.naam} – ${item.variant}: ${item.aantal} × €${item.prijs} = €${regelTotaal}`,
          marginL + 5,
          y
        );
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
    { naam: "Truffel 500 g", varianten: ["wit", "melk", "donker"] }
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

function _tekenTabelRijen(pdf, x, y, w, rows) {
  pdf.setFontSize(11);
  pdf.setFont(undefined, "normal");

  rows.forEach(row => {
    pdf.text(row.cells[0].innerText, x + 5, y);                 // product
    pdf.text(row.cells[1].innerText, x + 90, y);                // variant
    pdf.text(row.cells[2].innerText, x + w - 10, y, { align: "right" }); // aantal
    y += 6.5;
  });

  return y;
}

async function genereerPdfTruffels() {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  let y = await _tekenKopEnVoet(pdf, "Overzicht leverancier – Truffels");

  const x = 20;
  const pageW = pdf.internal.pageSize.getWidth();
  const w = pageW - x * 2;

  // Truffels 250 g
  y = _tekenKaderTitel(pdf, x, y, w, "Truffels 250 g");
  y = _tekenTabelRijen(pdf, x, y, w, [...tabelTruffels250.rows]);
  y += 10;

  // Truffels 500 g
  y = _tekenKaderTitel(pdf, x, y, w, "Truffels 500 g");
  y = _tekenTabelRijen(pdf, x, y, w, [...tabelTruffels500.rows]);

  pdf.save("leverancier_truffels.pdf");
}

async function genereerPdfKerstrozen() {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  let y = await _tekenKopEnVoet(pdf, "Overzicht leverancier – Kerstrozen");

  const x = 20;
  const pageW = pdf.internal.pageSize.getWidth();
  const w = pageW - x * 2;

  y = _tekenKaderTitel(pdf, x, y, w, "Kerstrozen");
  y = _tekenTabelRijen(pdf, x, y, w, [...tabelKerstrozen.rows]);

  pdf.save("leverancier_kerstrozen.pdf");
}

// Deze functie blijft de "entry point" voor je bestaande knop
async function genereerLeveranciersPdf() {
  // Eerst truffels, daarna kerstrozen (2 aparte downloads)
  await genereerPdfTruffels();
  await genereerPdfKerstrozen();
}


// ============================
// INIT
// ============================
laadTotaalPerProduct();
const winstBtn = document.getElementById("openWinstBerekening");

if (winstBtn) {
  winstBtn.addEventListener("click", () => {
    window.location.href = "winst.html";
  });
}
