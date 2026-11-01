// O carro que o jogador deixa na rua (fleetSaved) não pode virar objeto do setor que estava sendo gerado
// naquele instante: a limpeza ou o descarregamento do setor apagava o carro (sumia ao descer da van).
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'../js/openworld.js'),'utf8');
const cut=(from,to)=>{const a=src.indexOf(from),b=src.indexOf(to,a);assert.ok(a>=0&&b>a,'trecho '+from);return src.slice(a,b);};

test('setor em geração não captura o carro estacionado pelo jogador nem as paredes dele',()=>{
 const code=cut('const OW_TRACK','// índices de ocupação');
 const ctx={houses:[],boxes:[],fences:[],world:{props:[],circles:[],segs:[],upperSegs:[],lamps:[],yards:[],decals:[]},urbanLife:{litter:[],bins:[]},ecosystem:{flowers:[],butterflies:[]}};
 vm.createContext(ctx);vm.runInContext(code+';this.owSnap=owSnap;this.owCollect=owCollect;',ctx);
 const S={own:{}},snap=ctx.owSnap();
 const bench={kind:'bench',x:1,y:1},car={kind:'parkedcar',fleetSaved:true,x:5,y:5};
 ctx.boxes.push(bench,car);ctx.world.segs.push({sourceBox:bench},{sourceBox:car});
 ctx.owCollect(S,snap);
 assert.equal(S.own.boxes.length,1);assert.equal(S.own.boxes[0],bench);
 assert.equal(S.own.segs.length,1);assert.equal(S.own.segs[0].sourceBox,bench);
});
