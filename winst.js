// ===============================
// WINST.JS – PER PRODUCT + PDF
// ===============================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// 🔹 Firebase configuratie (identiek aan jouw huidige)
const firebaseConfig = {
  apiKey: "AIzaSyD4Pd3z6WpGbDwtpKV5glvrvJ5Ks-qCPz0",
  authDomain: "schoolverkoop-3d82d.firebaseapp.com",
  projectId: "schoolverkoop-3d82d",
  storageBucket: "schoolverkoop-3d82d.firebasestorage.app",
  messagingSenderId: "74076660432",
  appId: "1:74076660432:web:2e94c19700a076458cb4d5"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 🔹 Actieve verkoopactie
const ACTIEVE_ACTIE = "kerstverkoop_2026";

// 🔹 Verpakkingseenheden
// Truffels worden per grote doos geleverd. Het bedrijf rondt naar boven af,
// dus de inkoopkost geldt over het volledige geleverde aantal (incl. overschot).
const DOZEN_PER_GROTE_DOOS = {
  truffels_250: 12,
  truffels_500: 8
};

// Welke key uit DOZEN_PER_GROTE_DOOS gebruiken we voor een gegeven product?
function verpakkingKeyVoor(productKey) {
  if (productKey.startsWith("truffels_250")) return "truffels_250";
  if (productKey.startsWith("truffels_500")) return "truffels_500";
  return null; // bv. kerstrozen → geen verpakkingseenheid
}

function berekenDozenInfo(verkocht, perGroteDoos) {
  const grote = verkocht > 0 ? Math.ceil(verkocht / perGroteDoos) : 0;
  const bestellen = grote * perGroteDoos;
  const overschot = bestellen - verkocht;
  return { grote, bestellen, overschot };
}

// localStorage keys
const LS_SETTINGS = `winst_${ACTIEVE_ACTIE}_settings`;
const LS_INKOOP = `winst_${ACTIEVE_ACTIE}_inkoopprijzen`;

// State
let aantalBestellingen = 0;
let totaleOmzet = 0;
let productenLijst = []; // {key, leverancier, productLabel, verkoopprijs, aantal, omzet}
let inkoopMap = {};      // key -> inkoop/stuk (number)

// ===============================
// VASTE PRODUCTLIJST (altijd zichtbaar, ook zonder verkoop)
// ===============================
const PRODUCTEN_VAST = [
  // Kerstrozen
  { leverancier: "Kerstrozen", key: "kerstrozen_wit", label: "Kerstrozen – wit", verkoopprijs: 4.00 },
  { leverancier: "Kerstrozen", key: "kerstrozen_rood", label: "Kerstrozen – rood", verkoopprijs: 4.00 },
  { leverancier: "Kerstrozen", key: "kerstrozen_roze", label: "Kerstrozen – roze", verkoopprijs: 4.00 },

  // Truffels 250 g
  { leverancier: "Truffels", key: "truffels_250_donker", label: "Truffels 250 g – donker", verkoopprijs: 6.00 },
  { leverancier: "Truffels", key: "truffels_250_melk",   label: "Truffels 250 g – melk",   verkoopprijs: 6.00 },
  { leverancier: "Truffels", key: "truffels_250_wit",    label: "Truffels 250 g – wit",    verkoopprijs: 6.00 },

  // Truffels 500 g
  { leverancier: "Truffels", key: "truffels_500_donker", label: "Truffels 500 g – donker", verkoopprijs: 12.00 },
  { leverancier: "Truffels", key: "truffels_500_melk",   label: "Truffels 500 g – melk",   verkoopprijs: 12.00 },
  { leverancier: "Truffels", key: "truffels_500_wit",    label: "Truffels 500 g – wit",    verkoopprijs: 12.00 }
];
// ===============================
// Lookup: productLabel → vaste key
// ===============================
const PRODUCT_KEY_LOOKUP = {};
PRODUCTEN_VAST.forEach(p => {
  PRODUCT_KEY_LOOKUP[p.label.toLowerCase()] = p.key;
});

// Samengevat winstoverzicht per leverancier (voor PDF & UI)
let winstOverzicht = {
  truffels: { omzet: 0, inkoop: 0, winst: 0 },
  kerstrozen: { omzet: 0, inkoop: 0, winst: 0 }
};

// ===============================
// Helpers
// ===============================
function euro(n) {
  const v = Number(n || 0);
  return "€ " + v.toFixed(2).replace(".", ",");
}

// Getal parsen dat zowel "2,50" als "2.50" accepteert (BE + internationaal)
function parseGetal(str) {
  if (str === null || str === undefined || str === "") return 0;
  const s = String(str).replace(",", ".").trim();
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function leverancierVanItem(naamLower) {
  if (naamLower.includes("truffel")) return "Truffels";
  if (naamLower.includes("kerstroos") || naamLower.includes("kerstrozen")) return "Kerstrozen";
  return "Onbekend";
}

function loadLocal() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_SETTINGS) || "{}");
    if (typeof s.mollieKost !== "undefined") {
      // Toon opgeslagen waarde in Belgische komma-notatie
      document.getElementById("mollieKost").value =
        Number(s.mollieKost).toFixed(2).replace(".", ",");
    }
    if (typeof s.transportKost !== "undefined") {
      document.getElementById("transportKost").value =
        Number(s.transportKost).toFixed(2).replace(".", ",");
    }
  } catch {}

  try {
    inkoopMap = JSON.parse(localStorage.getItem(LS_INKOOP) || "{}") || {};
  } catch {
    inkoopMap = {};
  }
}

