import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

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

// 🔹 Firestore referentie (DIT ONTBRAK)
const db = getFirestore(app);

console.log("app.js gestart");

// 🔹 TIJDELIJKE PRODUCTEN (GEEN FIREBASE)
const productenData = [
  {
    id: "truffel500",
    naam: "Truffel 500 g",
    prijs: 6,
    varianten: [
  { code: "wit", img: "afbeeldingen/wit.png" },
  { code: "melk", img: "afbeeldingen/melk.png" },
  { code: "donker", img: "afbeeldingen/donker.png" }
]
  },
  {
    id: "truffel250",
    naam: "Truffels 250 g",
    prijs: 4,
    varianten: [
  { code: "wit", img: "afbeeldingen/wit.png" },
  { code: "melk", img: "afbeeldingen/melk.png" },
  { code: "donker", img: "afbeeldingen/donker.png" }
]
  },
  {
    id: "kerstrozen",
    naam: "Kerstrozen",
    prijs: 6,
    varianten: [
  { code: "wit", img: "afbeeldingen/kerstroos_wit.png" },
  { code: "rood", img: "afbeeldingen/kerstroos_rood.png" },
  { code: "roze", img: "afbeeldingen/kerstroos_roze.png" }
]

  }
];

// 🔹 DOM
const productenEl = document.getElementById("producten");
const statusEl = document.getElementById("status");
const mandjeEl = document.getElementById("mandjeLijst");
const totaalEl = document.getElementById("totaal");

// nieuw (optie B)
const leerlingGegevensEl = document.getElementById("leerlingGegevens");
const naamKindInput = document.getElementById("naamKind");
const klasSelect = document.getElementById("klas");
const naamKoperInput = document.getElementById("naamKoper");
const emailKoperInput = document.getElementById("emailKoper");
const bestelKnop = document.getElementById("bestelKnop");
const nieuweBestellingKnop = document.getElementById("nieuweBestellingKnop");

let mandje = {};
let bestellingVergrendeld = false;

// hiermee kunnen we straks alle productkaart-aantallen netjes resetten
const productControls = [];

statusEl.textContent = "";

// 🔹 PRODUCTEN TONEN — per variant eigen teller
productenData.forEach(product => {
  const card = document.createElement("div");
  card.className = "product-card";

  card.innerHTML = `
    <h3 class="product-title">${product.naam}</h3>
    <p><strong>Prijs:</strong> € ${product.prijs}</p>
    <div class="varianten"></div>
  `;

  const variantenContainer = card.querySelector(".varianten");

  product.varianten.forEach(variantObj => {
  const variant = variantObj.code;

    let aantal = 0;

    const rij = document.createElement("div");
    rij.className = "variant-tegel";


    rij.innerHTML = `
  <img src="${variantObj.img}" alt="${variant}" class="variant-img" />

  <div class="variant-lijn">
    <span class="variant-naam">${variant}</span>
    <div class="qty">
      <button class="min">−</button>
      <span class="val">0</span>
      <button class="plus">+</button>
    </div>
  </div>
`;


    const minBtn = rij.querySelector(".min");
    const plusBtn = rij.querySelector(".plus");
    const valEl = rij.querySelector(".val");

    function update() {
      valEl.textContent = aantal;

      const key = `${product.id}_${variant}`;

      if (aantal > 0) {
     mandje[key] = {
  key,              // ✅ BELANGRIJK
  naam: product.naam,
  variant,
  aantal,
  prijs: product.prijs
};

      } else {
        delete mandje[key];
      }

      renderMandje();
      // 🔔 KORTE BEVESTIGING "toegevoegd aan winkelmandje"
  const toast = document.getElementById("toast");
  if (toast) {
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2000);
  }

  // 🛒 TELLER IN ZWEVENDE KNOP BIJWERKEN (tel uit mandje, niet uit DOM)
const mandjeAantal = document.getElementById("mandjeAantal");
if (mandjeAantal) {
  const totaalAantal = Object.values(mandje).reduce((som, it) => som + (it.aantal || 0), 0);
  mandjeAantal.textContent = `(${totaalAantal})`;
}

  // 💾 mandje opslaan voor mandje.html
localStorage.setItem("mandje", JSON.stringify(mandje));

    }

    minBtn.onclick = () => {
      if (bestellingVergrendeld) return;
      if (aantal > 0) {
        aantal--;
        update();
      }
    };

    plusBtn.onclick = () => {
      if (bestellingVergrendeld) return;
      aantal++;
      update();
    };

    // reset-mogelijkheid voor "Nieuwe bestelling"
    productControls.push({
      reset: () => {
        aantal = 0;
        update();
      }
    });

    variantenContainer.appendChild(rij);
  });

  productenEl.appendChild(card);
});


