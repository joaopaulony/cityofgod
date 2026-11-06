// cas-studio.mjs — gestos/emotes do personagem: clipes reais das bibliotecas (Universal Animation Library 1 e 2 e os do
// pack modular da Quaternius), já no esqueleto de cada sexo (assets/characters/modular/*.glb). Cada gesto aponta p/ o
// nome do clipe; o jogo toca "cas_<id>" (character-webgl.mjs → spec.clips). loop: fica até o jogador se mexer.
export const CAS_EMOTES=Object.freeze({
 // conversa e expressão
 wave:{label:'Acenar',clip:'q_wave',group:'social'},
 yes:{label:'Concordar',clip:'yes',group:'social'},
 no:{label:'Discordar',clip:'idle_no',group:'social',loop:true,duration:2.5},
 cheer:{label:'Comemorar',clip:'ninja_jump_land',group:'social'},
 talk:{label:'Conversar',clip:'idle_talking',group:'social',loop:true,duration:8},
 phone:{label:'Falar ao celular',clip:'idle_talking_phone',group:'social',loop:true,duration:10},
 fold:{label:'Braços cruzados',clip:'idle_fold_arms',group:'social',loop:true,duration:10},
 call:{label:'Chamar alguém',clip:'idle_rail_call',group:'social'},
 dance:{label:'Dançar',clip:'dance',group:'social',loop:true,duration:12},
 // dia a dia
 sit:{label:'Sentar',clip:'sitting_idle',group:'daily',loop:true,duration:12},
 sit_talk:{label:'Conversar sentado',clip:'sitting_talking',group:'daily',loop:true,duration:10},
 eat:{label:'Comer / beber',clip:'consume',group:'daily'},
 pickup:{label:'Pegar objeto',clip:'pick_up_table',group:'daily'},
 interact:{label:'Mexer em algo',clip:'interact',group:'daily'},
 open:{label:'Abrir baú / caixa',clip:'chest_open',group:'daily'},
 lean:{label:'Apoiar no parapeito',clip:'idle_rail',group:'daily',loop:true,duration:12},
 push:{label:'Empurrar',clip:'push',group:'daily',loop:true,duration:5},
 torch:{label:'Lanterna',clip:'idle_torch',group:'daily',loop:true,duration:8},
 lantern:{label:'Lampião',clip:'idle_lantern',group:'daily',loop:true,duration:8},
 // trabalho
 kneel:{label:'Consertar ajoelhado',clip:'fixing_kneeling',group:'work',loop:true,duration:10},
 plant:{label:'Plantar',clip:'farm_plant_seed',group:'work'},
 harvest:{label:'Colher',clip:'farm_harvest',group:'work'},
 water:{label:'Regar',clip:'farm_watering',group:'work'},
 chop:{label:'Cortar lenha',clip:'tree_chopping',group:'work',loop:true,duration:6},
 // movimento e luta
 punch:{label:'Jab',clip:'punch_jab',group:'action'},
 cross:{label:'Direto',clip:'punch_cross',group:'action'},
 hook:{label:'Gancho',clip:'melee_hook',group:'action'},
 kick:{label:'Chute',clip:'q_kick_right',group:'action'},
 roll:{label:'Rolamento',clip:'roll',group:'action'},
 throw:{label:'Arremessar',clip:'overhand_throw',group:'action'},
 // diversão
 zombie:{label:'Zumbi',clip:'zombie_idle',group:'fun',loop:true,duration:8},
 scratch:{label:'Arranhão de zumbi',clip:'zombie_scratch',group:'fun'},
});
export const EMOTE_GROUPS=Object.freeze({social:'Conversa',daily:'Dia a dia',work:'Trabalho',action:'Movimento e luta',fun:'Diversão'});

// entradas "cas_<id>" p/ spec.clips de um personagem: só os gestos cujo clipe existe; duração = a do clipe
// (ou a escolhida, nos de laço). clips: spec.clips (nome → {name,duration,loop,speed})
export function emoteClipSpecs(clips){
 const out={};
 for(const [id,e] of Object.entries(CAS_EMOTES)){
  const c=clips[e.clip];if(!c)continue;
  out['cas_'+id]={name:c.name,duration:e.loop?(e.duration||c.duration):c.duration,loop:!!e.loop,speed:0};
 }
 return out;
}
// quanto tempo o gesto fica (s)
export const emoteDuration=(id,clips)=>{const e=CAS_EMOTES[id],c=clips?.['cas_'+id];return e?(e.loop?(e.duration||8):(c?.duration||2.5)):0;};
