import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {realm,near} from './ownership-fixture.mjs';

const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const fn=n=>source.match(new RegExp('^function '+n+'\\b[\\s\\S]*?(?=^function |^const |^/\\*|$(?![\\s\\S]))','m'))[0];
const shop=({commodity,cash=6,ore=0,char=0,oreSale=6,timberSale=6,po=1,pt=1}={})=>{
  const r=realm({commodity,households:1,cash,grain:0,fish:0});
  r.eval(`ownershipTick();H[0].tr='smith';s._smiths=1;s._dyers=0;s._vineHa=0;s.stores.tools=0;s.stores.wool=0;Object.assign(s.px,{ore:${po},timber:${pt},tools:10});s.stores.ore=${ore+oreSale};s.stores.timber=${char+timberSale};addHeld(s,H[0],'ore',${ore});addHeld(s,H[0],'char',${char});offer(s,'ore','crown',${oreSale});offer(s,'timber','crown',${timberSale})`);
  if(commodity)r.eval('storageInit(s)');
  const start=source.indexOf('    { // crafts where there are workshops'),end=source.indexOf('    for(const g of GOODS)',start);
  r.eval('globalThis.shopDay=function(s){const si=0,phaseK=commodityActive(s)?s.storage:undefined;'+source.slice(start,end)+'}');
  return r;
};
const buy=r=>r.eval("smithInputs(s,H[0],10,{po:price(s,'ore'),pt:price(s,'timber'),ore:avail(s,'ore',price(s,'ore')),timber:avail(s,'timber',price(s,'timber'))})");
const held=(r,g)=>r.eval(`pantry(s,H[0]).${g}||0`);

for(const commodity of [false,true]){
  const how=commodity?'balance ledger':'legacy stores';
  test(`existing ore buys only charcoal and produces tools (${how})`,()=>{
    const r=shop({commodity,ore:6});buy(r);
    near(held(r,'ore'),6);near(held(r,'char'),6);near(r.H[0].w,0);near(r.W.treasury,6);
    for(let d=0;d<30;d++)r.eval('shopDay(s)');
    near(r.s.stores.tools,8);near(r.s.stores.ore,6);near(r.s.stores.timber,0);
  });
  test(`existing charcoal buys only ore (${how})`,()=>{
    const r=shop({commodity,char:6});buy(r);near(held(r,'ore'),6);near(held(r,'char'),6);near(r.H[0].w,0);near(r.W.treasury,6);
  });
  test(`a small purse funds a usable pair at unequal prices (${how})`,()=>{
    const r=shop({commodity,po:2,pt:1});buy(r);near(held(r,'ore'),2);near(held(r,'char'),2);near(r.H[0].w,0);near(r.W.treasury,6);
  });
  test(`missing charcoal supply does not strand new ore (${how})`,()=>{
    const r=shop({commodity,timberSale:0});buy(r);near(held(r,'ore'),0);near(held(r,'char'),0);near(r.H[0].w,6);
  });
  test(`the thinner input supply bounds both purchases (${how})`,()=>{
    const r=shop({commodity,timberSale:1,cash:100});buy(r);near(held(r,'ore'),1);near(held(r,'char'),1);near(r.H[0].w,98);
  });
  test(`own inputs on sale are free even above the quoted price (${how})`,()=>{
    const r=shop({commodity,cash:0,ore:6,oreSale:0});
    r.eval("mkt(s,'timber').delete('crown');offer(s,'timber',H[0],6,100)");buy(r);
    near(held(r,'ore'),6);near(held(r,'char'),6);near(r.H[0].w,0);near(r.W.treasury,0);
  });
  test(`a shared market quote cannot allocate the same input twice (${how})`,()=>{
    const r=shop({commodity,cash:100,timberSale:1});
    r.eval("const Q={po:1,pt:1,ore:avail(s,'ore',1),timber:avail(s,'timber',1)};smithInputs(s,H[0],10,Q);smithInputs(s,H[0],10,Q)");
    near(held(r,'ore'),1);near(held(r,'char'),1);near(r.H[0].w,98);
  });
}

test('dear wool increases the flock target within grazing and plough-team limits',()=>{
  const r=shop({cash:100});r.eval('globalThis.herdWant='+fn('herdWant'));
  r.eval("s._pxN=12;s.pop=100;Object.assign(s.px,{grain:2,cattle:12,sheep:3,wool:0.1,hay:1});globalThis.grass={cap:50,till:60,pann:10}");
  const low=r.eval('herdWant(s,grass)');r.eval('s.px.wool=400');const high=r.eval('herdWant(s,grass)');
  assert.ok(high.sheep>low.sheep);assert.ok(high.cattle*0.6+high.horses*0.4>=10-1e-9);
  assert.ok(high.sheep*0.12+high.cattle+high.horses*1.1<=50+1e-9);
  const minCows=Math.max(10,(10-high.horses*0.4)/0.6);assert.ok(high.cattle>=minCows);
});

