// Immutable file parts are published only after every part has been saved.
// The manifest swap is atomic; replaced parts are deleted, not archived.
const ROOT='excel_laatste_bestellingen', SIZE=512*1024, MAX=20*1024*1024;
const partId=(version,i)=>`${ROOT}_${version}_${i}`;
function parts(meta) {
  if(!meta)return [];
  if(!/^[a-f0-9-]+$/.test(meta.version) || !Number.isInteger(meta.count) || meta.count<1 || meta.count>40) throw Error('Ongeldige bewaarde Excel.');
  return Array.from({length:meta.count},(_,i)=>partId(meta.version,i));
}
async function digest(bytes) {
  const hash=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join('');
}
export function workbookStore(adapter) {
  async function removeParts(meta) { await adapter.remove(parts(meta)); }
  return {
    async save(file) {
      const bytes=new Uint8Array(file.bytes);
      if(!bytes.length || bytes.length>MAX || !/\.xlsx$/i.test(file.name))throw Error('Ongeldig Excelbestand (maximaal 20 MB).');
      const meta={version:crypto.randomUUID(),count:Math.ceil(bytes.length/SIZE),length:bytes.length,name:file.name,sheet:file.sheet,year:file.year,savedAt:new Date().toISOString(),hash:await digest(bytes)};
      try {
        for(let i=0;i<meta.count;i++)await adapter.put(partId(meta.version,i),bytes.slice(i*SIZE,(i+1)*SIZE));
      } catch(error) { await removeParts(meta).catch(()=>{});throw error; }
      // Do not delete the new parts on an ambiguous network error during publication.
      const previous=await adapter.swap(ROOT,meta);
      let cleaned=true;
      try {await removeParts(previous);} catch {cleaned=false;}
      return {...meta,cleaned};
    },
    async load() {
      for(let attempt=0;attempt<3;attempt++) {
        const meta=await adapter.get(ROOT);
        if(!meta)return null;
        const ids=parts(meta);
        if(!Number.isInteger(meta.length) || meta.length<1 || meta.length>MAX || Math.ceil(meta.length/SIZE)!==meta.count)throw Error('Ongeldige bestandsgrootte.');
        const chunks=await Promise.all(ids.map(id=>adapter.get(id)));
        if(chunks.some(chunk=>!(chunk instanceof Uint8Array)))continue;
        if(chunks.reduce((sum,chunk)=>sum+chunk.length,0)!==meta.length)throw Error('De bewaarde Excel is onvolledig.');
        const bytes=new Uint8Array(meta.length);let offset=0;
        for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
        if(await digest(bytes)!==meta.hash)throw Error('De bewaarde Excel kon niet betrouwbaar worden gelezen.');
        // Retry if another computer replaced the file during this read.
        if((await adapter.get(ROOT))?.version!==meta.version)continue;
        return {...meta,bytes};
      }
      throw Error('Het bestand is net vervangen. Open de laatste Excel opnieuw.');
    }
  };
}