function saveLocalSettings() {
  // Komma wordt geaccepteerd dankzij parseGetal
  const mollieKost = parseGetal(document.getElementById("mollieKost").value);
  const transportKost = parseGetal(document.getElementById("transportKost").value);
  localStorage.setItem(LS_SETTINGS, JSON.stringify({ mollieKost, transportKost }));
}

function saveLocalInkoop() {
  localStorage.setItem(LS_INKOOP, JSON.stringify(inkoopMap || {}));
}

// ===============================
// Init
// ===============================
document.addEventListener("DOMContentLoaded", () => {

  // terugknop
  const terugBtn = document.getElementById("terugNaarOverzicht");
  if (terugBtn) {
    terugBtn.addEventListener("click", () => {
      window.location.href = "school.html";
    });
  }

  // pdf knop
  const downloadBtn = document.getElementById("downloadWinstPdf");
  if (downloadBtn) {
    downloadBtn.addEventListener("click", downloadWinstPdf);
  }

  // load local values
  loadLocal();

  // live herberekenen bij wijziging van kosten
  const mollieEl = document.getElementById("mollieKost");
  const transportEl = document.getElementById("transportKost");

  mollieEl.addEventListener("input", () => {
    saveLocalSettings();
    herberekenAlles();
  });
  transportEl.addEventListener("input", () => {
    saveLocalSettings();
    herberekenAlles();
  });

  // Bij verlaten van het veld: mooi formatteren (bv. "2,5" → "2,50")
  mollieEl.addEventListener("blur", () => {
    const n = parseGetal(mollieEl.value);
    mollieEl.value = n.toFixed(2).replace(".", ",");
  });
  transportEl.addEventListener("blur", () => {
    const n = parseGetal(transportEl.value);
    transportEl.value = n.toFixed(2).replace(".", ",");
  });

  // data laden
  laadBasisGegevens();
});