// 🔹 MANDJE TONEN + OPTIE B LOGICA
function renderMandje() {
  mandjeEl.innerHTML = "";
  let totaal = 0;

  const items = Object.values(mandje);

  // geen producten
  if (items.length === 0) {
    mandjeEl.innerHTML = `<p class="muted">Nog geen producten gekozen.</p>`;
    totaalEl.textContent = "€ 0";

    // leerlinggegevens verbergen + knop uit
    leerlingGegevensEl.classList.add("verborgen");
    bestelKnop.disabled = true;
    return;
  }

  // producten aanwezig → leerlinggegevens tonen
  leerlingGegevensEl.classList.remove("verborgen");

  items.forEach(item => {
    const rij = document.createElement("div");
    rij.className = "mandje-item";

    const sub = item.aantal * item.prijs;
    totaal += sub;

   rij.innerHTML = `
  <div class="mandje-links">
    <div class="mandje-naam">
      ${item.naam} (${item.variant})
    </div>

    <div class="qty">
      <button class="min">−</button>
      <span class="val">${item.aantal}</span>
      <button class="plus">+</button>
    </div>
  </div>

  <button class="verwijder" title="Verwijderen" aria-label="Verwijderen">
  <svg viewBox="0 0 24 24" class="icoon-verwijder" aria-hidden="true">
    <path d="M6 7h12l-1 14H7L6 7zm3-3h6l1 2H8l1-2z" />
  </svg>
</button>


`;
const minBtn = rij.querySelector(".min");
const plusBtn = rij.querySelector(".plus");
const verwijderBtn = rij.querySelector(".verwijder");

const key = item.key;


// −
minBtn.onclick = () => {
  if (bestellingVergrendeld) return;

  item.aantal--;
  if (item.aantal <= 0) {
    delete mandje[key];
  }
  localStorage.setItem("mandje", JSON.stringify(mandje));
  renderMandje();
};

// +
plusBtn.onclick = () => {
  if (bestellingVergrendeld) return;

  item.aantal++;
  localStorage.setItem("mandje", JSON.stringify(mandje));
  renderMandje();
};

// verwijderen
verwijderBtn.onclick = () => {
  if (bestellingVergrendeld) return;

  if (!confirm("Wil je dit product verwijderen?")) return;
  delete mandje[key];
  localStorage.setItem("mandje", JSON.stringify(mandje));
  renderMandje();
};



    mandjeEl.appendChild(rij);
  });

  totaalEl.textContent = `€ ${totaal}`;

  // bestelknop enkel actief als naam + klas ingevuld zijn
  controleerBestelKnop();
}

// 🔹 CONTROLE BESTELKNOP
function controleerBestelKnop() {
  const heeftNaam = naamKindInput.value.trim() !== "";
  const heeftKlas = klasSelect.value !== "";
  const heeftNaamKoper = naamKoperInput.value.trim() !== "";
  const heeftEmail = emailKoperInput.value.trim() !== "";

  bestelKnop.disabled = !(heeftNaam && heeftKlas && heeftNaamKoper && heeftEmail);
}



