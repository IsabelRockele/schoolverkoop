import { PRODUCTS, money } from './excel-import.mjs';
export function priceYear(value) {
  if (!/^\d{4}$/.test(String(value)) || Number(value) < 2020 || Number(value) > 2100) throw Error('Kies een verkoopjaar tussen 2020 en 2100.');
  return String(value);
}
export const actionId = year => `kerstverkoop_${priceYear(year)}`;
export function decodePrices(data = {}) {
  const settings = {};
  for (const p of PRODUCTS) {
    const value = data.inkoopprijzen?.[p.key];
    const pack = data.excelVerpakking?.[p.key] ?? p.pack;
    if (!Number.isSafeInteger(pack) || pack < 1) throw Error(`Ongeldige doosinhoud voor ${p.label}.`);
    settings[p.key] = {cost:value == null || value === '' ? null : money(value), pack:p.supplier === 'Kerstrozen' ? 1 : pack};
  }
  const euroValue = value => value == null || value === '' ? '' : (money(value) / 100).toFixed(2);
  const savedMollie=data.excelKosten?.mollie;
  return {settings, transport:euroValue(data.excelKosten ? data.excelKosten.transport : data.transportKost),
    mollieTotal:euroValue(savedMollie?.mode==='total' ? savedMollie.total : null),
    legacyFees:euroValue(data.excelKosten?.fees)};
}
export function encodePrices(settings, costs) {
  const inkoopprijzen = {}, excelVerpakking = {};
  for (const p of PRODUCTS) {
    const item = settings[p.key];
    if (!item || !Number.isSafeInteger(item.pack) || item.pack < 1 || (item.cost != null && (!Number.isSafeInteger(item.cost) || item.cost < 0))) throw Error(`Controleer ${p.label}.`);
    inkoopprijzen[p.key] = item.cost == null ? null : item.cost / 100;
    excelVerpakking[p.key] = item.pack;
  }
  return {inkoopprijzen, excelVerpakking, excelKosten:{fees:0, transport:costs.transport == null ? null : costs.transport / 100,
    ...(costs.mollieSettings ? {mollie:{mode:costs.mollieSettings.mode,total:costs.mollieSettings.total==null ? null : costs.mollieSettings.total/100,rate:costs.mollieSettings.rate==null ? null : costs.mollieSettings.rate/100}} : {})}};
}
export function cachedPrices(storage, year) {
  const id = actionId(year);
  const own = storage.getItem(`excel_${id}_prijzen`);
  if (own) return {data:JSON.parse(own), source:'Excelprijzen bewaard op deze computer'};
  const legacy = storage.getItem(`winst_${id}_inkoopprijzen`);
  const oldSettings=storage.getItem(`winst_${id}_settings`);
  return legacy || oldSettings ? {data:{...(oldSettings ? JSON.parse(oldSettings) : {}),inkoopprijzen:legacy ? JSON.parse(legacy) : {}}, source:'Bestaande winstberekening op deze computer'} : {data:{}, source:'Nog geen inkoopprijzen voor dit jaar'};
}
export function cachePrices(storage, year, data) {
  const id = actionId(year);
  storage.setItem(`excel_${id}_prijzen`, JSON.stringify(data));
  storage.setItem(`winst_${id}_inkoopprijzen`, JSON.stringify(data.inkoopprijzen || {}));
}
