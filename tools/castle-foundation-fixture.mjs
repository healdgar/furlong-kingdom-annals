// A native construction scenario, not a world aged from a different era. An
// external stake funds the existing border seat after a remembered raid. A
// declared external timber delivery is owned by its seller in the native ledger;
// the patron must buy/consume it and pay actual workers. Travel is outside this
// forced initial-condition fixture; it is not an ordinary-history calibration.
export const foundationFixtureExpression=`(()=>{const si=3,s=W.settlements[si],hi=s.owner;
  if(!s||casKeep(s)||casRing(s)||hi<=0)throw Error('Foundation fixture needs the unfenced border seat');
  transfer('out',W.houses[hi],3000,'foundation fixture stake',s);s.raidedUntil=day()-1;
  const q=castleFoundationCommission(s,si);if(!q)throw Error('Native foundation fixture could not commission a viable surveyed project');
  storageInit(s).adjust('yard','timber',null,'unassigned',q.timber,'foundation-fixture-import');
  offer(s,'timber','out',q.timber); // register the real seller as well as its physical delivery
  if(avail(s,'timber',price(s,'timber'))<q.timber)throw Error('Foundation fixture delivery is not offered on the native market');
  return {si,days:q.days,timber:q.timber,stone:q.stone,labour:q.labour};})()`;
