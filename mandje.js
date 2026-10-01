
function laadMandje() {
  return JSON.parse(localStorage.getItem("mandje")) || {};
}

function bewaarMandje(mandje) {
  localStorage.setItem("mandje", JSON.stringify(mandje));
}

function laadSponsor() {
  const n = parseFloat(localStorage.getItem("sponsor") || "0");
  return isNaN(n) ? 0 : n;
}

function formatEuro(n) {
  return "€ " + Number(n || 0).toFixed(2).replace(".", ",");
}

function render() {
  const mandje = laadMandje();
  const sponsor = laadSponsor();
  const items = Object.values(mandje);

  const lijst = document.getElementById("mandjeLijst");
  const totaalEl = document.getElementById("mandjeTotaal");
  const sponsorRegel = document.getElementById("sponsorRegel");
  const sponsorRegelBedrag = document.getElementById("sponsorRegelBedrag");

  lijst.innerHTML = "";
  let totaal = 0;

  // Sponsor-regel tonen/verbergen
  if (sponsor > 0 && sponsorRegel) {
    sponsorRegel.classList.remove("verborgen");
    sponsorRegelBedrag.textContent = formatEuro(sponsor);
  } else if (sponsorRegel) {
    sponsorRegel.classList.add("verborgen");
  }

  // Als echt niks in de bestelling zit (geen producten en geen sponsor)
  if (items.length === 0 && sponsor === 0) {
    lijst.innerHTML = `<p class="muted">Nog geen producten gekozen.</p>`;
    totaalEl.textContent = "€ 0,00";
    return;
  }

  // Geen producten, enkel sponsor: vriendelijke boodschap
  if (items.length === 0 && sponsor > 0) {
    lijst.innerHTML = `<p class="muted">Je bestelling bestaat uit een sponsorbijdrage.</p>`;
  }

  items.forEach(item => {
    const rij = document.createElement("div");
    rij.className = "mandje-rij";

    const sub = (item.aantal || 0) * (item.prijs || 0);
    totaal += sub;

    const subtotaal = item.aantal * item.prijs;

    rij.innerHTML = `
      <div class="mandje-rij-links">
        <strong>${item.naam} (${item.variant})</strong>

        <div class="mandje-qty">
          <button class="min">−</button>
          <span class="val">${item.aantal}</span>
          <button class="plus">+</button>
        </div>

        <div class="mandje-subtotaal">
          € ${subtotaal}
        </div>
      </div>

      <button class="verwijder" title="Verwijderen">🗑️</button>
    `;

    const key = item.key;

    rij.querySelector(".min").onclick = () => {
      item.aantal--;
      if (item.aantal <= 0) delete mandje[key];
      bewaarMandje(mandje);
      render();
    };

    rij.querySelector(".plus").onclick = () => {
      item.aantal++;
      bewaarMandje(mandje);
      render();
    };

    rij.querySelector(".verwijder").onclick = () => {
      delete mandje[key];
      bewaarMandje(mandje);
      render();
    };

    lijst.appendChild(rij);
  });

  // Totaal = producten + sponsor
  totaalEl.textContent = formatEuro(totaal + sponsor);
}

render();

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// 🔹 Firebase configuratie
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

const betaalBtn = document.getElementById("betaalBtn");
const bevestiging = document.getElementById("bestelBevestiging");
const bevestigingTekst = document.getElementById("bestelBevestigingTekst");
const terugNaarWinkel = document.getElementById("terugNaarWinkel");

terugNaarWinkel?.addEventListener("click", () => {
  window.location.href = "index.html";
});

if (betaalBtn) {
  betaalBtn.addEventListener("click", async () => {

    const naamKind = document.getElementById("naamKind").value.trim();
    const klas = document.getElementById("klas").value;
    const naamKoper = document.getElementById("naamKoper").value.trim();
    const emailKoper = document.getElementById("emailKoper").value.trim();

    const mandje = JSON.parse(localStorage.getItem("mandje")) || {};
    const sponsor = laadSponsor();

    if (!naamKind || !klas || !naamKoper || !emailKoper) {
      alert("Gelieve alle gegevens in te vullen.");
      return;
    }

    // Minstens één product OF een sponsorbedrag
    if (Object.keys(mandje).length === 0 && sponsor === 0) {
      alert("Je winkelmandje is leeg.");
      return;
    }

    const productenTotaal = Object.values(mandje)
      .reduce((som, item) => som + item.aantal * item.prijs, 0);

    const totaal = productenTotaal + sponsor;
    const producten = Object.values(mandje).map(item => ({
      naam: String(item.naam || ""),
      variant: String(item.variant || ""),
      aantal: Number(item.aantal || 0),
      prijs: Number(item.prijs || 0)
    }));

    try {
      betaalBtn.disabled = true;
      betaalBtn.textContent = "Testbestelling opslaan…";

      await addDoc(collection(db, "bestellingen_test"), {
        actieId: "kerstverkoop_2026",
        leerling: naamKind,
        klas,
        naamKoper,
        emailKoper,
        producten,
        sponsorBedrag: sponsor,
        totaal,
        status: "test",
        aangemaaktOp: serverTimestamp()
      });

      localStorage.removeItem("mandje");
      localStorage.removeItem("sponsor");

      document.querySelector(".bestel-formulier")?.classList.add("verborgen");
      document.querySelector(".mandje-totaal")?.classList.add("verborgen");
      betaalBtn.classList.add("verborgen");

      bevestigingTekst.textContent =
        `Bestelling voor ${naamKind} (${klas}), geplaatst door ${naamKoper}, voor ${formatEuro(totaal)}. ` +
        `Bij de latere echte verkoop wordt de bestelbevestiging ook naar ${emailKoper} gemaild.`;
      bevestiging.classList.remove("verborgen");
      bevestiging.focus();
      bevestiging.scrollIntoView({ behavior: "smooth", block: "start" });

    } catch (err) {
      console.error(err);
      betaalBtn.disabled = false;
      betaalBtn.textContent = "Bestelling plaatsen (test)";
      alert("De testbestelling kon niet worden opgeslagen. Controleer je internetverbinding en probeer opnieuw.");
    }
  });
}

