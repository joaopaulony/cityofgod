const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const vm=require('vm');

// prédio de apartamentos: cada andar acima do térreo é uma unidade; só o dono usa e mobilia a própria
function boot(){
  const store=new Map();
  const window={addEventListener(){},dispatchEvent(){},CityUI:{notify(){}}};
  const ctx=vm.createContext({window,console,Math,Date,JSON,Event:class{},
    localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},
    document:{addEventListener(){},getElementById:()=>null,createElement:()=>({}),body:{appendChild(){},classList:{add(){},remove(){}}}},
    houses:[]});
  for(const f of ['js/city-life.js','js/city-realty.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});
  window.CityLife.init({player:{x:0,y:0},hp:1,food:1,water:1,clock:0});
  return {life:window.CityLife,realty:window.CityRealty};
}
const level=(floor,rooms)=>({floor,rooms:rooms.map(([id,use])=>({id,use}))});
const condo=()=>({doorPt:[100,50],x0:90,y0:40,x1:110,y1:60,miaKind:'condo',architecture:{kind:'condo',levels:[
  level(0,[['hall','circulation'],['lobby','reception']]),
  level(1,[['hall','circulation'],['a','bedroom'],['b','living']]),
  level(2,[['hall','circulation'],['a','bedroom'],['b','living'],['c','kitchen']]),
  level(3,[['hall','circulation'],['a','bedroom']])]}});

test('prédio vira unidades por andar; casa comum não', () => {
  const {realty}=boot(), H=condo(), casa={doorPt:[0,0],x0:0,y0:0,x1:10,y1:8,miaKind:'bungalow',architecture:{kind:'bungalow',levels:[level(0,[['hall','circulation']])]}};
  assert.equal(realty.multi(H),true);assert.equal(realty.multi(casa),false);
  const u=realty.units(H);
  assert.deepEqual(u.map(x=>x.floor),[1,2,3]);
  assert.deepEqual(u.map(x=>x.rooms),[2,3,1],'conta os cômodos sem o corredor');
  assert.ok(u.every(x=>!x.mine&&x.price>=30000));
});

test('comprar uma unidade: só ela fica sua, mobiliada e com portas liberadas', () => {
  const {realty,life}=boot(), H=condo();
  life.credit(500000,'teste');
  const before=life.funds, r=realty.buyUnit(H,2);
  assert.equal(r.ok,true,r.text);
  assert.equal(before-life.funds,realty.unitPrice(H),'cobrou o preço da unidade');
  assert.equal(realty.ownsUnit(H,2),true);assert.equal(realty.ownsUnit(H,1),false);assert.equal(realty.ownsUnit(H,3),false);
  assert.deepEqual([0,1,2,3].map(f=>realty.canUse(H,f)),[true,false,true,false],'portaria livre, só o próprio andar');
  assert.deepEqual([0,1,2,3].map(f=>realty.canFurnishLevel(H,f)),[true,false,true,false],'mobília só na portaria e na unidade');
  assert.equal(realty.buyUnit(H,2).ok,false,'não compra a mesma duas vezes');
  assert.equal(realty.isOwned(H),true,'tem imóvel no prédio');
});

test('sem unidade: portaria aberta, apartamentos trancados e vazios', () => {
  const {realty}=boot(), H=condo();
  assert.equal(realty.canFurnish(H),true,'dá p/ entrar no prédio');
  assert.deepEqual([0,1,2,3].map(f=>realty.canUse(H,f)),[true,false,false,false]);
  assert.deepEqual([0,1,2,3].map(f=>realty.canFurnishLevel(H,f)),[true,false,false,false]);
  assert.equal(realty.buyUnit(H,0).ok,false,'o térreo não está à venda');
});
