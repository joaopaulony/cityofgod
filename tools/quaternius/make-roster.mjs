// Gera assets/characters/modular/roster.json: o elenco de NPCs com os mesmos ids, nomes, grupos e papéis de antes
// (o sistema social guarda relações por id), agora vestidos com peças modulares da Quaternius.
// Uso: node tools/quaternius/make-roster.mjs [roster-antigo.json]
import fs from 'node:fs';
import {randomLook,normalizeLook,SKIN_TONES,HAIR_COLORS} from '../../js/modular-characters.mjs';

const manifest=JSON.parse(fs.readFileSync('assets/characters/modular/manifest.json','utf8'));
const oldFile=process.argv[2]||'assets/npcs/roster.json';
const PEOPLE=fs.existsSync(oldFile)?JSON.parse(fs.readFileSync(oldFile,'utf8')).characters.map(({id,name,group,role,sex})=>({id,name,group,role,sex}))
 :JSON.parse(fs.readFileSync('assets/characters/modular/roster.json','utf8')).characters.map(({id,name,group,role,sex})=>({id,name,group,role,sex}));

// uniformes por grupo: peças possíveis por encaixe e cores (top/bottom/shoes) fixas ou sorteadas
const U={
 // facções rivais: Last Kings (vermelho/preto), Noveli's Crew (azul/verde)
 'last-kings':{male:{head:['punk','casual_hoodie','casual_2','beach'],body:['casual_hoodie','punk','casual_2'],legs:['punk','casual_hoodie','casual_2'],feet:['casual_2','punk','casual_hoodie']},
  female:{head:['punk','casual','soldier','adventurer'],body:['punk','casual'],legs:['punk','casual'],feet:['punk','casual']},colors:{top:['#8e1f1f','#1b1b1e','#a32525'],bottom:['#1b1b1e','#2b2b30'],shoes:['#c43030','#1b1b1e']}},
 'novelis-crew':{male:{head:['casual_2','punk','beach','casual_hoodie','adventurer'],body:['casual_hoodie','casual_2','punk'],legs:['casual_hoodie','punk','casual_2'],feet:['casual_hoodie','casual_2']},
  female:{head:['soldier','punk','casual','adventurer'],body:['punk','casual','soldier'],legs:['punk','casual'],feet:['casual','punk']},colors:{top:['#1f4e8a','#2a6b3d','#173a63'],bottom:['#20262e','#2f3b2a'],shoes:['#e8e4dc','#1f4e8a']}},
 policia:{male:{head:['swat'],body:['swat'],legs:['swat'],feet:['swat']},female:{head:['soldier'],body:['soldier'],legs:['soldier'],feet:['soldier']},colors:{top:['#1d2a44'],bottom:['#1d2a44'],shoes:['#121417']}},
 bombeiros:{male:{head:['worker'],body:['worker'],legs:['worker'],feet:['worker']},female:{head:['worker'],body:['worker'],legs:['worker'],feet:['worker']},colors:{top:['#9a2a1c'],bottom:['#3a2f25'],shoes:['#1b1b1e']}},
 socorristas:{male:{head:['casual_2','suit'],body:['casual_2'],legs:['casual_2'],feet:['casual_2']},female:{head:['casual','soldier'],body:['casual'],legs:['casual'],feet:['casual']},colors:{top:['#f2efe8'],bottom:['#2f6a46'],shoes:['#f2efe8']}},
 operarios:{male:{head:['worker'],body:['worker'],legs:['worker','farmer'],feet:['worker']},female:{head:['worker'],body:['worker'],legs:['worker'],feet:['worker']},colors:{top:[''],bottom:[''],shoes:['']}},
 // moradores: roupa do dia a dia (sem capacete de obra/tático nem uniforme)
 urbano:{male:{head:['adventurer','beach','casual_2','casual_hoodie','farmer','punk','suit'],body:['beach','casual_2','casual_hoodie','suit','punk','adventurer','farmer'],legs:['beach','casual_2','casual_hoodie','suit','punk','adventurer','farmer'],feet:['beach','casual_2','casual_hoodie','suit','punk','adventurer','farmer']},
  female:{head:['adventurer','casual','formal','punk','soldier','suit'],body:['casual','formal','punk','suit','adventurer'],legs:['casual','formal','punk','suit','adventurer'],feet:['casual','formal','punk','suit','adventurer','soldier']},colors:null},
 motoboy:{male:{head:['swat'],body:['casual_hoodie','casual_2'],legs:['casual_2'],feet:['casual_2']},female:{head:['soldier'],body:['casual'],legs:['casual'],feet:['casual']},colors:{top:['#d98a2b','#c43030'],bottom:['#20262e'],shoes:['#1b1b1e']}},
};
// bases do jogador (CAS) e quem não tem uniforme
const FIXED={
 'char-principal-base':{sex:'female',head:'casual',body:'casual',legs:'casual',feet:'casual',skin:'#d2a47c'},
 'character-principal-base':{sex:'male',head:'casual_hoodie',body:'casual_hoodie',legs:'casual_hoodie',feet:'casual_hoodie',skin:'#b98059'},
 miguel:{sex:'male',head:'casual_2',body:'casual_2',legs:'casual_2',feet:'casual_2',skin:'#94603f',hair:'#1c1716'},
};
const pickBy=(a,seed)=>a[(seed>>>0)%a.length];
const out=PEOPLE.map((p,i)=>{
 let look;
 if(FIXED[p.id])look=normalizeLook(FIXED[p.id],manifest);
 else{
  const u=U[p.group],base=randomLook(p.sex,p.id,manifest,{street:true,pool:u?.[p.sex]});
  const h=[...p.id].reduce((s,c)=>s*31+c.charCodeAt(0)>>>0,7);
  if(u?.colors)for(const k of ['top','bottom','shoes'])base[k]=pickBy(u.colors[k],h>>>(k.length*3));
  if(p.group==='policia'||p.group==='bombeiros')base.hair=pickBy(HAIR_COLORS.slice(0,5),h);
  base.skin=pickBy(SKIN_TONES,h>>>5);
  look=normalizeLook(base,manifest);
 }
 return {...p,height:manifest[p.sex].height,look};
});
fs.writeFileSync('assets/characters/modular/roster.json',JSON.stringify({schema:2,rig:'quaternius-modular',note:'Gerado por tools/quaternius/make-roster.mjs: mesmos ids/nomes/grupos do elenco anterior, com peças modulares Quaternius (CC0).',characters:out},null,1));
console.log(out.length,'personagens');
for(const c of out)console.log(c.id.padEnd(26),c.group.padEnd(13),c.sex.padEnd(7),[c.look.head,c.look.body,c.look.legs,c.look.feet].join('/'),c.look.top||'-',c.look.skin);
