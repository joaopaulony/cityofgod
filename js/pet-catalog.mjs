const color=(id,name,coat,patch,muzzle,eyes='#643e21')=>({id,name,coat,patch,muzzle,eyes});
// Quaternius: real skinned glTF characters with AnimationMixer; these sizes also
// serve the procedural safety fallback while a model is downloading.
const quaterniusBreed=cfg=>({id:cfg.id,name:cfg.name,species:cfg.species,
 label:cfg.species==='dog'?'Cachorro':cfg.species==='farm'?'Animal de fazenda':'Animal silvestre',
 asset:cfg.asset,assetHeight:cfg.height,
 size:cfg.height>=1?.95:.85,body:cfg.height>=1?.65:.45,width:cfg.height>=1?.20:.15,
 height:cfg.height>=1?.42:.29,head:.115,fur:'short',ears:'pointed',tail:'long',
 names:cfg.names,radius:cfg.height>=1?.20:.13,
 colors:[
  color('natural','Natural',cfg.coat,'#b18a69','#d4bb9b'),
  color('warm','Quente',cfg.coat,'#bd986f','#ddc4a0'),
  color('cool','Frio',cfg.coat,'#929ba4','#bdc4c7')
 ]
});
export const PET_BREEDS=Object.freeze([
 {id:'yorkshire',name:'Yorkshire',species:'dog',label:'Cachorro',size:.68,body:.35,width:.105,height:.24,head:.095,fur:'silky',ears:'pointed',tail:'feather',names:['Theo','Mel','Toby'],colors:[
  color('steel','Aço e dourado','#586471','#b68247','#d8b77b'),color('gold','Dourado','#a98654','#cfaa71','#ead2a7'),color('blacktan','Preto e canela','#303034','#aa7540','#c69b64')]},
 {id:'rottweiler',name:'Rottweiler',species:'dog',label:'Cachorro',size:1.1,body:.61,width:.185,height:.48,head:.145,fur:'short',ears:'folded',tail:'long',names:['Thor','Luna','Zeus'],colors:[
  color('tan','Preto e canela','#242327','#a56335','#b67a48'),color('mahogany','Preto e mogno','#1c1d22','#75422c','#935c39'),color('copper','Preto e cobre','#303035','#b57843','#cb915a')]},
 {id:'pomeranian',name:'Lulu da Pomerânia',species:'dog',label:'Cachorro',size:.7,body:.33,width:.14,height:.27,head:.105,fur:'fluffy',ears:'pointed',tail:'curl',names:['Pipoca','Nina','Floquinho'],colors:[
  color('orange','Laranja','#ca813b','#e4ad66','#f7ddae'),color('cream','Creme','#e5d4b4','#f4e7ce','#fff7e7'),color('sable','Sable','#786453','#b2936e','#e3c6a1')]},
 {id:'fluffycat',name:'Gato felpudo',species:'cat',label:'Gato',size:.85,body:.43,width:.145,height:.29,head:.105,fur:'fluffy',ears:'cat',tail:'plume',names:['Amora','Algodão','Mingau'],colors:[
  color('silver','Cinza e branco','#929ca6','#e5e8e7','#f3efea','#87ad71'),color('ginger','Ruivo e creme','#c9894d','#eed3ad','#fff0d8','#af9b45'),color('white','Branco','#e9e8df','#faf8ef','#fff9f0','#6ba3b8')]},
 {id:'slimcat',name:'Gato esguio',species:'cat',label:'Gato',size:.83,body:.46,width:.085,height:.31,head:.088,fur:'short',ears:'cat',tail:'long',names:['Salem','Lua','Chico'],colors:[
  color('black','Preto','#303137','#45454c','#53535b','#91b85f'),color('grey','Cinza','#818c95','#aeb6bd','#c4c7c8','#b6bd62'),color('ginger','Caramelo','#bd824e','#d9a46f','#efd6ad','#b5ad52')]},
 {id:'siamese',name:'Siamês',species:'cat',label:'Gato',size:.84,body:.44,width:.10,height:.30,head:.094,fur:'short',ears:'cat',tail:'long',names:['Suki','Mimi','Nino'],colors:[
  color('seal','Seal point','#dccbb0','#4c3c34','#635044','#62b9e6'),color('chocolate','Chocolate point','#eadcc4','#805c47','#957257','#73c7ed'),color('blue','Blue point','#d4d9da','#747d8c','#939aa7','#67b8e6')]},
  quaterniusBreed({"id":"alpaca","name":"Alpaca","species":"farm","asset":"Alpaca","height":1.22,"names":["Lola","Nina","Pérola"],"coat":"#c2b295"}),
  quaterniusBreed({"id":"bull","name":"Touro","species":"farm","asset":"Bull","height":1.25,"names":["Trovão","Brutus","Atlas"],"coat":"#554339"}),
  quaterniusBreed({"id":"cow","name":"Vaca","species":"farm","asset":"Cow","height":1.15,"names":["Mimosa","Estrela","Lua"],"coat":"#b2a89c"}),
  quaterniusBreed({"id":"deer","name":"Veado","species":"wild","asset":"Deer","height":1.04,"names":["Bambi","Mel","Flora"],"coat":"#a98760"}),
  quaterniusBreed({"id":"donkey","name":"Burro","species":"farm","asset":"Donkey","height":1.09,"names":["Bento","Zeca","Tico"],"coat":"#8e8478"}),
  quaterniusBreed({"id":"fox","name":"Raposa","species":"wild","asset":"Fox","height":0.58,"names":["Foxy","Fubá","Nina"],"coat":"#bd754a"}),
  quaterniusBreed({"id":"horse","name":"Cavalo","species":"farm","asset":"Horse","height":1.43,"names":["Raio","Apollo","Trovoada"],"coat":"#826d54"}),
  quaterniusBreed({"id":"horsewhite","name":"Cavalo branco","species":"farm","asset":"Horse_White","height":1.43,"names":["Neve","Branco","Nuvem"],"coat":"#dfddd2"}),
  quaterniusBreed({"id":"husky","name":"Husky","species":"dog","asset":"Husky","height":0.78,"names":["Loki","Koda","Sky"],"coat":"#889095"}),
  quaterniusBreed({"id":"shibainu","name":"Shiba Inu","species":"dog","asset":"ShibaInu","height":0.55,"names":["Hachi","Kira","Yuki"],"coat":"#b88656"}),
  quaterniusBreed({"id":"stag","name":"Cervo macho","species":"wild","asset":"Stag","height":1.28,"names":["Cedro","Orion","Vento"],"coat":"#8c6a4f"}),
  quaterniusBreed({"id":"wolf","name":"Lobo","species":"wild","asset":"Wolf","height":0.92,"names":["Ghost","Fenrir","Luna"],"coat":"#898d8c"})
]);
export const petBreed=id=>PET_BREEDS.find(b=>b.id===id);
export const petColor=(breed,id)=>breed.colors.find(c=>c.id===id)||breed.colors[0];
export function validPetRow(row){
 const breed=petBreed(row?.breed);
 return !!breed&&typeof row.id==='string'&&row.id.length<100&&typeof row.home==='string'&&row.home.length<180&&
  typeof row.name==='string'&&row.name.length>0&&row.name.length<=24&&breed.colors.some(c=>c.id===row.color);
}
