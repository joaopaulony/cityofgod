const color=(id,name,coat,patch,muzzle,eyes='#643e21')=>({id,name,coat,patch,muzzle,eyes});
export const PET_BREEDS=Object.freeze([
 {id:"alpaca",name:"Alpaca",model:"Alpaca",species:"farm",label:"Animal de fazenda",targetHeight:1.13,size:1,radius:.23,names:["Lola","Nuvem","Mel"],colors:[
  color('original','Pelagem original','#ffffff','#ffffff','#ffffff'),
  color('warm','Tom quente','#f4dbc8','#f4dbc8','#f4dbc8'),
  color('cool','Tom frio','#d1dce8','#d1dce8','#d1dce8')]},
 {id:"bull",name:"Touro",model:"Bull",species:"farm",label:"Animal de fazenda",targetHeight:1.27,size:1,radius:.23,names:["Trovão","Atlas","Brutus"],colors:[
  color('original','Pelagem original','#ffffff','#ffffff','#ffffff'),
  color('warm','Tom quente','#f4dbc8','#f4dbc8','#f4dbc8'),
  color('cool','Tom frio','#d1dce8','#d1dce8','#d1dce8')]},
 {id:"cow",name:"Vaca",model:"Cow",species:"farm",label:"Animal de fazenda",targetHeight:1.16,size:1,radius:.23,names:["Mimosa","Bela","Amora"],colors:[
  color('original','Pelagem original','#ffffff','#ffffff','#ffffff'),
  color('warm','Tom quente','#f4dbc8','#f4dbc8','#f4dbc8'),
  color('cool','Tom frio','#d1dce8','#d1dce8','#d1dce8')]},
 {id:"deer",name:"Cervo",model:"Deer",species:"wild",label:"Animal silvestre",targetHeight:1,size:1,radius:.17,names:["Bambi","Bento","Aurora"],colors:[
  color('original','Pelagem original','#ffffff','#ffffff','#ffffff'),
  color('warm','Tom quente','#f4dbc8','#f4dbc8','#f4dbc8'),
  color('cool','Tom frio','#d1dce8','#d1dce8','#d1dce8')]},
 {id:"donkey",name:"Burro",model:"Donkey",species:"farm",label:"Animal de fazenda",targetHeight:1.05,size:1,radius:.17,names:["Zeca","Paco","Nico"],colors:[
  color('original','Pelagem original','#ffffff','#ffffff','#ffffff'),
  color('warm','Tom quente','#f4dbc8','#f4dbc8','#f4dbc8'),
  color('cool','Tom frio','#d1dce8','#d1dce8','#d1dce8')]},
 {id:"fox",name:"Raposa",model:"Fox",species:"wild",label:"Animal silvestre",targetHeight:0.52,size:1,radius:.17,names:["Rubi","Foxy","Luna"],colors:[
  color('original','Pelagem original','#ffffff','#ffffff','#ffffff'),
  color('warm','Tom quente','#f4dbc8','#f4dbc8','#f4dbc8'),
  color('cool','Tom frio','#d1dce8','#d1dce8','#d1dce8')]},
 {id:"horse",name:"Cavalo",model:"Horse",species:"farm",label:"Animal de fazenda",targetHeight:1.56,size:1,radius:.23,names:["Relâmpago","Troia","Raio"],colors:[
  color('original','Pelagem original','#ffffff','#ffffff','#ffffff'),
  color('warm','Tom quente','#f4dbc8','#f4dbc8','#f4dbc8'),
  color('cool','Tom frio','#d1dce8','#d1dce8','#d1dce8')]},
 {id:"horsewhite",name:"Cavalo branco",model:"Horse_White",species:"farm",label:"Animal de fazenda",targetHeight:1.56,size:1,radius:.23,names:["Neve","Nobre","Pérola"],colors:[
  color('original','Pelagem original','#ffffff','#ffffff','#ffffff'),
  color('warm','Tom quente','#f4dbc8','#f4dbc8','#f4dbc8'),
  color('cool','Tom frio','#d1dce8','#d1dce8','#d1dce8')]},
 {id:"husky",name:"Husky Siberiano",model:"Husky",species:"dog",label:"Cachorro",targetHeight:0.65,size:1,radius:.17,names:["Akira","Loki","Thor"],colors:[
  color('original','Pelagem original','#ffffff','#ffffff','#ffffff'),
  color('warm','Tom quente','#f4dbc8','#f4dbc8','#f4dbc8'),
  color('cool','Tom frio','#d1dce8','#d1dce8','#d1dce8')]},
 {id:"shibainu",name:"Shiba Inu",model:"ShibaInu",species:"dog",label:"Cachorro",targetHeight:0.52,size:1,radius:.17,names:["Hachi","Yuki","Kiko"],colors:[
  color('original','Pelagem original','#ffffff','#ffffff','#ffffff'),
  color('warm','Tom quente','#f4dbc8','#f4dbc8','#f4dbc8'),
  color('cool','Tom frio','#d1dce8','#d1dce8','#d1dce8')]},
 {id:"stag",name:"Cervo de chifres",model:"Stag",species:"wild",label:"Animal silvestre",targetHeight:1.25,size:1,radius:.23,names:["Cedro","Dourado","Caju"],colors:[
  color('original','Pelagem original','#ffffff','#ffffff','#ffffff'),
  color('warm','Tom quente','#f4dbc8','#f4dbc8','#f4dbc8'),
  color('cool','Tom frio','#d1dce8','#d1dce8','#d1dce8')]},
 {id:"wolf",name:"Lobo",model:"Wolf",species:"wild",label:"Animal silvestre",targetHeight:0.67,size:1,radius:.17,names:["Fang","Lua","Koda"],colors:[
  color('original','Pelagem original','#ffffff','#ffffff','#ffffff'),
  color('warm','Tom quente','#f4dbc8','#f4dbc8','#f4dbc8'),
  color('cool','Tom frio','#d1dce8','#d1dce8','#d1dce8')]}
,
 {id:"sharpei",name:"Shar Pei",model:"SharPei",species:"dog",label:"Cachorro",targetHeight:0.59,size:1,radius:0.17,names:["Bao","Amora","Duke"],colors:[
  color('original','Pelagem original','#ffffff','#ffffff','#ffffff'),
  color('warm','Tom quente','#f4dbc8','#f4dbc8','#f4dbc8'),
  color('cool','Tom frio','#d1dce8','#d1dce8','#d1dce8')]},
 {id:"benny",name:"Benny · Rottweiler",model:"Benny",species:"dog",label:"Cachorro",targetHeight:0.72,size:1,radius:0.2,names:["Benny","Thor","Zeus"],colors:[
  color('original','Pelagem original','#ffffff','#ffffff','#ffffff'),
  color('warm','Tom quente','#f4dbc8','#f4dbc8','#f4dbc8'),
  color('cool','Tom frio','#d1dce8','#d1dce8','#d1dce8')]}
]);
// Removed from adoption in 2026-10. Old save rows are archived by the controller.
export const RETIRED_BREED_IDS=Object.freeze(['yorkshire','rottweiler','pomeranian','fluffycat','slimcat','siamese']);
export const petBreed=id=>PET_BREEDS.find(b=>b.id===id);
export const petColor=(breed,id)=>breed.colors.find(c=>c.id===id)||breed.colors[0];
export function validPetRow(row){
 const breed=petBreed(row?.breed);
 return !!breed&&typeof row.id==='string'&&row.id.length<100&&typeof row.home==='string'&&row.home.length<180&&
  typeof row.name==='string'&&row.name.length>0&&row.name.length<=24&&breed.colors.some(c=>c.id===row.color);
}
