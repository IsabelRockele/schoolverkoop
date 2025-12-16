// ===============================
// WINST.JS – SIMPELE STARTVERSIE
// ===============================

// Firebase (zelfde manier als in school.js)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// 🔹 Firebase configuratie (IDENTIEK aan school.js)
const firebaseConfig = {
  apiKey: "AIzaSyD4Pd3z6WpGbDwtpKV5glvrvJ5Ks-qCPz0",
  authDomain: "schoolverkoop-3d82d.firebaseapp.com",
  projectId: "schoolverkoop-3d82d",
  storageBucket: "schoolverkoop-3d82d.firebasestorage.app",
  messagingSenderId: "74076660432",
  appId: "1:74076660432:web:2e94c19700a076458cb4d5"
};

// Firebase starten
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ===============================
// PAGINA GELADEN
// ===============================
document.addEventListener("DOMContentLoaded", () => {

  // 🔙 Terug naar overzicht
  const terugBtn = document.getElementById("terugNaarOverzicht");
  if (terugBtn) {
    terugBtn.addEventListener("click", () => {
      window.location.href = "school.html";
    });
  }

  // Basisgegevens laden
  laadBasisGegevens();
});

// ===============================
// BASISGEGEVENS OPHALEN
// ===============================
async function laadBasisGegevens() {
  try {
  const snapshot = await getDocs(collection(db, "bestellingen_test"));

let totaleOmzet = 0;
let aantalBestellingen = 0;
let totaleInkoop = 0;
const productenMap = {};
let inkoopKerstrozen = 0;
let inkoopTruffels = 0;


  snapshot.forEach(doc => {
    const data = doc.data();
    aantalBestellingen++;
    totaleOmzet += Number(data.totaal || 0);
  });

  document.getElementById("totaleOmzet").textContent =
    "€ " + totaleOmzet.toFixed(2).replace(".", ",");

  document.getElementById("aantalBestellingen").textContent =
    aantalBestellingen;

  document.getElementById("totaleMollieKosten").textContent = "—";

  // ===============================
  // PRODUCTEN SAMENVOEGEN
  // ===============================
  const leveranciers = {
  kerstrozen: {
    naam: "Kerstrozen",
    totaalAantal: 0,
    inkoopPerStuk: 0
  },
  truffels: {
    naam: "Truffels",
    totaalAantal: 0,
    inkoopPerStuk: 0
  }
};  

  snapshot.forEach(doc => {
  const data = doc.data();

  // ✅ producten correct ophalen uit bestelling (nieuwe structuur)
  const items = Object.values(data.bestelling || {});

  items.forEach(item => {
    const sleutel = `${item.naam} – ${item.variant}`;

    if (!productenMap[sleutel]) {
      productenMap[sleutel] = {
        product: sleutel,
        verkoopprijs: Number(item.prijs || 0),
        aantal: 0
      };
    }

    productenMap[sleutel].aantal += Number(item.aantal || 0);

    if (item.naam.toLowerCase().includes("kerstroos")) {
      leveranciers.kerstrozen.totaalAantal += Number(item.aantal || 0);
    }

    if (item.naam.toLowerCase().includes("truffel")) {
      leveranciers.truffels.totaalAantal += Number(item.aantal || 0);
    }
  });
});


  // ===============================
  // TABEL VULLEN
  // ===============================
  const tbodyTruffels = document.getElementById("inkoopTabelBodyTruffels");
const tbodyKerstrozen = document.getElementById("inkoopTabelBodyKerstrozen");

tbodyTruffels.innerHTML = "";
tbodyKerstrozen.innerHTML = "";

Object.values(productenMap).forEach(p => {
  const tr = document.createElement("tr");

  tr.innerHTML = `
    <td>${p.product}</td>
    <td>€ ${p.verkoopprijs.toFixed(2).replace(".", ",")}</td>
    <td>${p.aantal}</td>
    <td>
     <input
  type="number"
  step="0.01"
  placeholder="€"
  class="inkoop-input"
  data-aantal="${p.aantal}"
  data-product="${p.product.toLowerCase()}"
  style="width:80px"
/>

    </td>
  `;

  const naam = p.product.toLowerCase();

  if (naam.includes("truffel")) {
    tbodyTruffels.appendChild(tr);
  } else if (naam.includes("kerstrozen")) {
    tbodyKerstrozen.appendChild(tr);
  }
});



function herberekenInkoop() {
  let totaalTruffels = 0;
  let totaalKerstrozen = 0;

  document.querySelectorAll(".inkoop-input").forEach(input => {
    const prijs = Number(input.value || 0);
    const aantal = Number(input.dataset.aantal || 0);
    const product = input.dataset.product;

    const subtotaal = prijs * aantal;

    if (product.includes("truffel")) {
      totaalTruffels += subtotaal;
    }

    if (product.includes("kerstrozen")) {
      totaalKerstrozen += subtotaal;
    }
  });

  const totaleInkoop = totaalTruffels + totaalKerstrozen;

  document.getElementById("totaalInkoopTruffels").textContent =
    "€ " + totaalTruffels.toFixed(2).replace(".", ",");

  document.getElementById("totaalInkoopKerstrozen").textContent =
    "€ " + totaalKerstrozen.toFixed(2).replace(".", ",");

  document.getElementById("resultaatInkoop").textContent =
    "€ " + totaleInkoop.toFixed(2).replace(".", ",");

  // winst herberekenen
  const mollieKost = Number(document.getElementById("mollieKost").value || 0);
  const transportKost = Number(document.getElementById("transportKost").value || 0);
  document.getElementById("resultaatTransport").textContent =
  "€ " + transportKost.toFixed(2).replace(".", ",");

  const totaleMollieKosten = aantalBestellingen * mollieKost;
  document.getElementById("totaleMollieKosten").textContent =
  "€ " + totaleMollieKosten.toFixed(2).replace(".", ",");


  const winst =
    totaleOmzet -
    totaleInkoop -
    totaleMollieKosten -
    transportKost;

  document.getElementById("resultaatWinst").textContent =
    "€ " + winst.toFixed(2).replace(".", ",");
}


// ===============================
// RESULTAAT BEREKENEN (1x)
// ===============================
const mollieKost = Number(
  document.getElementById("mollieKost").value || 0
);

 const transportKost = Number(
  document.getElementById("transportKost").value || 0
);

document.getElementById("resultaatTransport").textContent =
  "€ " + transportKost.toFixed(2).replace(".", ",");


const totaleMollieKosten = aantalBestellingen * mollieKost;
document.getElementById("totaleMollieKosten").textContent =
  "€ " + totaleMollieKosten.toFixed(2).replace(".", ",");


document.getElementById("resultaatOmzet").textContent =
  "€ " + totaleOmzet.toFixed(2).replace(".", ",");

document.getElementById("resultaatMollie").textContent =
  "€ " + totaleMollieKosten.toFixed(2).replace(".", ",");

document.getElementById("resultaatInkoop").textContent =
  "€ " + totaleInkoop.toFixed(2).replace(".", ",");

const winst =
  totaleOmzet -
  totaleInkoop -
  totaleMollieKosten -
  transportKost;

document.getElementById("resultaatWinst").textContent =
  "€ " + winst.toFixed(2).replace(".", ",");

  // live herberekenen wanneer een inkoopprijs wordt ingevuld
document.addEventListener("input", (e) => {
  if (
    e.target.classList.contains("inkoop-input") ||
    e.target.id === "transportKost" ||
    e.target.id === "mollieKost"
  ) {
    herberekenInkoop();
  }
});


} catch (error) {
  console.error("Fout bij laden winstgegevens:", error);
}
}
