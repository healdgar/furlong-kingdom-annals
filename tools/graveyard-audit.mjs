// Reads current simulation/render state only; returns one aggregate and per-yard diagnostics.
export function auditChurchyardsNative(){
  const inside=(P,p)=>{let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++){const a=P[i],b=P[j],dx=b.x-a.x,dz=b.z-a.z,L=dx*dx+dz*dz,t=Math.max(0,Math.min(1,L?((p.x-a.x)*dx+(p.z-a.z)*dz)/L:0));if(Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz)<1e-6)return true;if((a.z>p.z)!==(b.z>p.z)&&p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x)c=!c;}return c;};
  const contains=(outer,inner)=>!!outer?.length&&!!inner?.length&&inner.every((p,i)=>{
    if(!inside(outer,p))return false;const q=inner[(i+1)%inner.length],n=Math.max(1,Math.ceil(dist2d(p.x,p.z,q.x,q.z)/0.5));
    for(let k=1;k<n;k++){const t=k/n;if(!inside(outer,{x:p.x+(q.x-p.x)*t,z:p.z+(q.z-p.z)*t}))return false;}return true;
  });
  const rows=[];
  for(const s of W.settlements||[])for(const b of s.buildings||[]){const y=b._graveyard;if(!y||y.removed)continue;const P=y.poly||[],markers=graveyardMarkers(y,y.capacity||24),hash=s._lay?.placed?.historyCells;
    let hashCopies=0,duplicateCells=0;if(hash)for(const cell of hash.values()){const copies=cell.filter(o=>o===y).length;hashCopies+=copies;if(copies>1)duplicateCells++;}
    let landClear=false;try{landClear=graveyardLandClear(s,P,y.adjunct?null:furlongAt(b.x,b.z)?.k);}catch(_){landClear=false;}
    const markerFit=markers.every(m=>graveyardFootprintInside(y,m.x,m.z,m.kind==='tomb'?1.05:0.76,m.kind==='tomb'?0.68:0.22));
    const yardLand=[];for(const p of P){const f=furlongAt(p.x,p.z);if(f)yardLand.push(f.k+':'+f.state+':'+f.kind);}
    const path=y.footpath?.pts||y.access||null,walker={house:s.owner,settlement:s,placed:s._lay?.placed,requireRoadCrossing:true};let strictPath=!!path&&path.length>1;
    if(strictPath)for(let k=1;k<path.length;k++)if(!armySegmentClear(walker,path[k-1],path[k])){strictPath=false;break;}
    const competingLots=(s.buildings||[]).filter(o=>o!==b&&!o.removed&&o.state!=='gone'&&o.lot?.length>2&&P.length>2&&P.some(p=>inside(o.lot,p)));
    rows.push({town:s.name,church:b.x+','+b.z,adjunct:!!y.adjunct,polyVertices:P.length,capacity:y.capacity,markers:markers.length,markerFit,
      churchParcelContains:y.adjunct?null:contains(b.lot,P),churchLotReady:!!b.lot?.length,landClear,landSamples:[...new Set(yardLand)],
      accessPath:!!path,strictPaidAccess:strictPath,footpath:y.footpath?.kind||null,pick:groundPick(y.x,y.z)?.type||null,
      placementHashCopies:hashCopies,duplicateCells,competingResidentialLots:competingLots.length});
  }
  return {count:rows.length,nonAdjunctOutsideChurchLot:rows.filter(r=>!r.adjunct&&r.churchParcelContains===false).length,
    invalidGeometry:rows.filter(r=>r.polyVertices<3||!r.markerFit).length,invalidLand:rows.filter(r=>!r.landClear).length,
    missingAdjunctAccess:rows.filter(r=>r.adjunct&&(!r.accessPath||!r.strictPaidAccess||!r.footpath)).length,
    duplicateHashEntries:rows.filter(r=>r.duplicateCells>0).length,overlappedResidentialLots:rows.reduce((n,r)=>n+r.competingResidentialLots,0),yards:rows,valid:rows.length>0&&rows.every(r=>r.polyVertices>=3&&r.markerFit&&r.landClear&&r.pick==='churchyard'&&!r.duplicateCells&&!r.competingResidentialLots&&(r.adjunct?r.accessPath&&r.strictPaidAccess&&r.footpath:r.churchParcelContains))};
}
