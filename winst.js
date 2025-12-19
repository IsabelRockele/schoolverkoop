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

// localStorage keys
const LS_SETTINGS = `winst_${ACTIEVE_ACTIE}_settings`;
const LS_INKOOP = `winst_${ACTIEVE_ACTIE}_inkoopprijzen`;

// State
let aantalBestellingen = 0;
let totaleOmzet = 0;
let productenLijst = []; // {key, leverancier, productLabel, verkoopprijs, aantal, omzet}
let inkoopMap = {};      // key -> inkoop/stuk (number)

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

function leverancierVanItem(naamLower) {
  if (naamLower.includes("truffel")) return "Truffels";
  if (naamLower.includes("kerstroos") || naamLower.includes("kerstrozen")) return "Kerstrozen";
  return "Onbekend";
}

function loadLocal() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_SETTINGS) || "{}");
    if (typeof s.mollieKost !== "undefined") document.getElementById("mollieKost").value = s.mollieKost;
    if (typeof s.transportKost !== "undefined") document.getElementById("transportKost").value = s.transportKost;
  } catch {}

  try {
    inkoopMap = JSON.parse(localStorage.getItem(LS_INKOOP) || "{}") || {};
  } catch {
    inkoopMap = {};
  }
}

function saveLocalSettings() {
  const mollieKost = Number(document.getElementById("mollieKost").value || 0);
  const transportKost = Number(document.getElementById("transportKost").value || 0);
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
  document.getElementById("mollieKost").addEventListener("input", () => {
    saveLocalSettings();
    herberekenAlles();
  });
  document.getElementById("transportKost").addEventListener("input", () => {
    saveLocalSettings();
    herberekenAlles();
  });

  // data laden
  laadBasisGegevens();
});

// ===============================
// Data ophalen & tabel bouwen
// ===============================
async function laadBasisGegevens() {
  try {
    const snapshot = await getDocs(
      query(
        collection(db, "bestellingen_test"),
        where("actieId", "==", ACTIEVE_ACTIE)
      )
    );

    // totals
    totaleOmzet = 0;
    aantalBestellingen = 0;

    // map per productKey
    const map = {}; // key -> {leverancier, productLabel, verkoopprijs, aantal}

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
        const key = productLabel.toLowerCase(); // stabiele sleutel

        if (!map[key]) {
          map[key] = { key, leverancier, productLabel, verkoopprijs: prijs, aantal: 0 };
        }
        map[key].aantal += aantal;

        // als verkoopprijs ooit 0 was, maar later wel gevuld: pak de laatste niet-0
        if (prijs > 0) map[key].verkoopprijs = prijs;
      });
    });

    // naar lijst, sorteren per leverancier/product
    productenLijst = Object.values(map).map(p => ({
      ...p,
      omzet: p.verkoopprijs * p.aantal
    })).sort((a, b) => {
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
      <td colspan="8">📦 ${leverancier}</td>
    `;
    tbody.appendChild(header);

    let subtotaalOmzet = 0;
    let subtotaalInkoop = 0;
    let subtotaalWinst = 0;

    // --- PRODUCTEN ---
    perLeverancier[leverancier].forEach(p => {
      const inkoopStuk = Number(inkoopMap[p.key] || 0);
      const totaleInkoop = inkoopStuk * p.aantal;
      const winst = p.omzet - totaleInkoop;

      subtotaalOmzet += p.omzet;
      subtotaalInkoop += totaleInkoop;
      subtotaalWinst += winst;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${p.leverancier}</td>
        <td>${p.productLabel}</td>
        <td class="num">${euro(p.verkoopprijs)}</td>
        <td class="num">${p.aantal}</td>
        <td class="num">${euro(p.omzet)}</td>
        <td class="num">
          <input
            class="inkoop-input"
            type="number"
            step="0.01"
            value="${inkoopStuk ? inkoopStuk.toFixed(2) : ""}"
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
      <td colspan="4" class="label">Subtotaal ${leverancier}</td>
      <td class="num">${euro(subtotaalOmzet)}</td>
      <td></td>
      <td class="num">${euro(subtotaalInkoop)}</td>
      <td class="num">${euro(subtotaalWinst)}</td>
    `;
    tbody.appendChild(subtotaal);
  });

  // listeners opnieuw koppelen
  document.querySelectorAll(".inkoop-input").forEach(inp => {
    inp.addEventListener("input", (e) => {
      const key = e.target.dataset.key;
      inkoopMap[key] = Number(e.target.value || 0);
      saveLocalInkoop();

      // 🔁 tabel + berekeningen volledig verversen
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
    const totaleInkoopProduct = inkoopStuk * p.aantal;
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

  const mollieKostPerBestelling = Number(document.getElementById("mollieKost").value || 0);
  const transportKost = Number(document.getElementById("transportKost").value || 0);
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

  // Tabel: winst per product
  newPageIfNeeded(12);
  pdf.setFont(undefined, "bold");
  pdf.setFontSize(11);
  pdf.text("Winst per product", marginL, y);
  y += 6;

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
pdf.text("Aantal", xAantal, y, { align: "right" });
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
  newPageIfNeeded(12);
  pdf.setFont(undefined, "bold");
  pdf.setFontSize(11);
  pdf.text(levNaam, marginL, y);
  y += 6;

  headerRow();
  pdf.setFont(undefined, "normal");

  perLevPdf[levNaam].forEach(p => {
    const inkoopStuk = Number(inkoopMap[p.key] || 0);
    const totaleInkoopProduct = inkoopStuk * p.aantal;
    const winstProduct = p.omzet - totaleInkoopProduct;

    if (y > pageH - marginB - 10) {
      pdf.addPage();
      y = marginT;
      headerRow();
    }

    const prod = p.productLabel.length > 48
      ? p.productLabel.slice(0, 47) + "…"
      : p.productLabel;

    pdf.text(levNaam === "Kerstrozen" ? "K" : "T", xLev, y);
    pdf.text(prod, xProd, y);
    pdf.text(String(p.aantal), xAantal, y, { align: "right" });
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
