// Pure flow interpretation shared by soak/tests. A star declares prepaid money.
// acct(null,-v) records its synthetic negative lost mirror; cancel only the
// declared star amount. Unfunded payouts and omitted purses still fail census.
export function moneyFlowGap(F0,F){
  let expect=0,minted={},mintT=0;
  for(const k of new Set([...Object.keys(F),...Object.keys(F0)])){
    const d=(F[k]||0)-(F0[k]||0);if(!d||k[0]==='!')continue;
    if(k==='<>lost')expect-=d;
    else if(k[0]==='<'&&k.endsWith('*')){minted[k.slice(1,-1)]=d;mintT+=d;}
    else if(k[0]==='<')expect+=d;else if(k[0]==='>')expect-=d;
  }
  const prepaid=mintT;
  return {expect:expect-prepaid,minted,mintT,prepaid};
}
