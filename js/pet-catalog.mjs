const color=(id,name,coat,patch,muzzle,eyes='#643e21')=>({id,name,coat,patch,muzzle,eyes});
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
  color('seal','Seal point','#dccbb0','#4c3c34','#635044','#62b9e6'),color('chocolate','Chocolate point','#eadcc4','#805c47','#957257','#73c7ed'),color('blue','Blue point','#d4d9da','#747d8c','#939aa7','#67b8e6')]}
]);
export const petBreed=id=>PET_BREEDS.find(b=>b.id===id);
export const petColor=(breed,id)=>breed.colors.find(c=>c.id===id)||breed.colors[0];
export function validPetRow(row){
 const breed=petBreed(row?.breed);
 return !!breed&&typeof row.id==='string'&&row.id.length<100&&typeof row.home==='string'&&row.home.length<180&&
  typeof row.name==='string'&&row.name.length>0&&row.name.length<=24&&breed.colors.some(c=>c.id===row.color);
}
