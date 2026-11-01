// Player remains in control: an NPC may offer a conversation, never choose the player's answer.
export function createSocialAutonomy({sim,actors,player,eligible=()=>true,canTalk=()=>true,blocked=()=>false,speak=()=>{},offer=()=>{},dismiss=()=>{},reply=()=>{},choose=()=>{},random=Math.random}){
 const cooldowns=new Map();let next=10,approach=null,pending=null;
 const distance=n=>Math.hypot(n.x-player().x,n.y-player().y);
 function restore(){if(!approach)return;const {npc,target,walk}=approach;npc.target=target;npc.walk=walk;npc.socialApproaching=false;approach=null;}
 function end(){restore();if(pending)pending.npc.socialUntil=Math.min(pending.npc.socialUntil||0,sim().time+1);pending=null;dismiss();}
 function respond(choice){
  const current=pending;if(!current)return false;
  const valid=!blocked()&&eligible(current.npc)&&canTalk(current.npc)&&!sim().unavailable('player',current.npc.lookId,current.intent.response);
  end();if(choice==='ignore')return true;if(!valid)return false;
  if(choice==='choose')choose(current.npc);else reply(current.npc,current.intent.response);return true;
 }
 function begin(npc,intent){
  restore();const p=player(),now=sim().time;npc.speed=0;npc.socialUntil=now+16;npc.face=Math.atan2(p.y-npc.y,p.x-npc.x);
  pending={npc,intent,until:now+15};speak(npc,intent.line);offer({id:npc.lookId,name:sim().people.get(npc.lookId).name,line:intent.line,action:intent.action,respond:choice=>respond(choice)});
 }
 return {respond,get active(){return !!pending;},get approaching(){return approach?.npc||null;},update(dt){
  const s=sim();if(!s)return;const now=s.time;
  if(blocked()){if(approach||pending)end();return;}
  if(pending){if(now>pending.until||!eligible(pending.npc)||!canTalk(pending.npc))end();return;}
  if(approach){
   const n=approach.npc;
   if(!eligible(n)||now>approach.until||distance(n)>12){restore();return;}
   if(distance(n)<3.6&&canTalk(n)){begin(n,approach.intent);return;}
   const moved=Math.hypot(n.x-approach.x,n.y-approach.y);approach.stuck=moved<.002?approach.stuck+dt:0;approach.x=n.x;approach.y=n.y;
   if(approach.stuck>4){restore();return;}
   n.target={x:player().x,y:player().y};return;
  }
  if(now<next)return;next=now+8;
  const candidates=actors().filter(n=>eligible(n)&&!n.target&&!(n.socialUntil>now)&&distance(n)<10&&(cooldowns.get(n.lookId)||0)<=now).sort((a,b)=>distance(a)-distance(b));
  for(const n of candidates){const intent=s.initiative(n.lookId,'player');if(!intent)continue;
   // Reserved NPCs approach less often, with a bounded retry cooldown.
   if(s.people.get(n.lookId).trait==='reservado'&&random()>.45){cooldowns.set(n.lookId,now+40);continue;}
   cooldowns.set(n.lookId,now+120);next=now+35;
   if(distance(n)<3.6&&canTalk(n))begin(n,intent);
   else{approach={npc:n,intent,until:now+14,x:n.x,y:n.y,stuck:0,target:n.target,walk:n.walk};n.socialApproaching=true;n.walk=Math.max(1.6,n.walk||1);n.pause=0;n.target={x:player().x,y:player().y};}
   break;
  }
 }};
}

export function installSocialIncoming(){
 const css=document.createElement('style');css.textContent=`#social-incoming{position:fixed;bottom:35px;left:24px;z-index:65;width:min(370px,calc(100vw - 48px));background:linear-gradient(white,#edf6fc);border:2px solid white;border-radius:20px;box-shadow:0 6px 25px #1b42552b;padding:16px;color:#3e6a8c;font:13px/1.5 'Segoe UI',system-ui}#social-incoming[hidden]{display:none}#social-incoming small{font-size:10px;color:#819caf;letter-spacing:1px}#social-incoming strong{display:block;font-size:16px}#social-incoming p{margin:9px 0 12px}#social-incoming button{font:600 11px system-ui;border:1px solid #bfd5e6;border-radius:18px;background:#fff;color:#39709b;padding:8px 12px;margin:3px;cursor:pointer}#social-incoming button:first-child{background:#eaf7d9;border-color:#a8ce7a;color:#5c8638}#social-incoming button:focus-visible{outline:3px solid #7fc444;outline-offset:2px}`;document.head.append(css);
 const card=document.createElement('aside');card.id='social-incoming';card.hidden=true;card.setAttribute('aria-label','Convite para conversar');document.body.append(card);let current=null;
 const heading=document.createElement('div');heading.setAttribute('aria-live','polite');card.append(heading);
 const buttons=document.createElement('div');card.append(buttons);
 card.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();current?.respond('ignore');}});
 for(const [value,label] of [['reply','Responder'],['choose','Escolher assunto'],['ignore','Agora não']]){const b=document.createElement('button');b.textContent=label;b.onclick=()=>current?.respond(value);buttons.append(b);}
 return {show(data){current=data;card.hidden=false;heading.replaceChildren();const tag=document.createElement('small');tag.textContent='ALGUÉM QUER CONVERSAR';const name=document.createElement('strong');name.textContent=data.name;const p=document.createElement('p');p.textContent=data.line;heading.append(tag,name,p);},hide(){card.hidden=true;current=null;},get active(){return !card.hidden;}};
}