// ===============================
// Data ophalen & tabel bouwen
// ===============================
async function laadBasisGegevens() {
  try {
        // ===============================
    // 1. Start met vaste productlijst
    // ===============================
    productenLijst = PRODUCTEN_VAST.map(p => ({
      key: p.key,
      leverancier: p.leverancier,
      productLabel: p.label,
      verkoopprijs: p.verkoopprijs,
      aantal: 0,
      omzet: 0
    }));

    const snapshot = await getDocs(
      query(
        collection(db, "bestellingen_test"),
        where("actieId", "==", ACTIEVE_ACTIE)
      )
    );

    // totals
    totaleOmzet = 0;
    aantalBestellingen = 0;

    // map per productKey (start van vaste producten)
const map = {};
productenLijst.forEach(p => {
  map[p.key] = {
    key: p.key,
    leverancier: p.leverancier,
    productLabel: p.productLabel,
    verkoopprijs: p.verkoopprijs,
    aantal: 0
  };
});


    snapshot.forEach(doc => {
      const data = doc.data();
      aantalBestellingen++;
      totaleOmzet += Number(data.totaal || 0);

      const items = Object.values(data.bestelling || {});
      items.forEach(item => {
        const naam = (item.naam || "").toString();
        const variant = (item.variant || "").toString();
        const prijs = Number(item.prijs || 0);
        const aantal = Number(item.aantal || 0);

        const leverancier = leverancierVanItem(naam.toLowerCase());
       const productLabel = variant ? `${naam} – ${variant}` : naam;

// 🔑 vaste key opzoeken via PRODUCTEN_VAST
const vasteKey = PRODUCT_KEY_LOOKUP[productLabel.toLowerCase()];
if (!vasteKey) return; // onbekend product → negeren

// ❗ alleen optellen, nooit nieuw product maken
map[vasteKey].aantal += aantal;

// verkoopprijs eventueel bijwerken
if (prijs > 0) {
  map[vasteKey].verkoopprijs = prijs;
}
      });
    });

    // naar lijst, sorteren per leverancier/product
    productenLijst = Object.values(map).map(p => {
      // effectiefAantal = aantal waarvoor we betalen (na afronding naar grote doos)
      // overschot = het verschil tussen betaald en verkocht (alleen bij truffels > 0)
      const verpakKey = verpakkingKeyVoor(p.key);
      let effectiefAantal = p.aantal;
      let overschot = 0;
      let groteDozen = 0;

      if (verpakKey) {
        const perGroteDoos = DOZEN_PER_GROTE_DOOS[verpakKey];
        const info = berekenDozenInfo(p.aantal, perGroteDoos);
        effectiefAantal = info.bestellen;
        overschot = info.overschot;
        groteDozen = info.grote;
      }

      return {
        ...p,
        omzet: p.verkoopprijs * p.aantal,
        effectiefAantal,
        overschot,
        groteDozen
      };
    }).sort((a, b) => {
      if (a.leverancier !== b.leverancier) return a.leverancier.localeCompare(b.leverancier);
      return a.productLabel.localeCompare(b.productLabel);
    });

    // samenvatting bovenaan
    document.getElementById("totaleOmzet").textContent = euro(totaleOmzet);
    document.getElementById("aantalBestellingen").textContent = String(aantalBestellingen);

    // tabel renderen
    renderWinstPerProductTabel();

    // eerste berekening
    herberekenAlles();

  } catch (error) {
    console.error("Fout bij laden winstgegevens:", error);
    alert("Fout bij laden winstgegevens. Kijk in de console (F12) voor details.");
  }
}

