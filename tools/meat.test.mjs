// Meat is a third food (the user, 2026-10-08): made by slaughtering the herds' increase at Martinmas and by the butchers of a town,
// eaten one for one with bread and fish inside the food need, bought by its price as households choose among the foods, and by the
// better-off for their tables. The swine's litter, once a coin value and bacon counted as grain, is real meat; the pigs fed on the
// wood's mast pay its lord his pannage (#36).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {realm,near} from './ownership-fixture.mjs';

const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const BOOT="globalThis.LS={WILD:0,WOOD:1,TILLED:2,PASTURE:3,SCRUB:4,BURNT:5};globalThis.TILLERS=new Set(['ploughman','herdsman','shepherd']);globalThis.tills=()=>false;if(typeof CUSTOMS==='undefined')globalThis.CUSTOMS={pannage:0.1};";
const place=({commodity=false,households=2,cash=100,pop=10,grain=0,fish=0}={})=>{const r=realm({households,cash,pop,grain,fish,commodity,bootstrap:BOOT});
  r.eval("ownershipTick();trait=()=>0;TRADE_W={};SUNDRY={};SUNDRY_W=1");if(commodity)r.eval('storageInit(s)');return r;};
const herd=(r,o)=>r.eval(`(()=>{const H={${o}};s.stores.sheep=s.stores.cattle=s.stores.horses=s.stores.swine=0;for(const[k,v]of Object.entries(H))s.stores[k]=v;s._herdLast={sheep:s.stores.sheep,cattle:s.stores.cattle,horses:s.stores.horses,swine:s.stores.swine};})()`);
const held=(r,i,g)=>r.eval(`pantry(s,H[${i}]).${g}||0`);
const sale=(r,w,g)=>r.eval(`mkt(s,'${g}').get(${w})||0`);

