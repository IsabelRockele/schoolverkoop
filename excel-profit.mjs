export function profitDetails(summary, costs) {
  const excluded = summary.products.filter(p => p.sold > 0 && p.cost == null).map(p => `inkoop ${p.label}`);
  if (costs.fees == null) excluded.push('betaal- en overige kosten');
  if (costs.transport == null) excluded.push('transportkosten');
  const knownCost = summary.products.reduce((sum,p) => sum+(p.cost ?? 0),0);
  return {value:summary.revenue-knownCost-(costs.fees ?? 0)-(costs.transport ?? 0), knownCost, excluded,
    suffix:excluded.length ? ` (zonder ${excluded.join(', ')})` : '', provisional:excluded.length>0};
}