function renderWinstPerProductTabel() {
  const tbody = document.getElementById("winstPerProductBody");
  tbody.innerHTML = "";

  const perLeverancier = {};

  // producten groeperen
  productenLijst.forEach(p => {
    if (!perLeverancier[p.leverancier]) {
      perLeverancier[p.leverancier] = [];
    }
    perLeverancier[p.leverancier].push(p);
  });

  // per leverancier renderen
  Object.keys(perLeverancier).forEach(leverancier => {
    // --- HEADER ---
    const header = document.createElement("tr");
    header.className = "leverancier-header";
    header.innerHTML = `
      <td colspan="9">📦 ${leverancier}</td>
    `;
    tbody.appendChild(header);

    let subtotaalOmzet = 0;
    let subtotaalInkoop = 0;
    let subtotaalWinst = 0;

    // --- PRODUCTEN ---
    perLeverancier[leverancier].forEach(p => {
      const inkoopStuk = Number(inkoopMap[p.key] || 0);

      // ⭐ inkoop op basis van wat we ECHT betalen (na afronding naar grote doos)
      const totaleInkoop = inkoopStuk * p.effectiefAantal;
      const winst = p.omzet - totaleInkoop;

      subtotaalOmzet += p.omzet;
      subtotaalInkoop += totaleInkoop;
      subtotaalWinst += winst;

      // "Betaald voor" kolom:
      // - truffels: toont het effectieve aantal + hoeveelheid overschot in kleintjes
      // - kerstrozen: gewoon het aantal (= verkocht)
      let betaaldVoorCel;
      if (p.overschot > 0) {
        betaaldVoorCel = `
          ${p.effectiefAantal}
          <span class="overschot-badge" title="${p.groteDozen} grote dozen • ${p.overschot} overschot">
            +${p.overschot}
          </span>
        `;
      } else {
        betaaldVoorCel = `${p.effectiefAantal}`;
      }

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${p.leverancier}</td>
        <td>${p.productLabel}</td>
        <td class="num">${euro(p.verkoopprijs)}</td>
        <td class="num">${p.aantal}</td>
        <td class="num">${betaaldVoorCel}</td>
        <td class="num">${euro(p.omzet)}</td>
        <td class="num">
          <input
            class="inkoop-input"
            type="text"
            inputmode="decimal"
            placeholder="0,00"
            value="${inkoopStuk ? inkoopStuk.toFixed(2).replace(".", ",") : ""}"
            data-key="${p.key}"
          />
        </td>
        <td class="num">${euro(totaleInkoop)}</td>
        <td class="num">${euro(winst)}</td>
      `;
      tbody.appendChild(tr);
    });

    // --- SUBTOTAAL ---
    const subtotaal = document.createElement("tr");
    subtotaal.className = "subtotaal-rij";
    subtotaal.innerHTML = `
      <td colspan="5" class="label">Subtotaal ${leverancier}</td>
      <td class="num">${euro(subtotaalOmzet)}</td>
      <td></td>
      <td class="num">${euro(subtotaalInkoop)}</td>
      <td class="num">${euro(subtotaalWinst)}</td>
    `;
    tbody.appendChild(subtotaal);
  });

  // listeners opnieuw koppelen
  document.querySelectorAll(".inkoop-input").forEach(inp => {
    // Tijdens het typen: alleen de berekeningen bijwerken, GEEN herrender
    // (anders verspringt de cursor en kun je geen komma typen)
    inp.addEventListener("input", (e) => {
      const key = e.target.dataset.key;
      inkoopMap[key] = parseGetal(e.target.value);
      saveLocalInkoop();
      herberekenAlles();
    });

    // Bij verlaten van het veld: volledige tabel herrenderen
    // zodat de waarde mooi geformatteerd verschijnt (bv. "2,5" → "2,50")
    inp.addEventListener("blur", () => {
      renderWinstPerProductTabel();
      herberekenAlles();
    });
  });
}

// ===============================
// HERBEREKEN ALLES
// ===============================
function herberekenAlles() {
  let totaalInkoop = 0;

  let omzetTruffels = 0;
  let inkoopTruffels = 0;
  let winstTruffels = 0;

  let omzetKerstrozen = 0;
  let inkoopKerstrozen = 0;
  let winstKerstrozen = 0;

  let bestProduct = null;

  productenLijst.forEach(p => {
    const inkoopStuk = Number(inkoopMap[p.key] || 0);
    // ⭐ inkoop op basis van wat we ECHT betalen (na afronding naar grote doos)
    const totaleInkoopProduct = inkoopStuk * p.effectiefAantal;
    const winstProduct = p.omzet - totaleInkoopProduct;

    totaalInkoop += totaleInkoopProduct;

    if (p.leverancier === "Truffels") {
      omzetTruffels += p.omzet;
      inkoopTruffels += totaleInkoopProduct;
      winstTruffels += winstProduct;
    }

    if (p.leverancier === "Kerstrozen") {
      omzetKerstrozen += p.omzet;
      inkoopKerstrozen += totaleInkoopProduct;
      winstKerstrozen += winstProduct;
    }

    if (!bestProduct || winstProduct > bestProduct.winst) {
      bestProduct = { label: p.productLabel, winst: winstProduct };
    }
  });

  const mollieKostPerBestelling = parseGetal(document.getElementById("mollieKost").value);
  const transportKost = parseGetal(document.getElementById("transportKost").value);
  const totaleMollieKosten = aantalBestellingen * mollieKostPerBestelling;

  // bovenste samenvatting
  document.getElementById("totaleMollieKosten").textContent = euro(totaleMollieKosten);


  // resultaatblok links
  document.getElementById("resultaatOmzet").textContent = euro(totaleOmzet);
  document.getElementById("resultaatInkoop").textContent = euro(totaalInkoop);
  document.getElementById("resultaatMollie").textContent = euro(totaleMollieKosten);
  document.getElementById("resultaatTransport").textContent = euro(transportKost);

  const nettoWinst = totaleOmzet - totaalInkoop - totaleMollieKosten - transportKost;
  document.getElementById("resultaatWinst").textContent = euro(nettoWinst);

  // hint meest winstgevend product
  const hint = document.getElementById("topWinstHint");
  if (bestProduct) {
    hint.textContent = `Meeste winst per product: ${bestProduct.label} (${euro(bestProduct.winst)})`;
  }
  // ⬇️ waarden beschikbaar maken voor PDF
winstOverzicht.truffels = {
  omzet: omzetTruffels,
  inkoop: inkoopTruffels,
  winst: winstTruffels
};

winstOverzicht.kerstrozen = {
  omzet: omzetKerstrozen,
  inkoop: inkoopKerstrozen,
  winst: winstKerstrozen
};

}

// ===============================
// PDF
// ===============================
function downloadWinstPdf() {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: "mm", format: "a4" });

  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  const marginL = 14;
  const marginR = 14;
  const marginT = 16;
  const marginB = 16;

  let y = marginT;

  function newPageIfNeeded(extra = 0) {
    if (y + extra > pageH - marginB) {
      pdf.addPage();
      y = marginT;
    }
  }

  // Titel
  pdf.setFontSize(16);
  pdf.text("Winstoverzicht schoolverkoop", pageW / 2, y, { align: "center" });
  y += 7;

  pdf.setFontSize(10);
  pdf.text(`Actie: ${ACTIEVE_ACTIE}`, pageW / 2, y, { align: "center" });
  y += 5;
  pdf.text("Datum: " + new Date().toLocaleDateString("nl-BE"), pageW / 2, y, { align: "center" });
  y += 10;

  
  // Winst per leverancier (compact)
  pdf.setFontSize(11);
  pdf.setFont(undefined, "bold");
  newPageIfNeeded(8);

// ===============================
// TOTALEN PER LEVERANCIER – 2 KOLOMMEN
// ===============================
newPageIfNeeded(30);

const colGap = 10;
const colW = (pageW - marginL - marginR - colGap) / 2;

const leftX = marginL;
const rightX = marginL + colW + colGap;
const boxHLeveranciers = 28;


// -------- Kerstrozen --------
pdf.setFillColor(250, 250, 250);
pdf.setDrawColor(180);
pdf.roundedRect(leftX, y, colW, boxHLeveranciers, 3, 3, "FD");

pdf.setFont(undefined, "bold");
pdf.setFontSize(12);
pdf.text("Kerstrozen", leftX + 6, y + 8);

pdf.setFontSize(10);
pdf.setFont(undefined, "normal");

let ky = y + 14;
const valXLeft = leftX + colW - 10;

pdf.text("Omzet", leftX + 6, ky);
pdf.text(euro(winstOverzicht.kerstrozen.omzet), valXLeft, ky, { align: "right" });
ky += 5;

pdf.text("Inkoop", leftX + 6, ky);
pdf.text(euro(winstOverzicht.kerstrozen.inkoop), valXLeft, ky, { align: "right" });
ky += 5;

pdf.text("Winst", leftX + 6, ky);
pdf.text(euro(winstOverzicht.kerstrozen.winst), valXLeft, ky, { align: "right" });

// -------- Truffels --------
pdf.setFillColor(250, 250, 250);
pdf.setDrawColor(180);
pdf.roundedRect(rightX, y, colW, boxHLeveranciers, 3, 3, "FD");

pdf.setFont(undefined, "bold");
pdf.setFontSize(12);
pdf.text("Truffels", rightX + 6, y + 8);

pdf.setFontSize(10);
pdf.setFont(undefined, "normal");

let ty = y + 14;
const valXRight = rightX + colW - 10;

pdf.text("Omzet", rightX + 6, ty);
pdf.text(euro(winstOverzicht.truffels.omzet), valXRight, ty, { align: "right" });
ty += 5;

pdf.text("Inkoop", rightX + 6, ty);
pdf.text(euro(winstOverzicht.truffels.inkoop), valXRight, ty, { align: "right" });
ty += 5;

pdf.text("Winst", rightX + 6, ty);
pdf.text(euro(winstOverzicht.truffels.winst), valXRight, ty, { align: "right" });

y += boxHLeveranciers + 10;

  y += 4;

  // Tabel: winst per product — titel in kader
newPageIfNeeded(18);

const titleH = 12;
pdf.setFillColor(245, 247, 250);
pdf.setDrawColor(180);
pdf.roundedRect(
  marginL,
  y - 6,
  pageW - marginL - marginR,
  titleH,
  3,
  3,
  "FD"
);

pdf.setFont(undefined, "bold");
pdf.setFontSize(14);
pdf.text("Winst per product", marginL + 6, y + 2);

y += titleH - 4;


  // Kolommen (a4 breedte: 210mm)
  pdf.setFontSize(9);
  pdf.setFont(undefined, "bold");

  const xLev = marginL;
  const xProd = 44;
  const xAantal = 108;
  const xOmzet = 132;
  const xInkoop = 160;
  const xWinst = 196;

  function headerRow() {
    newPageIfNeeded(8);
    pdf.setFont(undefined, "bold");
    pdf.text("Lev.", xLev, y);
pdf.text("Product", xProd, y);
pdf.text("Verk./Bet.", xAantal, y, { align: "right" });
pdf.text("Omzet", xOmzet, y, { align: "right" });
pdf.text("Inkoop", xInkoop, y, { align: "right" });
pdf.text("Winst", xWinst, y, { align: "right" });

    y += 4;
    pdf.setDrawColor(210);
    pdf.line(marginL, y, pageW - marginR, y);
    y += 4;
  }


  pdf.setFont(undefined, "normal");

  // producten groeperen per leverancier
const perLevPdf = {
  Kerstrozen: [],
  Truffels: []
};

productenLijst.forEach(p => {
  if (perLevPdf[p.leverancier]) {
    perLevPdf[p.leverancier].push(p);
  }
});

Object.keys(perLevPdf).forEach(levNaam => {
  if (!perLevPdf[levNaam].length) return;

  // Leverancierstitel
  // extra witruimte tussen leveranciers
y += 6;

pdf.setFont(undefined, "bold");
pdf.setFontSize(11);
pdf.text(levNaam, marginL, y);
y += 10;


  headerRow();
  pdf.setFont(undefined, "normal");

  perLevPdf[levNaam].forEach(p => {
    const inkoopStuk = Number(inkoopMap[p.key] || 0);
    // ⭐ inkoop op basis van wat we ECHT betalen (na afronding naar grote doos)
    const totaleInkoopProduct = inkoopStuk * p.effectiefAantal;
    const winstProduct = p.omzet - totaleInkoopProduct;

    if (y > pageH - marginB - 10) {
      pdf.addPage();
      y = marginT;
      headerRow();
    }

    const prod = p.productLabel.length > 48
      ? p.productLabel.slice(0, 47) + "…"
      : p.productLabel;

    // Bij truffels met overschot: toon "verkocht → betaald" zodat het zichtbaar is
    // waarom de inkoop hoger ligt dan verkocht × inkoopprijs.
    const aantalTekst = p.overschot > 0
      ? `${p.aantal} → ${p.effectiefAantal}`
      : String(p.aantal);

    pdf.text(levNaam === "Kerstrozen" ? "K" : "T", xLev, y);
    pdf.text(prod, xProd, y);
    pdf.text(aantalTekst, xAantal, y, { align: "right" });
    pdf.text(euro(p.omzet), xOmzet, y, { align: "right" });
    pdf.text(euro(totaleInkoopProduct), xInkoop, y, { align: "right" });
    pdf.text(euro(winstProduct), xWinst, y, { align: "right" });

    y += 5;
  });

  y += 6;
});

// ===============================
// GROTE SAMENVATTING IN KADER
// ===============================
newPageIfNeeded(40);

y += 8;   // ← laat samenvatting iets zakken
const startY = y;

const boxPadding = 6;
const lineH = 6;
const boxW = pageW - marginL - marginR;

// Hoogte berekenen (titel + 4 lijnen + netto winst)
const boxHSamenvatting = 10 + (4 * lineH) + 14;


// Kader
pdf.setFillColor(245, 245, 245);
pdf.setDrawColor(180);
pdf.roundedRect(marginL, startY, boxW, boxHSamenvatting, 4, 4, "FD");

// Titel
pdf.setFont(undefined, "bold");
pdf.setFontSize(14);
pdf.text("SAMENVATTING", marginL + boxPadding, startY + 8);

// Inhoud
pdf.setFontSize(11);
pdf.setFont(undefined, "normal");

let yy = startY + 16;

[
  ["Totale omzet", document.getElementById("resultaatOmzet").textContent],
  ["Totale inkoop", document.getElementById("resultaatInkoop").textContent],
  ["Mollie-kosten", document.getElementById("resultaatMollie").textContent],
  ["Transportkosten", document.getElementById("resultaatTransport").textContent],
].forEach(([l, r]) => {
  pdf.text(l, marginL + boxPadding, yy);
  pdf.text(r, pageW - marginR - boxPadding, yy, { align: "right" });
  yy += lineH;
});

// Netto winst – extra opvallend
yy += 4;

pdf.setFillColor(230, 245, 230);
pdf.setDrawColor(120, 180, 120);
pdf.roundedRect(
  marginL + boxPadding,
  yy,
  boxW - boxPadding * 2,
  12,
  3,
  3,
  "FD"
);

pdf.setFont(undefined, "bold");
pdf.setFontSize(13);
pdf.setTextColor(20, 120, 20);

pdf.text("NETTO WINST", marginL + boxPadding + 4, yy + 8);
pdf.text(
  document.getElementById("resultaatWinst").textContent,
  pageW - marginR - boxPadding - 4,
  yy + 8,
  { align: "right" }
);

// reset
pdf.setTextColor(0, 0, 0);
y = startY + boxHSamenvatting + 10;

  // opslaan
  pdf.save(`winstoverzicht_${ACTIEVE_ACTIE}.pdf`);
}
