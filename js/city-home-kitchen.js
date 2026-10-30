// Pantry and cooking: priced groceries and prepared portions per owned residence.
'use strict';
const CityHomeKitchen=(()=>{
 const KEY='cityofgod.home-pantry.v1';
 const recipes=[
  {id:'omelette',name:'Omelete',icon:'🍳',cost:0,ingredients:{eggs:2,milk:1},servings:1,energy:.08,food:.32,seconds:4},
  {id:'pasta',name:'Macarrão',icon:'🍝',cost:0,ingredients:{pasta:1,tomato:2},servings:2,energy:.06,food:.42,seconds:5},
  {id:'salad',name:'Salada',icon:'🥗',cost:0,ingredients:{greens:2,tomato:1},servings:1,energy:.10,food:.25,seconds:3.7},
  {id:'toast',name:'Sanduíche quente',icon:'🥪',cost:0,ingredients:{bread:2,cheese:1},servings:1,energy:.05,food:.36,seconds:3.6}];
 const bundles=[
  {id:'breakfast',name:'Kit café da manhã',price:45,stock:{eggs:6,milk:3,bread:4,cheese:2}},
  {id:'dinner',name:'Kit refeições',price:56,stock:{pasta:3,tomato:6,greens:4}},
  {id:'healthy',name:'Kit hortifruti',price:30,stock:{greens:5,tomato:5}}];
 let cache={},loaded=false;
 function load(){if(loaded)return;loaded=true;try{
  const raw=JSON.parse(localStorage.getItem(KEY)||'{}');
  if(raw&&typeof raw==='object'&&!Array.isArray(raw)){
   for(const [key,v] of Object.entries(raw)){
    if(key.length>180||!v||typeof v!=='object')continue;
    const stock={};
    for(const k of ['eggs','milk','pasta','tomato','greens','bread','cheese'])
      stock[k]=Math.min(99,Math.max(0,Number.isInteger(v.stock?.[k])?v.stock[k]:0));
    cache[key]={stock,portions:Math.max(0,Math.min(30,v.portions|0))};
   }
  }
 }catch(e){console.warn('Pantry load',e);}}
 function pantry(H){
  load();const id=CityHome.key(H);
  return cache[id]||(cache[id]={stock:{eggs:2,milk:1,pasta:1,tomato:2,greens:2,bread:2,cheese:1},portions:0});
 }
 function save(){try{localStorage.setItem(KEY,JSON.stringify(cache));return true;}catch(_){return false;}}
 function bundle(H,id){
  if(!CityHome.owned(H))return {ok:false,text:'Acesso negado'};
  const pack=bundles.find(b=>b.id===id);
  if(!pack)return {ok:false,text:'Produto inexistente'};
  const d=pantry(H),next={...d.stock};
  for(const [k,n] of Object.entries(pack.stock)){next[k]=(next[k]||0)+n;if(next[k]>99)return {ok:false,text:'Despensa cheia'};}
  if(!CityLife.debit(pack.price,'Mercado · '+pack.name))return {ok:false,text:'Saldo insuficiente'};
  const old=d.stock;d.stock=next;
  if(!save()){d.stock=old;CityLife.credit(pack.price,'Estorno mercado');return {ok:false,text:'Erro ao salvar compras'};}
  return {ok:true,text:pack.name+' guardado na despensa'};
 }
 function canPrepare(H,id){
  if(!CityHome.owned(H))return false;
  const recipe=recipes.find(r=>r.id===id);
  if(!recipe)return false;
  const s=pantry(H).stock;
  return Object.entries(recipe.ingredients).every(([key,qty])=>(s[key]||0)>=qty);
 }
 function prepare(H,id){
  if(!canPrepare(H,id))return {ok:false,text:'Faltam ingredientes nesta casa'};
  // Never spend ingredients before the character reaches the stove.
  return {ok:true,text:'Ingredientes disponíveis'};
 }
 function cook(H,id){
  if(!canPrepare(H,id))return {ok:false,text:'A despensa não tem mais os ingredientes'};
  const p=pantry(H),recipe=recipes.find(r=>r.id===id);
  if(p.portions+recipe.servings>30)return {ok:false,text:'Geladeira cheia de refeições'};
  for(const [k,v] of Object.entries(recipe.ingredients))p.stock[k]-=v;
  p.portions+=recipe.servings;
  if(!save()){
   for(const [k,v] of Object.entries(recipe.ingredients))p.stock[k]+=v;
   p.portions-=recipe.servings;return {ok:false,text:'Não foi possível salvar a refeição'};
  }
  return {ok:true,text:recipe.icon+' '+recipe.name+' pronto! '+recipe.servings+' porção(ões)'};
 }
 function eat(H){
  if(!CityHome.owned(H))return {ok:false,text:'Acesso negado'};
  const p=pantry(H);if(p.portions<1)return {ok:false,text:'Prepare uma receita antes de comer'};
  p.portions--;
  if(!save()){p.portions++;return {ok:false,text:'Não foi possível salvar a refeição'};}
  const state=CityLife.state||window.__game;
  if(state){state.food=Math.min(1,(state.food||0)+.38);state.needs&&(state.needs.energy=Math.min(1,(state.needs.energy||0)+.05));}
  CityLife.save();
  return {ok:true,text:'🍽️ Refeição consumida. Saciedade aumentada'};
 }
 function serveGuest(H){
  if(!CityHome.owned(H))return {ok:false,text:'A residência não está disponível.'};
  const p=pantry(H);if(p.portions<1)return {ok:false,text:'Não restou uma porção preparada para o convidado.'};
  p.portions--;if(!save()){p.portions++;return {ok:false,text:'Não foi possível guardar o consumo da refeição.'};}
  return {ok:true,text:'A refeição do convidado foi servida.'};
 }
 return {pantry,bundle,prepare,cook,eat,serveGuest,canPrepare,recipes,bundles};
})();
window.CityHomeKitchen=CityHomeKitchen;
