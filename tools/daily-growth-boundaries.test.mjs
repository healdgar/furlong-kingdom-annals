import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const fn=name=>source.match(new RegExp(`^function ${name}\\b[\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))`,'m'))?.[0];
const declaration=name=>source.match(new RegExp(`^const ${name}=[^\\n]*`,'m'))?.[0];
const growthWrapper=fn('tickGrowth');
assert.ok(growthWrapper,'tickGrowth wrapper must exist');

test('occupancy and due falls are daily while paid housing and fabric work remain six-day',()=>{
  const selected=new Set([0,1,5,6,7,361]),events=new Map(),annualDays=Array.from({length:362},()=>({widen:[],vacancy:[]}));
  const counts=Array.from({length:362},()=>({moveIn:0,fall:0,housing:0,widen:0,vacancy:0,fabric:0}));
  let today=0;
  const record=(kind,s)=>{
    counts[s.index][kind]++;
    if(kind==='widen'||kind==='vacancy')annualDays[s.index][kind].push(today);
    if(selected.has(s.index)){
      const key=`${today}:${s.index}`,list=events.get(key)||[];
      list.push(kind);events.set(key,list);
    }
  };
  const W={settlements:Array.from({length:362},(_,index)=>({index,folk:[{}]}))};
  const c=vm.createContext({
    W,day:()=>today,
    moveIn:s=>record('moveIn',s),tickFalling:s=>record('fall',s),
    tickGrowthHousing:s=>record('housing',s),tickGrowthWiden:s=>record('widen',s),
    tickGrowthVacancy:s=>record('vacancy',s),tickGrowthFabric:s=>record('fabric',s)
  });
  vm.runInContext(growthWrapper,c);
  for(today=1;today<=360;today++)c.tickGrowth();

  for(const index of [0,1,5,6,7,361]){
    const n=counts[index];
    assert.equal(n.moveIn,360,`daily occupancy for settlement ${index}`);
    assert.equal(n.fall,360,`daily falls for settlement ${index}`);
    assert.equal(n.housing,60,`paid housing remains six-day for settlement ${index}`);
    assert.equal(n.fabric,60,`fabric work remains six-day for settlement ${index}`);
    assert.equal(n.widen,1,`one annual widening assessment for settlement ${index}`);
    assert.equal(n.vacancy,1,`one annual vacancy assessment for settlement ${index}`);
    const due=(index*29)%360||360;
    assert.deepEqual(annualDays[index].widen,[due]);
    assert.deepEqual(annualDays[index].vacancy,[due]);
  }
  assert.deepEqual(events.get('174:6'),['moveIn','fall','housing','widen','vacancy','fabric']);
  assert.deepEqual(events.get('29:1'),['moveIn','fall','widen','vacancy']);
  assert.deepEqual(events.get('29:361'),['moveIn','fall','widen','vacancy']);
  assert.deepEqual(events.get('6:0'),['moveIn','fall','housing','fabric']);
});

function occupancyHarness({heads,roof,dayValue=4}){
  const draws=[];
  const c=vm.createContext({
    W:{settlements:[]},
    day:()=>c.today,
    heads_:(s,pred)=>(s.heads||[]).filter(h=>!pred||pred(h)),
    capOf:()=>1,workOf:()=>({x:0,z:0}),homeScore:()=>1,
    updateBuildingInstance:b=>{c.updated.push(b);},
    tickGrowthHousing(){throw Error('housing must not run off its six-day cadence');},
    tickGrowthWiden(){throw Error('widening must not run off its annual date');},
    tickGrowthVacancy(){throw Error('vacancy assessment must not run off its annual date');},
    tickGrowthFabric(){throw Error('fabric work must not run off its six-day cadence');},
    chance:()=>{draws.push('chance');throw Error('occupancy/falls must not draw RNG');},
    frand:()=>{draws.push('frand');throw Error('occupancy/falls must not draw RNG');},
    randi:()=>{draws.push('randi');throw Error('occupancy/falls must not draw RNG');},
    rand:()=>{draws.push('rand');throw Error('occupancy/falls must not draw RNG');},
    wpick:()=>{draws.push('wpick');throw Error('occupancy/falls must not draw RNG');},
    today:dayValue,updated:[],draws
  });
  const snippets=[declaration('RESID'),declaration('VACANT_RESIDENTIALS'),fn('vacantResidentials'),fn('vacantResidentialChanged'),fn('moveIn'),fn('tickFalling'),growthWrapper];
  assert.ok(snippets.every(Boolean),'occupancy test needs current production helpers');
  vm.runInContext(snippets.join('\n'),c);
  const s={folk:heads.length?heads:[{}],heads,buildings:[roof],_falling:[roof],ruinCount:0};
  roof.s=s;roof._fallAt=dayValue;
  c.W.settlements.push(s);
  c.vacantResidentials(s);
  return {c,s,roof,draws};
}

test('a household moving in on the due day saves the scheduled roof before it falls',()=>{
  const h={w:10},roof={arch:'house',state:'sound',removed:false,hh:[],x:0,z:0};
  const {c,s,roof:r,draws}=occupancyHarness({heads:[h],roof});
  c.tickGrowth();
  assert.equal(h.bh,r);
  assert.equal(r.hh.length,1);
  assert.equal(r.hh[0],h);
  assert.equal(r.state,'sound');
  assert.equal(r._fallAt,0);
  assert.equal(s._falling.length,0);
  assert.equal(s.ruinCount,0);
  assert.deepEqual(draws,[]);
});

test('an empty roof falls on its due day without consuming RNG',()=>{
  const roof={arch:'house',state:'sound',removed:false,hh:[],x:0,z:0};
  const {c,s,roof:r,draws}=occupancyHarness({heads:[],roof});
  c.tickGrowth();
  assert.equal(r.state,'ruin');
  assert.equal(r.deserted,true);
  assert.equal(r._fallAt,0);
  assert.equal(s.ruinCount,1);
  assert.deepEqual(s._falling,[]);
  assert.equal(c.updated.length,1);
  assert.deepEqual(draws,[]);
});
