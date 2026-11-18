import {auth,db} from './firebase-config.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js';
import {doc,getDocFromServer,setDoc,runTransaction,writeBatch,Bytes} from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js';
import {workbookStore} from './excel-workbook-store.mjs';
const ready=new Promise(resolve=>{const stop=onAuthStateChanged(auth,()=>{stop();resolve();});});
const ref=id=>doc(db,'instellingen',id);
const store=workbookStore({
  async get(id){const snapshot=await getDocFromServer(ref(id));if(!snapshot.exists())return null;const data=snapshot.data();return data.bytes ? data.bytes.toUint8Array() : data;},
  async put(id,bytes){await setDoc(ref(id),{bytes:Bytes.fromUint8Array(bytes)});},
  async remove(ids){if(!ids.length)return;const batch=writeBatch(db);ids.forEach(id=>batch.delete(ref(id)));await batch.commit();},
  async swap(id,meta){return runTransaction(db,async tx=>{const previous=await tx.get(ref(id));tx.set(ref(id),meta);return previous.exists() ? previous.data() : null;});}
});
export async function loadWorkbook(){await ready;if(!auth.currentUser)return {signedIn:false};return {signedIn:true,file:await store.load()};}
export async function saveWorkbook(file){await ready;if(!auth.currentUser)return {signedIn:false};await getDocFromServer(ref('excel_laatste_bestellingen'));return {signedIn:true,file:await store.save(file)};}
