import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { auth } from "./firebase-config.js";

export function requireAdmin() {
  document.documentElement.classList.add("auth-controleren");

  return new Promise(resolve => {
    const stop = onAuthStateChanged(auth, user => {
      stop();
      if (!user) {
        const terug = encodeURIComponent(location.pathname.split("/").pop() || "school.html");
        location.replace(`login.html?terug=${terug}`);
        return;
      }

      document.documentElement.classList.remove("auth-controleren");
      document.documentElement.classList.add("auth-goedgekeurd");
      toonBeheerder(user.email || "Beheerder");
      resolve(user);
    });
  });
}

function toonBeheerder(email) {
  const balk = document.createElement("div");
  balk.className = "beheerbalk";
  balk.innerHTML = `
    <span><strong>Aangemeld:</strong> <span class="beheer-email"></span></span>
    <button type="button" class="beheer-afmelden">Afmelden</button>
  `;
  balk.querySelector(".beheer-email").textContent = email;
  balk.querySelector(".beheer-afmelden").addEventListener("click", async () => {
    await signOut(auth);
    location.replace("login.html");
  });
  document.body.prepend(balk);
}
