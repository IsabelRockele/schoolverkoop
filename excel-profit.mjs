export function profitDetails(summary, costs) {
  const excluded = summary.products.filter(p => p.sold > 0 && p.cost == null).map(p => `inkoop ${p.label}`);
  if (costs.fees == null) excluded.push(costs.mollieSettings?.mode==='included' ? 'betaal- en overige kosten' : 'overige kosten');
  if ('mollie' in costs && costs.mollie == null) excluded.push('Mollie-kosten');
  if (costs.transport == null) excluded.push('transportkosten');
  const knownCost = summary.products.reduce((sum,p) => sum+(p.cost ?? 0),0);
  const estimated=costs.mollieSettings?.mode==='estimate' && costs.mollie!=null;
  const notes=[...(excluded.length ? [`zonder ${excluded.join(', ')}`] : []),...(estimated ? ['met geschatte Mollie-kosten'] : [])];
  return {value:summary.revenue-knownCost-(costs.fees ?? 0)-(costs.transport ?? 0)-(costs.mollie ?? 0), knownCost, excluded,
    suffix:notes.length ? ` (${notes.join('; ')})` : '', provisional:excluded.length>0 || estimated};
}
