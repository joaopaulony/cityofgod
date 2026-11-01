const {makePlan}=require('../js/architecture-plan.js');
const fs=require('node:fs');
const cases={smallHome:[8,8,1,'house'],townhouse:[10,10,2,'house'],bungalow:[10,8,1,'bungalow'],poor:[8,8,2,'poor'],rural:[8,8,1,'rural'],mansionSmall:[16,11,2,'mansion'],mansionLarge:[20,14,2,'mansion'],shop:[10,10,2,'shop'],office:[18,18,11,'office'],condo:[18,14,10,'condo'],deco:[14,12,4,'deco'],projects:[22,10,3,'projects'],warehouse:[22,16,1,'warehouse'],airport:[36,14,1,'airport']};
const result={cases:0,floors:0,rooms:0,invalid:[],families:{},scope:'Semantic plan audit, not an aesthetic score. Spatial navigation is separately tested by property-plans.test.cjs.'};
for(const [name,[width,depth,floors,kind]] of Object.entries(cases))for(let seed=1;seed<=150;seed++){
 const p=makePlan({kind,width,depth,floors,seed,height:kind==='warehouse'?5.6:3.1});result.cases++;result.floors+=p.levels.length;result.rooms+=p.levels.reduce((n,l)=>n+l.rooms.length,0);result.families[p.family]=(result.families[p.family]||0)+1;
 if(!p.audit.passed)result.invalid.push({name,seed,problems:p.audit.problems});
}
result.passed=!result.invalid.length;
fs.mkdirSync('artifacts/architecture',{recursive:true});fs.writeFileSync('artifacts/architecture/plan-audit.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=1;
