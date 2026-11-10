// City Home visual editor: owner-only, mouse drag, rotation, placement preview.
'use strict';
const CityHomeUI=(()=>{
 let active=false,H=null,tab='shop',shopCategory='Tudo',floor=0,grid=true,draft=null,dragging=false,pan=null,view=null,panel=null,entry=null;
 let dragOffset=null,previewBox=null,previewBefore=null,previewAt=0;
 let oldCamera=null,oldFloor=null,lastOwner=null,lastCheck=0,selectedId=null;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const money=n=>CityLife.money(n);
 const message=(s,ok=true)=>{
   const el=document.getElementById('city-home-status');
   if(el){el.textContent=s;el.dataset.ok=ok?'1':'0';}
   window.CityUI?.notify?.(s);
 };
 const inside=p=>CityHome.houseAt(p);
 const uiId=id=>encodeURIComponent(id);
 // The 3D preview updates the transient world box only. Saves and collisions
 // remain authoritative until Confirm; cancel/close always restore the original.
 function clearPreview(){
   if(previewBox&&previewBefore){
     Object.assign(previewBox,previewBefore);
     world.version=(world.version||0)+1;
   }
   previewBox=previewBefore=null;previewAt=0;
 }
 function previewMove(force=false){
   if(!draft||draft.mode!=='move')return;
   if(!previewBox){
     previewBox=CityHome.nearbyItems(H,draft.floor).find(b=>b.homeId===draft.id)||null;
     if(previewBox)previewBefore={x:previewBox.x,y:previewBox.y,z:previewBox.z,rot:previewBox.rot,
       faceW:previewBox.faceW&&[...previewBox.faceW]};
   }
   if(!previewBox)return;
   previewBox.x=draft.x;previewBox.y=draft.y;previewBox.rot=draft.rot;
   if(previewBefore.faceW){
     const angle=Math.atan2(previewBefore.faceW[0],previewBefore.faceW[1])-(draft.rot-previewBefore.rot);
     previewBox.faceW=[Math.sin(angle),Math.cos(angle)];
   }
   const now=typeof performance!=='undefined'?performance.now():Date.now();
   if(force||now-previewAt>=50){
     previewAt=now;
     world.version=(world.version||0)+1;
   }
 }
 const clean=()=>{clearPreview();draft=null;dragging=false;selectedId=null;pan=null;dragOffset=null;};
 const canStart=()=>!window.cityVehicles?.driver&&!window.CityUI?.blocksGameInput?.()&&!window.cityCharacterEditorOpen&&!(typeof wmap!=='undefined'&&wmap.open);
 function current(){return H&&CityHome.owned(H)?H:null;}
 function center(){
   if(!H)return [0,0];
   if(H.architecture)return H.architecture.toWorld(H.architecture.width*.5,H.architecture.depth*.5);
   return [(H.x0+H.x1)/2,(H.y0+H.y1)/2];
 }
 function open(){
   if(active||!canStart())return false;
   const p=window.__game?.player,home=inside(p);
   if(!home){message('Entre em uma propriedade sua para decorar',false);return false;}
   {const u=window.CityRealty?.unitAt?.(home,p.x,p.y,p.floor||0);if(window.CityRealty?.canUse?.(home,p.floor||0,u===null?-1:u)===false){message('Entre no seu apartamento para decorar. Os outros apartamentos e o corredor não são seus.',false);return false;}}
   H=home;CityHome.sync(H);if(!CityHome.owned(H))return false;
   window.CityRealty?.close?.();
   floor=Math.max(0,Math.round(p.floor||0));oldFloor={floor:p.floor||0,floorZ:p.floorZ||0};
   oldCamera={x:cam.x,y:cam.y,zoom:cam.tzoom,tilt:cam.ttilt,ang:cam.tang};
   const c=center();
   cam.tx=c[0];cam.ty=c[1];cam.ttilt=.81;cam.tang=Math.PI/4;
   const width=H.architecture?.width||H.x1-H.x0,depth=H.architecture?.depth||H.y1-H.y0;
   cam.tzoom=Math.max(26,Math.min(78,Math.min(cam.W,cam.H)/Math.max(9,width,depth)*.87));
   active=true;clean();tab='shop';shopCategory='Tudo';document.body.classList.add('city-home-open');
   const root=ensure();root.hidden=false;entry.hidden=true;renderPanel();
   input.keys.clear();input.pressed.clear();input.lmb=false;input.rmb=false;p.wantShot=false;p.aiming=false;
   return true;
 }
 function close(){
   if(!active)return;
   active=false;clean();H=null;document.body.classList.remove('city-home-open');
   const el=document.getElementById('city-home-builder');if(el)el.hidden=true;
   if(oldCamera){cam.tx=window.__game?.player.x??oldCamera.x;cam.ty=window.__game?.player.y??oldCamera.y;cam.tzoom=oldCamera.zoom;cam.ttilt=oldCamera.tilt;cam.tang=oldCamera.ang;}
   if(oldFloor&&window.__game?.player){window.__game.player.floor=oldFloor.floor;window.__game.player.floorZ=oldFloor.floorZ;}
   oldFloor=null;oldCamera=null;lastCheck=0;tick();
 }
 const tintPresets=['#627d9b','#ae8273','#728e77','#c9b18b','#9675a8','#d3d8dd'];
 const chosenPaint=Object.create(null);
 let photoSerial=0,inspected=null;
 const paintOf=kind=>chosenPaint[kind]||CityHome.catalog[kind]?.top||'#8a98ad';
 function photo(kind,color,large=false){
   const fallback={sofa:'🛋️',couch:'🛋️',chair:'🪑',table:'🪑',tv:'📺',screen:'🖥️',
     rug:'◈',shelf:'📚',cabinet:'🚪',fridge:'🧊',stove:'🍳',sink:'🚰',counter:'🗄️',
     bed:'🛏️',mattress:'🛏️',wardrobe:'🚪',desk:'🖥️',studentdesk:'📚',mirror:'🪞',
     toilet:'🚽',shower:'🚿'};
   return '<span class="home-photo'+(large?' home-photo-large':'')+'">'+
     '<span class="home-photo-placeholder">'+(fallback[kind]||'◈')+'</span><img alt="Modelo 3D '+esc(CityHome.catalog[kind]?.name||kind)+
     '" data-preview-kind="'+kind+'" data-preview-color="'+esc(color)+'"></span>';
 }
 function palette(kind){
   const active=paintOf(kind);
   return '<div class="home-finish" role="group" aria-label="Cor de '+esc(CityHome.catalog[kind].name)+'">'+
     '<span>Acabamento</span>'+tintPresets.map(color=>
       '<button type="button" class="home-swatch '+(color.toLowerCase()===active.toLowerCase()?'on':'')+
       '" data-home-action="variant" data-value="'+kind+'" data-color="'+color+
       '" style="--swatch:'+color+'" title="Cor '+color+'" aria-label="Cor '+color+'" aria-pressed="'+
       String(color.toLowerCase()===active.toLowerCase())+'"></button>').join('')+
     '<label class="home-custom-color" title="Escolher outra cor"><input type="color" data-home-color="'+kind+
     '" value="'+active+'" aria-label="Cor personalizada"></label></div>';
 }
 function card(o,balance){
   const color=paintOf(o.kind);
   return '<article class="home-product home-catalog-card">'+
     '<button type="button" class="home-photo-button" data-home-action="inspect" data-value="'+o.kind+
       '" aria-label="Ver '+esc(o.name)+'">'+photo(o.kind,color,true)+'</button>'+
     '<div class="home-catalog-detail"><div class="home-product-head"><strong>'+esc(o.name)+
       '</strong><small>'+esc(o.category)+' · '+o.w.toFixed(2)+' × '+o.d.toFixed(2)+' m</small></div>'+
     palette(o.kind)+
     '<div class="home-buy-row"><strong class="home-price">'+money(o.price)+'</strong>'+
     '<button data-home-action="buy" data-value="'+o.kind+'" '+(balance<o.price?'disabled':'')+'>Comprar</button></div>'+
     (inspected===o.kind?'<p class="home-inspection">Prévia do móvel real do jogo. Você receberá a cor escolhida.</p>':'')+
     '</div></article>';
 }
 function previews(){
   const current=++photoSerial,images=[...panel.querySelectorAll('img[data-preview-kind]')];let i=0;
   function step(){
     if(current!==photoSerial||!active)return;
     let count=0;
     while(i<images.length&&count<2){
       const img=images[i++];
       if(!img.isConnected)continue;
       const data=window.cityVehicles?.furnitureThumbnail?.(img.dataset.previewKind,img.dataset.previewColor);
       if(data){img.src=data;img.parentElement?.classList.add('loaded');}
       count++;
     }
     if(i<images.length)requestAnimationFrame(step);
   }
   requestAnimationFrame(step);
 }
 function applyFloor(){
   const p=window.__game?.player;if(!active||!p||!H)return;
   p.floor=floor;p.floorZ=H.architecture?.levels?.[floor]?.z||floor*(H.floorHeight||3);
 }
 function renderPanel(){
   if(!active||!H)return;
   const root=ensure();
   const data=CityHome.placed(H),stock=CityHome.inventory(H),balance=CityLife.funds;
   const names={shop:'Loja de móveis',stock:'Meu estoque',edit:'Mobiliar',renovate:'Reforma',lighting:'Iluminação',blueprints:'Projetos',living:'Viver',guests:'Convites',realty:'Imóveis',maintenance:'Manutenção'};
   const nav=tabs=>tabs.map(t=>'<button type="button" data-home-action="tab" data-value="'+t+'" class="'+(tab===t?'on':'')+'" aria-pressed="'+(tab===t)+'">'+names[t]+'</button>').join('');
   const primary=['shop','stock','edit','renovate'],secondary=['lighting','blueprints','living','guests','realty','maintenance'];
   let rows='';
   if(tab==='shop'){
     const categories=['Tudo',...new Set(CityHome.list.map(o=>o.category))];
     rows='<div class="home-section-head"><div><small>CASACERTA HOME</small><h3>Móveis para a sua casa</h3><p>Escolha a peça e o acabamento. A compra vai para o seu estoque.</p></div><strong>'+CityHome.list.length+' peças</strong></div>'+
       '<div class="home-categories" aria-label="Filtrar móveis por ambiente">'+categories.map(c=>
         '<button type="button" data-home-action="category" data-value="'+esc(c)+'" class="'+(shopCategory===c?'on':'')+'" aria-pressed="'+(shopCategory===c)+'">'+esc(c)+'</button>').join('')+'</div>'+
       '<div class="home-catalog">'+CityHome.list.filter(o=>shopCategory==='Tudo'||o.category===shopCategory).map(o=>card(o,balance)).join('')+'</div>';
   }else if(tab==='stock'){
     rows=stock.length?stock.map(item=>'<div class="home-product">'+photo(item.kind,item.top)+'<div><strong>'+esc(CityHome.catalog[item.kind].name)+'</strong><small>Pronto para posicionar</small></div>'+
      '<button data-home-action="place" data-value="'+uiId(item.id)+'">Colocar</button><button class="quiet" data-home-action="sell" data-value="'+uiId(item.id)+'">Vender</button></div>').join(''):'<p class="home-empty">O estoque está vazio. Guarde um móvel ou compre novos na loja.</p>';
   }else if(tab==='edit'){
     const onFloor=data.filter(item=>item.floor===floor);
     rows='<p class="home-copy">Clique em um móvel no ambiente para arrastar e girar, ou selecione aqui.</p>'+
       (onFloor.length?onFloor.map(item=>'<div class="home-product">'+photo(item.kind,item.top)+'<div><strong>'+esc(CityHome.catalog[item.kind].name)+'</strong><small>'+Math.round(item.x)+', '+Math.round(item.y)+' · '+Math.round(item.rot*180/Math.PI)+'°</small></div>'+
        '<button data-home-action="move" data-value="'+uiId(item.id)+'">Mover</button><button data-home-action="duplicate" data-value="'+uiId(item.id)+'" title="Comprar cópia">＋</button><button class="quiet" data-home-action="store" data-value="'+uiId(item.id)+'">Guardar</button></div>').join(''):'<p class="home-empty">Sem móveis neste andar.</p>');
   }
   else rows=window.CityHomePlusUI?.render(H,tab,floor)||'<p>Indisponível</p>';
   const fcount=H.architecture?.levels?.length||(H.upper?2:1);
   const previousScroll=root.querySelector('.home-shop-content')?.scrollTop||0;
   root.innerHTML='<div class="home-header"><div><span>CITY OF GOD · CONSTRUIR E VIVER</span><h2>Minha casa</h2><p>'+esc(CityRealty.name(H))+' · Andar '+(floor+1)+'</p></div><button class="home-close" data-home-action="close" aria-label="Sair do modo decoração">✕</button></div>'+
    '<div class="home-summary"><span>Saldo disponível</span><strong>'+money(balance)+'</strong><span>'+data.length+' móveis em uso · '+stock.length+' no estoque</span></div>'+
    '<div class="home-tabs" role="navigation" aria-label="Gerenciar casa">'+nav(primary)+'</div>'+
    '<details class="home-more" '+(secondary.includes(tab)?'open':'')+'><summary>Mais opções · luz, projetos, vida e imóveis</summary><div class="home-secondary-tabs">'+nav(secondary)+'</div></details>'+
    '<div class="home-shop-content">'+rows+'</div>'+
    (draft?.mode==='move'?'<div class="home-color-palette"><span>Cor do móvel</span>'+tintPresets.map(c=>'<button type="button" data-home-action="paint" data-value="'+c+'" aria-label="Aplicar cor '+c+'" style="background:'+c+'"></button>').join('')+'</div>':'')+
    '<div class="home-footer"><div class="home-floor-control"><span>Andar</span>'+Array.from({length:Math.min(10,fcount)},(_,i)=>
      '<button data-home-action="floor" data-value="'+i+'" class="'+(floor===i?'on':'')+'">'+(i+1)+'</button>').join('')+'</div>'+
    '<div id="city-home-status" class="home-status" data-ok="1">'+(draft?'Movimente e confirme a peça':'Selecione um móvel para começar')+'</div>'+
    (fcount>1&&window.CityStairs?'<button class="home-stairs-tool" data-home-action="stairs" title="Escolha onde fica a escada · R gira · clique confirma">🪜 Posicionar escada</button>':'')+
    '<div class="home-footer-actions"><button data-home-action="grid">'+(grid?'▦ Grade ligada':'▦ Grade desligada')+'</button><button data-home-action="undo">↶ Desfazer</button><button data-home-action="confirm" class="primary">✓ Confirmar</button></div>'+
    '<details class="home-help"><summary>Controles e atalhos</summary><small>Arrastar: mover · R: girar 45° · Shift+R: giro fino · Scroll: zoom · Botão direito: câmera · Q/E: girar câmera · Delete: guardar · Ctrl+Z: desfazer · Esc: sair</small></details></div>';
   const body=root.querySelector('.home-shop-content');if(body)body.scrollTop=previousScroll;
   previews();
 }
 function ensure(){
   if(panel&&panel.isConnected)return panel;
   const el=document.createElement('aside');el.id='city-home-builder';el.hidden=true;el.setAttribute('aria-label','Modo decoração da casa');
   document.body.appendChild(el);panel=el;
   el.addEventListener('click',e=>{
     const extra=e.target.closest('[data-home-extra]');
     if(extra){
       const result=window.CityHomePlusUI?.act(H,extra.dataset.homeExtra);
       if(['use','recipe','eat','npcvisit'].includes(extra.dataset.homeExtra.split('|')[0])&&result?.ok){
         close();message(result.text,true);return;
       }
       renderPanel();message(result?.text||'Ação concluída',!!result?.ok);return;
     }
     const btn=e.target.closest('[data-home-action]');if(!btn)return;
     const action=btn.dataset.homeAction,value=decodeURIComponent(btn.dataset.value||'');
     if(action==='close'){close();return;}
     if(action==='tab'){if(draft)clean();tab=value;renderPanel();return;}
     if(action==='category'){shopCategory=value;renderPanel();return;}
     if(action==='floor'){clean();floor=Number(value);applyFloor();renderPanel();return;}
     if(action==='grid'){grid=!grid;renderPanel();return;}
     if(action==='undo'){clean();const r=CityHome.undo(H);renderPanel();message(r.text,r.ok);return;}
     if(action==='buy'){const r=CityHome.buy(H,value,paintOf(value));renderPanel();message(r.text,r.ok);return;}
     if(action==='variant'){chosenPaint[value]=btn.dataset.color;renderPanel();return;}
     if(action==='inspect'){inspected=inspected===value?null:value;renderPanel();return;}
     if(action==='move'){beginMove(value);return;}
     if(action==='duplicate'){
       const item=CityHome.find(H,value);
       const result=item?CityHome.buy(H,item.kind,item.top):{ok:false,text:'Móvel não encontrado'};
       renderPanel();message(result.ok?'Cópia comprada e enviada ao estoque':result.text,result.ok);return;
     }
     if(action==='place'){beginPlace(value);return;}
     if(action==='confirm'){confirm();return;}
     if(action==='stairs'){beginStairs();return;}
     if(action==='paint'){
       if(!draft||draft.mode!=='move')return;
       const r=CityHome.recolor(H,draft.id,value);
       if(r.ok){draft.top=value;draft.side=value;}renderPanel();message(r.ok?'Cor aplicada':r.text,r.ok);return;
     }
     if(action==='store'){const r=CityHome.store(H,value);clean();renderPanel();message(r.text,r.ok);return;}
     if(action==='sell'){const r=CityHome.sell(H,value);clean();renderPanel();message(r.text,r.ok);return;}
   });
   el.addEventListener('change',e=>{
     const input=e.target.closest('input[data-home-color]');
     if(!input)return;
     chosenPaint[input.dataset.homeColor]=input.value;
     renderPanel();
   });
   return el;
 }
 function beginMove(id){
   clearPreview();dragOffset=null;
   const row=CityHome.find(H,id);
   if(!row||row.status!=='placed')return;
   floor=row.floor;applyFloor();draft={id,kind:row.kind,mode:'move',x:row.x,y:row.y,rot:row.rot,
    w:row.w,d:row.d,h:row.h,z:row.z,floor:row.floor,status:'placed',top:row.top,side:row.side,solid:row.solid};
   selectedId=id;tab='edit';renderPanel();message('Mova o objeto com o mouse, gire com R e confirme');
 }
 function beginPlace(id){
   clearPreview();dragOffset=null;
   const row=CityHome.find(H,id);if(!row||row.status!=='stored')return;
   const p=window.__game?.player||{x:0,y:0};
   floor=Math.min(floor,(H.architecture?.levels?.length||1)-1);
   draft={...row,mode:'place',x:p.x,y:p.y,
    z:H.architecture?.levels?.[floor]?.z||floor*(H.floorHeight||3),floor};
   selectedId=id;applyFloor();renderPanel();message('Escolha a posição verde para colocar o móvel');
 }
 function test(){if(draft?.mode==='stair')return draft.spec?CityStairs.check(H,draft.spec):null;return draft&&CityHome.check(H,{...draft,status:'placed'},draft.mode==='move'?draft.id:null);}
 // escada: o contorno (dois lances, se houver vai-e-volta) segue o mouse no térreo; R gira 90°; clique confirma
 const STAIR_DIRS=[['y',1],['x',1],['y',-1],['x',-1]];
 function beginStairs(){
   if(!H?.architecture||H.architecture.levels.length<2)return;
   clearPreview();dragOffset=null;
   const cur=H.architecture.stairSpec||{x:0,y:0,axis:'y',dir:1,side:1};
   floor=0;applyFloor();draft={mode:'stair',spec:{...cur},turn:Math.max(0,STAIR_DIRS.findIndex(([a,d])=>a===cur.axis&&d===cur.dir)),z:0,top:'#70ffc7'};
   stairShape();renderPanel();message('Mova o mouse até onde quer a escada · R gira · clique p/ confirmar');
 }
 function stairShape(){
   const A=H.architecture,s=draft.spec,[axis,dir]=STAIR_DIRS[draft.turn%4];s.axis=axis;s.dir=dir;s.side=s.side||1;
   // contorno do 1º lance: retângulo a partir dos cantos da caixa na planta (vale p/ casa girada ou espelhada)
   const b=CityStairs.box(CityStairs.flightOf(s,0,A.levels.length)),p0=A.toWorld(b[0],b[1]),p1=A.toWorld(b[2],b[1]),p3=A.toWorld(b[0],b[3]),c=A.toWorld((b[0]+b[2])/2,(b[1]+b[3])/2);
   draft.x=c[0];draft.y=c[1];draft.w=Math.hypot(p1[0]-p0[0],p1[1]-p0[1]);draft.d=Math.hypot(p3[0]-p0[0],p3[1]-p0[1]);draft.rot=Math.atan2(p1[1]-p0[1],p1[0]-p0[0]);
   const el=document.getElementById('city-home-status'),r=test();if(el){el.textContent=r?.text||'Posicionando';el.dataset.ok=r?.ok?'1':'0';}
 }
 function pointerPosition(e){
   const z=draft?.z||H.architecture?.levels?.[floor]?.z||0;
   const pp=unproj(e.clientX/RS,e.clientY/RS,z);
   if(draft?.mode==='stair'){const q=H.architecture.toLocal(pp[0],pp[1]);draft.spec.x=Math.round(q[0]*4)/4;draft.spec.y=Math.round(q[1]*4)/4;stairShape();return;}
   if(draft){
     const nx=pp[0]+(dragOffset?.x||0),ny=pp[1]+(dragOffset?.y||0);
     draft.x=grid?Math.round(nx*2)/2:Math.round(nx*100)/100;
     draft.y=grid?Math.round(ny*2)/2:Math.round(ny*100)/100;
     const magnet=CityHome.snap(H,draft,draft.mode==='move'?draft.id:null);
     draft.x=magnet.item.x;draft.y=magnet.item.y;
     draft.snapGuides=magnet.guides;
     previewMove();
     const outcome=test(),el=document.getElementById('city-home-status');
     if(el){el.textContent=outcome?.text||'Posicionando';el.dataset.ok=outcome?.ok?'1':'0';}
   }
 }
 function confirm(){
   if(!draft)return;
   if(draft.mode==='stair'){const r=CityStairs.save(H,draft.spec);if(r.ok){clean();renderPanel();}message(r.text,r.ok);return;}
   const validation=test();
   if(!validation?.ok){message(validation?.text||'Local inválido',false);return;}
   const r=draft.mode==='place'?CityHome.place(H,draft.id,draft):CityHome.move(H,draft.id,draft);
   if(r.ok){clean();renderPanel();}
   message(r.text,r.ok);
 }
 function closest(e){
   const x=e.clientX/RS,y=e.clientY/RS;
   let result=null,score=Infinity;
   for(const b of CityHome.nearbyItems(H,floor)){
     const p=proj(b.x,b.y,(b.z||0)+Math.min(b.h,1)*.3);
     const d=Math.hypot(x-p.x,y-p.y)/Math.max(1,cam.zoom);
     if(d<Math.max(.55,Math.max(b.w,b.d)*.75)&&d<score){score=d;result=b;}
   }
   return result;
 }
 function onDown(e){
   if(!active||e.target!==view)return;
   e.stopImmediatePropagation();e.preventDefault();
   if(e.button===2){pan=[e.clientX,e.clientY];return;}
   if(e.button!==0)return;
   if(!draft){const b=closest(e);if(b)beginMove(b.homeId);}
   if(draft){pointerPosition(e);dragging=true;}
 }
 function onMove(e){
   if(!active)return;
   if(pan){
     const ax=(e.clientX-pan[0])/RS,ay=(e.clientY-pan[1])/RS;
     const v=screenDirToWorld(ax/cam.zoom,ay/(cam.zoom*TILT));
     cam.tx-=v[0];cam.ty-=v[1];pan=[e.clientX,e.clientY];
   }else if(draft&&e.target===view)pointerPosition(e);
   if(e.target===view){e.stopImmediatePropagation();e.preventDefault();}
 }
 function onUp(e){
   if(!active)return;
   if(pan&&e.button===2){pan=null;return;}
   if(e.button===0&&dragging&&e.target===view){dragging=false;confirm();}
   if(e.target===view){e.stopImmediatePropagation();e.preventDefault();}
 }
 function onKey(e){
   const typing=['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName);
   if(!active){
     if((e.key==='F7'||e.key.toLowerCase()==='b'&&e.altKey)&&!typing&&canStart()&&inside(window.__game?.player)){
       e.preventDefault();e.stopImmediatePropagation();open();
     }
     return;
   }
   if(typing)return;
   const k=e.key.toLowerCase();
   if(['escape','enter','delete','backspace','r','g','arrowup','arrowdown','arrowleft','arrowright'].includes(k)||e.ctrlKey&&k==='z'){
     e.preventDefault();e.stopImmediatePropagation();
   }else if(!e.ctrlKey&&!e.metaKey){e.stopImmediatePropagation();e.preventDefault();}
   if(k==='escape'){if(draft){clean();renderPanel();}else close();return;}
   if(e.ctrlKey&&k==='z'){const r=CityHome.undo(H);clean();renderPanel();message(r.text,r.ok);return;}
   if(k==='enter'){confirm();return;}
   if(k==='delete'||k==='backspace'){
     if(draft&&draft.mode==='move'){const r=CityHome.store(H,draft.id);clean();renderPanel();message(r.text,r.ok);}
     return;
   }
   if(k==='g'){grid=!grid;renderPanel();return;}
   if(k==='q'||k==='e'){cam.tang+=(k==='q'?1:-1)*Math.PI/8;return;}
   if(k==='r'&&draft?.mode==='stair'){draft.turn=(draft.turn+1)%4;stairShape();return;}
   if(k==='r'&&draft){
     draft.rot=(draft.rot+(e.shiftKey?Math.PI/16:Math.PI/4))%(Math.PI*2);
     pointerStatus();return;
   }
   const dirs={arrowup:[0,-1],arrowdown:[0,1],arrowleft:[-1,0],arrowright:[1,0]};
   if(draft&&dirs[k]){
     const n=e.shiftKey?.1:.5;
     draft.x+=dirs[k][0]*n;draft.y+=dirs[k][1]*n;pointerStatus();
   }
 }
 function pointerStatus(){
   previewMove(true);
   const r=test(),el=document.getElementById('city-home-status');
   if(el){el.textContent=r?.text||'Selecione uma posição';el.dataset.ok=r?.ok?'1':'0';}
 }
 function onWheel(e){
   if(!active||e.target!==view)return;
   e.preventDefault();e.stopImmediatePropagation();cam.tzoom=Math.max(20,Math.min(140,cam.tzoom*(e.deltaY<0?1.13:.89)));
 }
 function tick(){
   if(active)return;
   const p=window.__game?.player,now=typeof performance!=='undefined'?performance.now():Date.now();
   if(now-lastCheck<700)return;lastCheck=now;
   const candidate=canStart()?inside(p):null;
   const cu=candidate&&window.CityRealty?.unitAt?.(candidate,p.x,p.y,p.floor||0);
   const home=candidate&&window.CityRealty?.canUse?.(candidate,p.floor||0,cu===null?-1:cu)!==false?candidate:null;
   if(home){CityHome.sync(home);window.CityHomePlus?.tick(p);}
   if(entry){entry.hidden=!home;}
 }
 function draw(h){
   if(!active||!H)return;
   h.save();h.scale(RS,RS);
   // Discreet floor grid, drawn in the overlay without mutating terrain.
   const level=H.architecture?.levels?.[floor];
   const polys=level?.rooms?.filter(r=>r.use!=='circulation')||[];
   h.lineWidth=.8;h.strokeStyle='rgba(101,194,235,.20)';
   if(grid&&level?.rooms?.length){
     for(const room of polys){
       const xy=H.architecture.toWorld;
       for(let x=Math.ceil(room.x0);x<room.x1;x+=.5){
         const a=xy(x,room.y0),b=xy(x,room.y1),p=proj(a[0],a[1],level.z),q=proj(b[0],b[1],level.z);
         h.beginPath();h.moveTo(p.x,p.y);h.lineTo(q.x,q.y);h.stroke();
       }
       for(let y=Math.ceil(room.y0);y<room.y1;y+=.5){
         const a=xy(room.x0,y),b=xy(room.x1,y),p=proj(a[0],a[1],level.z),q=proj(b[0],b[1],level.z);
         h.beginPath();h.moveTo(p.x,p.y);h.lineTo(q.x,q.y);h.stroke();
       }
     }
   }
   if(draft){
     const allowed=test()?.ok;
     const ps=boxCorners(draft).map(([x,y])=>proj(x,y,draft.z||0));
     h.beginPath();ps.forEach((p,i)=>i?h.lineTo(p.x,p.y):h.moveTo(p.x,p.y));h.closePath();
     h.fillStyle=allowed?'rgba(49,222,155,.37)':'rgba(242,76,93,.37)';
     h.strokeStyle=allowed?'#70ffc7':'#ff6b80';h.lineWidth=3;h.fill();h.stroke();
     const center=proj(draft.x,draft.y,draft.z||0);
     h.textAlign='center';h.fillStyle='#fff';h.font='700 13px system-ui';
     h.fillText(CityHome.catalog[draft.kind]?.name||'Móvel',center.x,center.y-14);
     if(draft.snapGuides?.length){
       h.fillStyle='#a2ffcf';h.font='700 11px system-ui';
       h.fillText('⌖ Encaixado: '+[...new Set(draft.snapGuides)].join(' + '),center.x,center.y-31);
     }
   }
   h.restore();
 }
 function frame(dt){
   if(!active)return false;
   if(!CityHome.owned(H)){close();return false;}
   // World stays rendered, but actors, economy and physics remain paused while editing.
   if(draft?.floor!==undefined&&floor!==draft.floor){floor=draft.floor;applyFloor();}
   cam.update(dt);
   return true;
 }
 function mount(){
   if(view)return;
   CityHome.init();
   view=document.getElementById('view');
   entry=document.createElement('button');entry.id='city-home-entry';entry.type='button';
   entry.textContent='F7 · Modo Decoração';entry.hidden=true;
   entry.addEventListener('click',open);document.body.appendChild(entry);
   ensure();
   // Capture input on the play canvas before shooting/aiming listeners.
   view.addEventListener('mousedown',onDown,true);
   view.addEventListener('mousemove',onMove,true);
   view.addEventListener('mouseup',onUp,true);
   window.addEventListener('mouseup',e=>{if(active&&e.target!==view){dragging=false;pan=null;}},true);
   view.addEventListener('wheel',onWheel,{capture:true,passive:false});
   window.addEventListener('keydown',onKey,true);
   window.addEventListener('blur',()=>{dragging=false;pan=null;});
   window.addEventListener('pagehide',()=>{if(active)close();});
 }
 return {mount,open,close,tick,draw,frame,get active(){return active;},get property(){return H;},get draft(){return draft;}};
})();
window.CityHomeUI=CityHomeUI;
