
function laadMandje() {
  return JSON.parse(localStorage.getItem("mandje")) || {};
}

function bewaarMandje(mandje) {
  localStorage.setItem("mandje", JSON.stringify(mandje));
}

function render() {
  const mandje = laadMandje();
  const items = Object.values(mandje);

  const lijst = document.getElementById("mandjeLijst");
  const totaalEl = document.getElementById("mandjeTotaal");

  lijst.innerHTML = "";
  let totaal = 0;

  if (items.length === 0) {
    lijst.innerHTML = `<p class="muted">Nog geen producten gekozen.</p>`;
    totaalEl.textContent = "€ 0";
    return;
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

  totaalEl.textContent = `€ ${totaal}`;
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

if (betaalBtn) {
  betaalBtn.addEventListener("click", async () => {

    const naamKind = document.getElementById("naamKind").value.trim();
    const klas = document.getElementById("klas").value;
    const naamKoper = document.getElementById("naamKoper").value.trim();
    const emailKoper = document.getElementById("emailKoper").value.trim();

    const mandje = JSON.parse(localStorage.getItem("mandje")) || {};

    if (!naamKind || !klas || !naamKoper || !emailKoper) {
      alert("Gelieve alle gegevens in te vullen.");
      return;
    }

    if (Object.keys(mandje).length === 0) {
      alert("Je winkelmandje is leeg.");
      return;
    }

    const totaal = Object.values(mandje)
      .reduce((som, item) => som + item.aantal * item.prijs, 0);

    try {
      await addDoc(collection(db, "bestellingen_test"), {
        leerling: { naam: naamKind, klas },
        koper: { naam: naamKoper, email: emailKoper },
        bestelling: mandje,
        totaal,
        aangemaaktOp: serverTimestamp()
      });

      localStorage.removeItem("mandje");

      alert(
        "Bedankt voor je bestelling!\n\n" +
        "Je ontvangt een mail met de bestelbevestiging.\n" +
        "Kijk ook even in je spam."
      );

      window.location.href = "index.html";

    } catch (err) {
      console.error(err);
      alert("Er ging iets mis bij het opslaan.");
    }
  });
}