for(const commodity of [false,true]){
  const how=commodity?'commodity ledger':'place stores';

  test(`the shambles makes meat for the beasts' owners, a carcass for each beast, and no grain (${how})`,()=>{
    const r=place({commodity});herd(r,'swine:10');r.eval("H[0].herd={swine:4};H[1].herd={swine:2}");
    r.eval("herdCull(s,'swine',5)"); // half the herd: each owner's half
    near(r.s.stores.swine,5);near(r.eval('H[0].herd.swine'),2);near(r.eval('H[1].herd.swine'),1);
    near(held(r,0,'meat'),2*1.5);near(held(r,1,'meat'),1*1.5);near(sale(r,"'crown'",'meat'),2*1.5); // the four of the herd no family owns are the lord's
    near(r.s.stores.meat,5*1.5);near(r.s.stores.grain,0);
  });

  test(`at Martinmas the year's litters go to the pot and the breeding stock is wintered (${how})`,()=>{
    const r=place({commodity});herd(r,'swine:10');r.eval("H[0].herd={swine:4};H[1].herd={swine:2};s.furl=[]");
    r.eval("martinmas(s,{pann:1e6,till:0},{swine:9.5,cattle:0,sheep:0,horses:0})"); // the sows that farrow 9.5 by next Martinmas: 9.5/1.9 = 5
    near(r.s.stores.swine,5);near(r.eval('H[0].herd.swine'),2);near(r.eval('H[1].herd.swine'),1);
    near(r.s.stores.meat,5*1.5);near(held(r,0,'meat'),3);near(sale(r,"'crown'",'meat'),3);
    near(r.eval('householdAccount(H[0]).assets._fresh'),r.eval('householdSize(s,H[0])*FOOD*FRESH')); // what the family eats fresh in the week it keeps, eaten first; the rest is salted
    const left=r.eval('householdAccount(H[0]).assets._fresh');r.eval('eatHouseholds(s,folkIndex())');near(held(r,0,'meat'),3-r.eval('householdSize(s,H[0])*FOOD'));
    near(r.eval('householdAccount(H[0]).assets._fresh'),left-r.eval('householdSize(s,H[0])*FOOD'));
  });

  test(`a pig's yield is the meat of its part of the litters, what the slaughter takes of a herd at its want (${how})`,()=>{
    const r=place({commodity});herd(r,'swine:19');r.eval("s.furl=[];martinmas(s,{pann:1e6,till:0},{swine:19,cattle:0,sheep:0,horses:0})");
    near(r.s.stores.meat/19,r.eval('LITTER'));near(r.eval("beastYield(s,'swine')"),3*r.eval('LITTER'));near(r.eval('BEAST_YR.swine()'),r.eval('GOODBASE.meat*LITTER'));
  });

  test(`cattle the owner's hay will not carry are killed at Martinmas, not starved; with the purse to buy hay they are wintered (${how})`,()=>{
    for(const cash of [0,100]){
      const r=place({commodity,households:1,cash});herd(r,'cattle:3');
      r.eval("s.px.cattle=12;s.px.hay=1;s.furl=[];H[0].herd={cattle:3};s.stores.hay=10;addHeld(s,H[0],'hay',1.05);offer(s,'hay','crown',8.95)"); // a cow's winter hay held; the lord's meadows' hay on sale
      r.eval("martinmas(s,{pann:0,till:0},{swine:0,cattle:3,sheep:0,horses:0})");
      if(cash){near(r.s.stores.cattle,3);near(held(r,0,'hay'),3*1.05);near(r.s.stores.meat||0,0);}
      else{near(r.s.stores.cattle,1);near(held(r,0,'meat'),2*4);} // kept unfed a cow is worth 73% of its milk and carcass, less than its carcass now
    }
  });

  test(`a household holding only meat eats it to its need (${how})`,()=>{
    const r=place({commodity,households:1});r.eval("s.stores.meat=10;addHeld(s,H[0],'meat',10)");
    const need=r.eval('householdSize(s,H[0])*FOOD');r.eval('eatHouseholds(s,folkIndex())');
    near(held(r,0,'meat'),10-need);near(r.eval('householdAccount(H[0]).hunger'),0);
  });

  test(`fish is eaten first, for it rots; then bread and salted meat as they lie in the larder (${how})`,()=>{
    const r=place({commodity,households:1});const need=r.eval('householdSize(s,H[0])*FOOD');
    r.eval(`s.stores.grain=3;s.stores.meat=1;s.stores.fish=${need/2};addHeld(s,H[0],'grain',3);addHeld(s,H[0],'meat',1);addHeld(s,H[0],'fish',${need/2});mkt(s,'grain').clear();mkt(s,'fish').clear();eatHouseholds(s,folkIndex())`);
    near(held(r,0,'fish'),0);near(held(r,0,'meat'),1-need/2/4);near(held(r,0,'grain'),3-need/2*3/4);
  });

  test(`where meat is the cheapest food at the table it is bought for the month (${how})`,()=>{
    const r=place({commodity,households:1,grain:100});r.eval("s.px.meat=1;s.stores.meat=100;offer(s,'meat','crown',100);provision(s,H,new Map())"); // salted, it keeps: bread at 1 with the miller's and the baker's part is 1.43
    const month=r.eval('householdSize(s,H[0])*FOOD*30');near(held(r,0,'meat'),month);near(held(r,0,'grain'),0);
    r.eval('s.px.meat=3;provision(s,H,new Map())');near(held(r,0,'meat'),month);near(held(r,0,'grain'),0); // what is in the larder is not bought again
  });

  test(`a food no one offers, at the price its last sale left, does not leave a household short of its month (${how})`,()=>{
    const r=place({commodity,households:1,grain:100});r.eval("s.px.meat=1;provision(s,H,new Map())");
    near(held(r,0,'grain'),r.eval('householdSize(s,H[0])*FOOD*30'));
  });

  test(`the better-off buy meat for their table, eat it with their bread, and buy less bread for it (${how})`,()=>{
    const table=cash=>{const r=place({commodity,households:1,cash,grain:100});r.eval("s.stores.meat=100;offer(s,'meat','crown',100);provision(s,H,new Map())");return r;};
    const poor=table(3),rich=table(1000),month=rich.eval('householdSize(s,H[0])*FOOD*30');
    assert.ok(held(rich,0,'meat')>held(poor,0,'meat'),`${held(rich,0,'meat')} against ${held(poor,0,'meat')}`);near(held(rich,0,'meat'),month); // no more than a month of its food
    near(held(rich,0,'grain'),month);
    const g0=held(rich,0,'grain'),m0=held(rich,0,'meat');rich.eval('eatHouseholds(s,folkIndex())');
    assert.ok(held(rich,0,'meat')<m0&&held(rich,0,'grain')<g0);near(g0-held(rich,0,'grain')+m0-held(rich,0,'meat'),month/30);
    rich.eval("for(let d=0;d<29;d++)eatHouseholds(s,folkIndex());s.px.meat=30;provision(s,H,new Map())"); // a month on, with meat now too dear for its table
    assert.ok(held(rich,0,'grain')<month*0.6,`${held(rich,0,'grain')} of bread: the meat it ate is bread it does not buy`);
  });

  test(`a butcher buys beasts only when the carcass, less his part, pays for the beast; from whoever keeps them, as many as the herd breeds (${how})`,()=>{
    for(const pig of [4,5]){
      const r=place({commodity,households:3,cash:200});herd(r,'swine:30,cattle:10,sheep:20'); // no bread on sale: the purses move only by the beasts
      r.eval(`H[0].tr='butcher';H[1].herd={swine:10};s.hm={bred:{swine:6,cattle:1,sheep:3}};s._graze={till:0};s._want={swine:9.5,cattle:0,sheep:0,horses:0};Object.assign(s.px,{swine:${pig},cattle:12,sheep:3,meat:4});offer(s,'cattle','crown',10);offer(s,'sheep','crown',20);provision(s,H,new Map())`);
      near(r.s.stores.cattle,10);near(r.s.stores.sheep,20); // an ox's carcass at 4, less his quarter, fetches 12, no more than the ox; a sheep's 1.8
      if(pig===5){near(r.s.stores.swine,30);near(sale(r,'H[0]','meat'),0);continue;} // nor a pig's, 4.5, at 5
      near(r.s.stores.swine,24);near(r.eval('H[1].herd.swine'),10-2);near(r.H[1].w,200+2*4);near(r.W.treasury,4*4); // the month's six pigs, a third of them the family's and the rest the lord's, each paid at its price
      near(sale(r,'H[0]','meat'),9);near(r.eval("rsv(s,'meat').get(H[0])"),24/9); // their meat, at what they cost him
    }
    const r=place({commodity,households:2,cash:200,grain:100});herd(r,'swine:7');
    r.eval("H[0].tr='butcher';s.hm={bred:{swine:6}};s._graze={till:0};s._want={swine:9.5,cattle:0,sheep:0,horses:0};Object.assign(s.px,{swine:4,meat:4});provision(s,H,new Map())");
    near(r.s.stores.swine,5); // the five sows that farrow the place's want are not his
  });

  test(`a household lays in only food that keeps the month: fish it buys day by day (${how})`,()=>{
    const r=place({commodity,households:1,grain:0,fish:100});r.eval("s.px.meat=1;provision(s,H,new Map())"); // meat at a stale price and none on sale; only fish to be had
    near(held(r,0,'fish'),0);near(held(r,0,'meat'),0);
    r.eval('eatHouseholds(s,folkIndex())');near(r.eval('householdAccount(H[0]).hunger'),0); // the day's fish, bought as it is eaten
  });

  test(`the table's meat gives way to its price against meat's worth, as wine does (${how})`,()=>{
    const r=place({commodity,households:1,cash:1000,grain:100});herd(r,'swine:10');
    r.eval("s.px.swine=4;s.px.meat=9;s.stores.meat=100;offer(s,'meat','crown',100);provision(s,H,new Map())"); // a pig at 4, its carcass 1.5, the butcher's quarter: meat is worth 3.56 here
    near(r.s._goodsWorth.meat,4/1.5/0.75);near(held(r,0,'meat'),r.eval('householdSize(s,H[0])*FOOD*30')*Math.pow(9/(4/1.5/0.75),-1.5));
  });

  test(`a cow's and a ewe's yield is what the herd gives: milk at the price of bread, a fleece, and the year's increase at the beast's price (${how})`,()=>{
    const r=place({commodity});r.eval("Object.assign(s.px,{grain:2,cattle:12,sheep:3,wool:4})");
    near(r.eval("beastYield(s,'cattle')"),0.1*12*2+0.22*12);near(r.eval("beastYield(s,'sheep')"),0.008*12*2+0.012*12*4+0.4*3);
    near(r.eval('BEAST_YR.cattle()'),0.1*12*2+0.22*12);
  });

  test(`pannage is the pigs fed on the mast × the custom × a pig's price the year round, paid to the wood's lord, and nothing for his own pigs (${how})`,()=>{
    for(const pann of [1e6,1.25]){
      const r=place({commodity,households:3,cash:100});herd(r,'swine:10');
      r.eval("W.houses[1]={name:'Vane',gold:0};W.houses[2]={name:'Other',gold:0};s.owner=1;s.px.swine=40;s._pxY={swine:4};H[0].herd={swine:4};H[1].herd={swine:2};H[2].w=0.1;H[2].herd={swine:1};s.furl=[{state:LS.WOOD,lord:1,area:1e4},{state:LS.WOOD,lord:-1,area:1e4},{state:LS.WOOD,lord:2,area:5e4}]"); // the third family can pay a tenth
      r.eval(`pannage(s,{pann:${pann}})`);const fed=Math.min(1,pann/0.25/10);
      near(r.eval('W.houses[1].gold'),(4+2)*fed*0.1*4+Math.min(0.1,1*fed*0.1*4));near(r.eval('W.houses[2].gold'),0); // the other lord's wood is not this place's mast
      near(r.H[0].w,100-4*fed*0.4);near(r.H[1].w,100-2*fed*0.4);
    }
  });
}

test('the shambles and the slaughter make meat, not grain, and the swine give no bacon as grain',()=>{
  const tick=source.slice(source.indexOf('function tickLivestock('),source.indexOf('\nfunction ',source.indexOf('function tickLivestock(')+1));
  assert.ok(!/St\.grain\s*\+=/.test(tick)&&tick.includes('herdCull(s,k,'));
  const produce=source.slice(source.indexOf('function herdProduce('),source.indexOf('\nfunction ',source.indexOf('function herdProduce(')+1));
  assert.ok(!/swine/.test(produce.split('/*')[0]),'herdProduce counts no pork as grain');
  assert.ok(!/butcher/.test(source.match(/^const SUNDRY=.*$/m)[0]),'the butcher lives by his meat, not by the sundries');
});
