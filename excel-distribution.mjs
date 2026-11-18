import { PRODUCTS } from './excel-import.mjs';

export const DELIVERY_GROUPS = [
  {label:'Kerstrozen', style:'roses', keys:['kerstrozen_wit','kerstrozen_rood','kerstrozen_roze'], labels:['Wit','Rood','Roze'], color:[246,226,230]},
  {label:'Truffels 250 g', style:'truffles250', keys:['truffels_250_donker','truffels_250_wit','truffels_250_melk'], labels:['Zwart','Wit','Melk'], color:[241,231,211]},
  {label:'Truffels 500 g', style:'truffles500', keys:['truffels_500_donker','truffels_500_wit','truffels_500_melk'], labels:['Zwart','Wit','Melk'], color:[228,225,242]}
];
export const DELIVERY_KEYS = DELIVERY_GROUPS.flatMap(group => group.keys);
const normalize = value => String(value || '').trim().replace(/\s+/g,' ').toLocaleLowerCase('nl');
export function studentsFor(orders, group) {
  const students = new Map();
  for (const order of orders) {
    if (group != null && order.group !== group) continue;
    const name = String(order.student || '').trim().replace(/\s+/g,' ');
    // Missing names cannot be assumed to belong to the same child.
    const id = JSON.stringify([order.group, name ? 'named' : 'missing', name ? normalize(name) : order.row]);
    if (!students.has(id)) students.set(id,{id,name:name || `Naam ontbreekt (Excelrij ${order.row})`,group:order.group,counts:Object.fromEntries(PRODUCTS.map(p => [p.key,0])),orderCount:0,orders:[]});
    const student = students.get(id);
    student.orderCount++;
    student.orders.push(order);
    for (const item of order.items) student.counts[item.key] += item.count;
  }
  return [...students.values()].map(student => ({...student,total:DELIVERY_KEYS.reduce((sum,key) => sum+student.counts[key],0)}))
    .sort((a,b) => a.group.localeCompare(b.group,'nl',{numeric:true}) || a.name.localeCompare(b.name,'nl',{numeric:true}));
}
export function deliveryTotals(students) {
  const counts = Object.fromEntries(DELIVERY_KEYS.map(key => [key,students.reduce((sum,s) => sum+s.counts[key],0)]));
  return {counts, groups:DELIVERY_GROUPS.map(group => group.keys.reduce((sum,key) => sum+counts[key],0)), total:DELIVERY_KEYS.reduce((sum,key) => sum+counts[key],0)};
}
