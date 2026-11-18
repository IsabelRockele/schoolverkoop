// Shared with school.js and winst.js; order data never enters this module.
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js';
import { actionId } from './excel-prices.mjs';
const ready = new Promise(resolve => {
  const stop = onAuthStateChanged(auth, user => { stop(); resolve(user); });
});
export async function loadPrices(year) {
  await ready;
  if (!auth.currentUser) return {signedIn:false};
  const snapshot = await getDoc(doc(db,'instellingen',actionId(year)));
  return {signedIn:true, data:snapshot.exists() ? snapshot.data() : null};
}
export async function savePrices(year, data) {
  await ready;
  if (!auth.currentUser) return false;
  await setDoc(doc(db,'instellingen',actionId(year)), {...data,aangepastOp:new Date()}, {merge:true});
  return true;
}
