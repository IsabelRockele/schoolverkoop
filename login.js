import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { auth } from "./firebase-config.js";

const form = document.getElementById("loginForm");
const email = document.getElementById("email");
const wachtwoord = document.getElementById("wachtwoord");
const melding = document.getElementById("melding");
const loginKnop = document.getElementById("loginKnop");
const vergetenKnop = document.getElementById("vergetenKnop");

function doelPagina() {
  const toegestaan = new Set(["school.html", "winst.html"]);
  const gevraagd = new URLSearchParams(location.search).get("terug");
  return toegestaan.has(gevraagd) ? gevraagd : "school.html";
}

function toonMelding(tekst, fout = false) {
  melding.textContent = tekst;
  melding.classList.toggle("fout", fout);
}

onAuthStateChanged(auth, user => {
  if (user) location.replace(doelPagina());
});

form.addEventListener("submit", async event => {
  event.preventDefault();
  loginKnop.disabled = true;
  toonMelding("Even controleren…");
  try {
    await signInWithEmailAndPassword(auth, email.value.trim(), wachtwoord.value);
    location.replace(doelPagina());
  } catch {
    toonMelding("Aanmelden lukt niet. Controleer het e-mailadres en wachtwoord.", true);
    loginKnop.disabled = false;
  }
});

vergetenKnop.addEventListener("click", async () => {
  const adres = email.value.trim();
  if (!adres) {
    toonMelding("Vul eerst je e-mailadres in.", true);
    email.focus();
    return;
  }
  vergetenKnop.disabled = true;
  try {
    await sendPasswordResetEmail(auth, adres);
    toonMelding("De herstelmail is verzonden. Controleer ook de map met ongewenste e-mail.");
  } catch {
    // Geen accountinformatie prijsgeven; dezelfde neutrale boodschap tonen.
    toonMelding("Als dit adres als beheerder bestaat, ontvang je een herstelmail.");
  } finally {
    vergetenKnop.disabled = false;
  }
});