// luisteren naar invoer
naamKindInput.addEventListener("input", controleerBestelKnop);
klasSelect.addEventListener("change", controleerBestelKnop);
emailKoperInput.addEventListener("input", controleerBestelKnop);
naamKoperInput.addEventListener("input", controleerBestelKnop);


// 🔹 KLIK OP BESTELLEN → OPSLAAN (TEST)
bestelKnop.addEventListener("click", async () => {
  const items = Object.values(mandje);

  if (items.length === 0) {
    alert("Kies eerst minstens één product.");
    return;
  }

  if (naamKindInput.value.trim() === "") {
    alert("Vul de naam van de leerling in.");
    return;
  }

  if (klasSelect.value === "") {
    alert("Kies een klas.");
    return;
  }

  const bestelling = {
    actieId: "kerstverkoop_2026",   // 👈 NIEUW (Optie A)
    leerling: naamKindInput.value.trim(),
    klas: klasSelect.value,
    naamKoper: naamKoperInput.value.trim(),
    emailKoper: emailKoperInput.value.trim(),
    producten: items.map(item => ({
      naam: item.naam,
      variant: item.variant,
      aantal: item.aantal,
      prijs: item.prijs
    })),
    totaal: items.reduce((som, item) => som + item.aantal * item.prijs, 0),
    status: "test",
    aangemaaktOp: new Date()
  };

  try {
 await addDoc(collection(db, "bestellingen_test"), bestelling);

// 🔒 OPTIE C: VERGRENDELEN NA OPSLAAN (mandje blijft staan)
bestellingVergrendeld = true;

// bevestiging zichtbaar op pagina (geen dubbele clicks)
statusEl.textContent =
  "Dank je voor je bestelling! Je ontvangt zo meteen een bevestiging via e-mail.";
statusEl.classList.remove("verborgen");
statusEl.classList.add("groot");

// na 3 seconden: terug naar boven scrollen
setTimeout(() => {
  statusEl.classList.remove("groot");
  window.scrollTo({ top: 0, behavior: "smooth" });
}, 3000);


// toon knop “Nieuwe bestelling”
nieuweBestellingKnop.style.display = "block";

// invoervelden blokkeren
naamKindInput.disabled = true;
klasSelect.disabled = true;

emailKoperInput.disabled = true;

// bestelknop blokkeren
bestelKnop.disabled = true;


// alle + en − knoppen + variantkeuze uitschakelen
document.querySelectorAll(".plus, .min, select").forEach(el => {
  el.disabled = true;
});


  } catch (error) {
    console.error("Fout bij opslaan bestelling:", error);
    alert("Er ging iets mis bij het opslaan.");
  }
});

nieuweBestellingKnop.addEventListener("click", () => {
  // ontgrendel
  bestellingVergrendeld = false;

  // mandje leeg + UI opnieuw opbouwen
  mandje = {};

  // reset alle productkaart-aantallen naar 0 (belangrijk!)
  productControls.forEach(pc => pc.reset());

  // invoervelden opnieuw activeren + leegmaken
  naamKindInput.disabled = false;
  klasSelect.disabled = false;
  emailKoperInput.disabled = false;

  naamKindInput.value = "";
  klasSelect.value = "";
  emailKoperInput.value = "";


  // productknoppen opnieuw activeren
  document.querySelectorAll(".plus, .min, select").forEach(el => {
    el.disabled = false;
  });

  // bestelknop opnieuw uit (tot naam+klas ingevuld)
  bestelKnop.disabled = true;

  // bevestiging weg
  statusEl.textContent = "";

  // knop weer verbergen
  nieuweBestellingKnop.style.display = "none";

  // mandje-render opnieuw
  renderMandje();
});

// Klik op winkelmandje -> open nieuw venster
document.getElementById("mandjeBtn").addEventListener("click", () => {
  window.location.href = "mandje.html";
});