test('households buy and keep sheep by current wool yield, without a fixed flock limit',()=>{
  const run=wool=>{const r=shop({cash:1000});
    const start=source.indexOf('      { // the family\'s beasts:'),end=source.indexOf('\n    }\n    s._lux=',start);
    r.eval('globalThis.buyBeasts=function(s,h){const n=1,roof=0,famHerd={sheep:30,cattle:0,horses:0,swine:0};'+source.slice(start,end)+'}');
    r.eval(`globalThis.CUSTOMS={pannage:0.1};globalThis.TILLERS=new Set();globalThis.tills=()=>false;globalThis.purse=()=>10000;globalThis.spend=(who,v)=>{W.treasury-=v};globalThis.inDebt=()=>false;s.furl=[];s.hm={press:0.5};Object.assign(s.px,{grain:2,sheep:3,wool:${wool},hay:20});s.stores.sheep=40;H[0].herd={sheep:30};offer(s,'sheep','crown',10);buyBeasts(s,H[0])`);
    return r;};
  const low=run(0.1),high=run(400);
  assert.ok(low.eval('H[0].herd.sheep')<30,'unprofitable sheep are sold');
  near(high.eval('H[0].herd.sheep'),40);near(high.s.stores.sheep,40);
});

const fields=()=>{const r=realm({households:1,cash:1000,pop:5,grain:0,fish:0});
  r.eval("globalThis.LS={TILLED:2,PASTURE:3,WILD:0,SCRUB:4,WOOD:1,BURNT:5};globalThis.LK={FIELD:1,MEADOW:2,VINE:3,DEMESNE:4};globalThis.ARABLE=new Set([1,2,3,4]);globalThis.TILLERS=new Set(['ploughman']);globalThis.tills=h=>h.tr==='ploughman';globalThis.soilYield=()=>0.00001;globalThis.landWt=()=>1;globalThis.wpick=L=>L[0];ownershipTick();H[0].tr='ploughman';s.stores.sheep=50;s.stores.cattle=s.stores.horses=0;H[0].herd={sheep:50};s._pxN=12;s._gYield=0.00001;s._pxY={grain:2,hay:1,wool:400};s._dYr={wool:1.2};s.furl=[0,1].map(k=>({k,dom:0,lord:0,ten:'free',own:1,wk:1,kind:1,state:2,area:10000,trees:[],x:k*100,z:0,ar:1,n:1}));W.land={F:s.furl,perHead:4000};");
  r.eval(['grazeOf','sheepLand','sheepHolder','pasturePays','chooseLandUse','setFurlong','landYield','tickLand'].map(fn).join('\n'));
  return r;};
const choose=r=>r.eval('chooseLandUse(s,0,folkIndex())');

test('a wool shortage turns spare freehold corn land to grazing without losing the town\'s bread',()=>{
  const r=fields();choose(r);assert.equal(r.s.furl[0].state,3);assert.equal(r.s.furl[1].state,2);
  near(r.s._bearA,10000);near(r.H[0].w,1000);near(r.s.stores.sheep,50); // land changes now; neither beasts nor coin are invented
});

test('monthly land assignment preserves profitable pasture and its remaining corn field',()=>{
  const r=fields();choose(r);r.eval('day=()=>375;W.land.pathsDirty=false;tickLand()');
  assert.equal(r.s.furl[0].state,3);assert.equal(r.s.furl[1].state,2);assert.equal(r.s._needLand,false);assert.equal(r.s.landShort,undefined);
});

for(const [why,setup] of [
  ['cheap wool','s._pxY.wool=4'],
  ['no wool shortage','s._dYr.wool=0.6'],
  ['no breeding flock','H[0].herd.sheep=0;s.stores.sheep=0'],
  ['no spare purse for winter feed','H[0].w=0'],
  ['no spare corn','s._dYr.grain=10'],
  ['unconsented tenant land',"for(const f of s.furl)f.ten='villein'"],
  ['enough grass already',"s.furl.push({dom:0,lord:0,ten:'demesne',own:-1,wk:-1,kind:1,state:3,area:100000})"]
])test(`pasture expansion respects ${why}`,()=>{
  const r=fields();r.eval(setup);choose(r);assert.equal(r.s.furl[0].state,2);assert.equal(r.s.furl[1].state,2);
});

test('grazing returns to corn when the actual flock no longer pays for its land and corn is short',()=>{
  const r=fields();r.eval('s.furl[0].state=LS.PASTURE;s._pxY.wool=4;s._dYr.grain=10');choose(r);
  assert.equal(r.s.furl[0].state,2);near(r.s._bearA,20000);
});

test('pasture value shares the actual sheep across all their owner\'s grass, without counting them twice',()=>{
  const r=fields();r.eval('H[0].herd.sheep=1;s.stores.sheep=1;for(const f of s.furl)f.state=LS.PASTURE;globalThis.P=sheepLand(s,0,folkIndex())');
  assert.equal(r.eval('pasturePays(P,s.furl[0])'),false);assert.equal(r.eval('pasturePays(P,s.furl[1])'),false);
});

test('family co-owners share one flock, growth allowance and winter purse',()=>{
  const r=fields();r.eval("globalThis.partner={id:2,gn:'partner',si:0};s.folk.push(partner);bindHousehold(partner,householdAccount(H[0]));H[0].herd.sheep=2;s.stores.sheep=2;s.furl[1].own=s.furl[1].wk=2;for(const f of s.furl)f.state=LS.PASTURE;globalThis.P=sheepLand(s,0,new Map([[1,H[0]],[2,partner]]),true)");
  assert.equal(r.eval('P.owners.size'),1);near(r.eval('[...P.owners.values()][0].past'),20000);near(r.eval('[...P.owners.values()][0].grow'),0.8);
  assert.equal(r.eval('pasturePays(P,s.furl[0])'),false);assert.equal(r.eval('pasturePays(P,s.furl[1])'),false);
});
