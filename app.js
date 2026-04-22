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
    id: "truffel250",
    naam: "Truffels 250 g",
    prijs: 6,              // ✅ juiste verkoopprijs
    varianten: [
      { code: "wit", img: "afbeeldingen/wit.png" },
      { code: "melk", img: "afbeeldingen/melk.png" },
      { code: "donker", img: "afbeeldingen/donker.png" }
    ]
  },
  {
    id: "truffel500",
    naam: "Truffels 500 g",
    prijs: 12,             // ✅ juiste verkoopprijs
    varianten: [
      { code: "wit", img: "afbeeldingen/wit.png" },
      { code: "melk", img: "afbeeldingen/melk.png" },
      { code: "donker", img: "afbeeldingen/donker.png" }
    ]
  },
  {
    id: "kerstrozen",
    naam: "Kerstrozen",
    prijs: 4,              // ✅ juiste verkoopprijs
    info: "Pot ⌀ 10,5 cm (min. 5 bloemen)",
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

// Sponsor-elementen
const sponsorKnoppen = document.querySelectorAll(".sponsor-knop");
const sponsorAnderBedragInput = document.getElementById("sponsorAnderBedrag");
const sponsorBevestigingEl = document.getElementById("sponsorBevestiging");
const sponsorBevestigingBedragEl = document.getElementById("sponsorBevestigingBedrag");
const sponsorResetKnop = document.getElementById("sponsorReset");
const sponsorInMandjeEl = document.getElementById("sponsorInMandje");
const sponsorInMandjeBedragEl = document.getElementById("sponsorInMandjeBedrag");
const sponsorVerwijderenMandjeKnop = document.getElementById("sponsorVerwijderen");

let mandje = {};
let sponsorBedrag = 0;  // sponsor-bedrag in euro's (0 = geen sponsor)
let bestellingVergrendeld = false;

// Komma-of-punt parser (accepteert "2,50" en "2.50")
function parseGetal(str) {
  if (!str) return 0;
  const s = String(str).replace(",", ".").trim();
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// Formatteer bedrag naar € x,yz
function formatEuro(n) {
  return "€ " + Number(n || 0).toFixed(2).replace(".", ",");
}

// hiermee kunnen we straks alle productkaart-aantallen netjes resetten
const productControls = [];

statusEl.textContent = "";

// 🔹 PRODUCTEN TONEN — per variant eigen teller
productenData.forEach(product => {
  const card = document.createElement("div");
  card.className = "product-card";

card.innerHTML = `
  ${product.id.startsWith("truffel") ? `
    <div class="product-header">
      <div class="product-header-tekst">
        <h3 class="product-title">${product.naam}</h3>
        <p><strong>Prijs:</strong> € ${product.prijs}</p>
      </div>
      <img
        src="afbeeldingen/doos_truffels.png"
        alt="Truffels – verpakking"
        class="product-doos"
      />
    </div>
  ` : `
    <h3 class="product-title">${product.naam}</h3>
    <p><strong>Prijs:</strong> € ${product.prijs}</p>
  `}

  ${product.info ? `<p class="product-info">${product.info}</p>` : ""}
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

  // Niks in mandje én geen sponsor: startscherm
  if (items.length === 0 && sponsorBedrag === 0) {
    mandjeEl.innerHTML = `<p class="muted">Nog geen producten gekozen.</p>`;
    totaalEl.textContent = "€ 0";

    // leerlinggegevens verbergen + knop uit
    leerlingGegevensEl.classList.add("verborgen");
    bestelKnop.disabled = true;
    return;
  }

  // Iets in mandje of sponsor ingevuld → leerlinggegevens tonen
  leerlingGegevensEl.classList.remove("verborgen");

  // Geen producten, enkel sponsor → vriendelijke boodschap
  if (items.length === 0 && sponsorBedrag > 0) {
    mandjeEl.innerHTML = `<p class="muted">Je bestelling bestaat uit een sponsorbijdrage.</p>`;
  }

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

  // Sponsor bij totaal optellen
  const totaalIncSponsor = totaal + sponsorBedrag;
  totaalEl.textContent = formatEuro(totaalIncSponsor);

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


// 🔹 SPONSOR-LOGICA
function updateSponsorUI() {
  // Vaste knoppen: visueel aanduiden welke actief is
  sponsorKnoppen.forEach(knop => {
    const knopBedrag = Number(knop.dataset.bedrag);
    knop.classList.toggle("actief", sponsorBedrag === knopBedrag);
  });

  // Bevestigingslijn onder de invoer
  if (sponsorBedrag > 0) {
    sponsorBevestigingEl.classList.remove("verborgen");
    sponsorBevestigingBedragEl.textContent = formatEuro(sponsorBedrag);
  } else {
    sponsorBevestigingEl.classList.add("verborgen");
  }

  // Sponsor in winkelmandje tonen
  if (sponsorBedrag > 0 && sponsorInMandjeEl) {
    sponsorInMandjeEl.classList.remove("verborgen");
    sponsorInMandjeBedragEl.textContent = formatEuro(sponsorBedrag);
  } else if (sponsorInMandjeEl) {
    sponsorInMandjeEl.classList.add("verborgen");
  }

  // Opslaan in localStorage (voor mandje.html)
  if (sponsorBedrag > 0) {
    localStorage.setItem("sponsor", String(sponsorBedrag));
  } else {
    localStorage.removeItem("sponsor");
  }

  // Het mandje opnieuw tonen (totaal + leerlinggegevens-zichtbaarheid)
  renderMandje();
}

function zetSponsorBedrag(bedrag) {
  if (bestellingVergrendeld) return;
  sponsorBedrag = Math.max(0, Number(bedrag) || 0);

  // Als een vast bedrag is geklikt, de "ander bedrag"-invoer leegmaken voor duidelijkheid
  if (sponsorAnderBedragInput && [5, 10, 20, 50].includes(sponsorBedrag)) {
    sponsorAnderBedragInput.value = "";
  }

  updateSponsorUI();
}

// Vaste knoppen
sponsorKnoppen.forEach(knop => {
  knop.addEventListener("click", () => {
    const bedrag = Number(knop.dataset.bedrag);
    // Opnieuw klikken op dezelfde knop = uitzetten
    if (sponsorBedrag === bedrag) {
      zetSponsorBedrag(0);
    } else {
      zetSponsorBedrag(bedrag);
    }
  });
});

// Ander bedrag
if (sponsorAnderBedragInput) {
  sponsorAnderBedragInput.addEventListener("input", () => {
    if (bestellingVergrendeld) return;
    const n = parseGetal(sponsorAnderBedragInput.value);
    sponsorBedrag = n;
    // Vaste knoppen niet markeren wanneer een vrij bedrag wordt ingevuld
    sponsorKnoppen.forEach(k => k.classList.remove("actief"));
    updateSponsorUI();
  });
}

// Reset-knoppen (ook vanuit mandje)
if (sponsorResetKnop) {
  sponsorResetKnop.addEventListener("click", () => {
    sponsorAnderBedragInput.value = "";
    zetSponsorBedrag(0);
  });
}
if (sponsorVerwijderenMandjeKnop) {
  sponsorVerwijderenMandjeKnop.addEventListener("click", () => {
    if (bestellingVergrendeld) return;
    if (!confirm("Sponsorbedrag verwijderen?")) return;
    sponsorAnderBedragInput.value = "";
    zetSponsorBedrag(0);
  });
}


// 🔹 KLIK OP BESTELLEN → OPSLAAN (TEST)
bestelKnop.addEventListener("click", async () => {
  const items = Object.values(mandje);

  // Minstens één product OF een sponsorbedrag
  if (items.length === 0 && sponsorBedrag <= 0) {
    alert("Kies eerst minstens één product, of vul een sponsorbedrag in.");
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

  const productenTotaal = items.reduce((som, item) => som + item.aantal * item.prijs, 0);

  const bestelling = {
    actieId: "kerstverkoop_2026",
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
    sponsorBedrag: sponsorBedrag,
    totaal: productenTotaal + sponsorBedrag,
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

  // sponsor resetten
  sponsorBedrag = 0;
  if (sponsorAnderBedragInput) sponsorAnderBedragInput.value = "";
  updateSponsorUI();

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

// Sponsor laden uit localStorage (voor als iemand refresht)
const bewaardeSponsor = parseGetal(localStorage.getItem("sponsor"));
if (bewaardeSponsor > 0) {
  sponsorBedrag = bewaardeSponsor;
  // Als het een vast bedrag was, knop actief markeren; anders in 'ander bedrag' veld
  if ([5, 10, 20, 50].includes(bewaardeSponsor)) {
    // vaste knoppen worden in updateSponsorUI bijgewerkt
  } else if (sponsorAnderBedragInput) {
    sponsorAnderBedragInput.value = bewaardeSponsor.toFixed(2).replace(".", ",");
  }
  updateSponsorUI();
}

