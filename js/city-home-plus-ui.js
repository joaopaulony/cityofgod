// UI extension for City Home Plus; every mutation goes through checked services.
'use strict';
const CityHomePlusUI=(()=>{
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const btn=(cmd,label,attrs='')=>'<button class="home-plus-button" data-home-extra="'+esc(cmd)+'" '+attrs+'>'+label+'</button>';
 const kinds=['bed','mattress','sofa','couch','sectional','chair','stove','fridge','toilet','shower','sink','tv','desk','microwave'];
 const label=kind=>({bed:'Dormir',mattress:'Descansar',sofa:'Sentar',couch:'Sentar',sectional:'Relaxar',
  chair:'Sentar',stove:'Cozinhar',fridge:'Comer',toilet:'Usar banheiro',shower:'Tomar banho',
  sink:'Lavar mãos',tv:'Assistir TV',desk:'Trabalhar',microwave:'Aquecer refeição'})[kind]||'Utilizar';
 function render(H,tab,floor){
   const p=CityHomePlus,info=p.data(H);
   if(tab==='renovate'){
     const rooms=p.rooms(H,floor);
     return '<h3>🎨 Reforma por cômodo</h3><p class="home-copy">Escolha o piso e a cor das paredes. O custo depende da área do cômodo.</p>'+
       rooms.filter(r=>r.use!=='circulation').map(room=>
         '<section class="home-plus-tile"><b>'+esc(room.id)+'</b><small>'+(Math.round((room.x1-room.x0)*(room.y1-room.y0)))+' m²</small>'+
         '<div class="home-finish-grid">'+p.finishes.map(f=>
           '<div class="home-finish-option"><i style="background:linear-gradient(135deg,'+f.wall+' 55%,'+f.floor+' 55%)"></i>'+
           '<small>'+esc(f.name)+'</small>'+
           btn('paint|'+floor+'|'+room.id+'|'+f.id+'|wall','Parede')+
           btn('paint|'+floor+'|'+room.id+'|'+f.id+'|floor','Piso')+'</div>').join('')+'</div></section>').join('')+
       '<p class="home-copy">Os materiais de parede e piso são gerados no interior existente, sem modificar a fachada externa.</p>';
   }
   if(tab==='lighting'){
     return '<h3>💡 Iluminação inteligente</h3><p class="home-copy">Luminárias internas com temperatura de cor, intensidade e interruptor.</p>'+
       btn('power','⚡ '+(info.power?'Desligar luzes':'Acender luzes'))+
       '<div class="home-plus-list">'+p.rooms(H,floor).filter(x=>x.use!=='circulation').map(r=>
         '<div class="home-plus-tile"><b>'+esc(r.id)+'</b> '+btn('addlight|'+floor+'|'+r.id,'+ Luminária · R$ 320')+'</div>').join('')+'</div>'+
       info.lights.filter(l=>l.floor===floor).map(l=>
         '<div class="home-plus-tile"><b>💡 '+esc(l.roomId)+'</b> · Intensidade '+l.intensity+
         '<div class="home-plus-actions">'+p.lightModes.map(mode=>btn('light|'+l.id+'|'+mode,mode)).join('')+
         btn('light|'+l.id+'|bright','+ brilho')+btn('light|'+l.id+'|dim','− brilho')+
         btn('light|'+l.id+'|remove','Retirar')+'</div></div>').join('');
   }
   if(tab==='blueprints'){
     return '<h3>📐 Projetos de decoração</h3><p class="home-copy">Salve até seis disposições dos móveis que já possui. Restaurar não duplica móveis nem dá itens grátis.</p>'+
       '<label class="home-plus-label">Nome do projeto<input id="city-home-plan-name" maxlength="36" placeholder="Meu apartamento moderno"></label>'+
       btn('saveplan','Salvar disposição atual')+
       p.projects(H).map((d,i)=>'<div class="home-plus-tile"><b>'+esc(d.name)+'</b> · '+d.rows.length+' móveis'+
         btn('applyplan|'+i,'Restaurar disposição')+'</div>').join('')+
       '<p>Valor estimado do imóvel mobiliado: <strong>'+CityLife.money(p.appraisal(H))+'</strong></p>';
   }
   if(tab==='living'){
     const placed=CityHome.placed(H).filter(x=>x.floor===floor);
     const hosts=placed.filter(r=>p.supports.has(r.kind));
     const objects=CityHome.inventory(H).filter(r=>p.decor.has(r.kind));
     return '<h3>🛋️ Casa funcional</h3><p class="home-copy">Interaja com os móveis que já possui para recuperar necessidades e fazer atividades domésticas.</p>'+
       placed.filter(r=>kinds.includes(r.kind)).map(r=>
        '<div class="home-plus-tile"><b>'+esc(CityHome.catalog[r.kind]?.name)+'</b> '+
          btn('use|'+r.id,label(r.kind))+'</div>').join('')+
       '<h3>Objetos apoiados</h3><p class="home-copy">Apoie livros, plantas, luminárias e micro-ondas em bancadas ou mesas.</p>'+
       (objects.length?objects.map(item=>
         '<div class="home-plus-tile"><b>'+esc(CityHome.catalog[item.kind]?.name)+'</b>'+
           hosts.map(host=>btn('mount|'+item.id+'|'+host.id,'Sobre '+esc(CityHome.catalog[host.kind]?.name))).join('')+
         '</div>').join(''):'<p class="home-empty">Compre objetos pequenos na loja e guarde-os no estoque.</p>')+
       '<h3>Conjuntos modulares</h3><p class="home-copy">Combine vários sofás modulares ou balcões: o encaixe magnético aproxima as peças até formar um conjunto.</p>';
   }
   if(tab==='guests'){
     return '<h3>🔐 Convidados e acesso</h3>'+
       '<p class="home-copy">Preferências locais para futuros convites multiplayer. O servidor ainda não usa essa lista como permissão real.</p>'+
       btn('guestmode|private','🔒 Apenas proprietário')+btn('guestmode|friends','👥 Amigos convidados')+
       '<p>Modo atual: <b>'+esc(info.guestMode)+'</b></p>'+
       '<label class="home-plus-label">Nome do morador convidado<input id="city-home-guest-name" maxlength="32" placeholder="Nome do NPC ou jogador"></label>'+
       btn('invite','Adicionar à lista local')+
       info.guests.map(g=>'<div class="home-plus-tile"><b>'+esc(g)+'</b>'+btn('removeguest|'+encodeURIComponent(g),'Remover')+'</div>').join('');
   }
   if(tab==='maintenance'){
     return '<h3>🧽 Manutenção da residência</h3>'+
       '<div class="home-condition"><strong>'+Math.round(info.condition)+'%</strong><span>Conservação do imóvel</span></div>'+
       '<p class="home-copy">A condição cai gradualmente a cada dia do jogo. Contrate limpeza ou reparos para recuperar o imóvel.</p>'+
       btn('service|clean','Limpeza · R$ 90')+
       btn('service|repair','Reparos · R$ 250')+
       '<h3>Economia doméstica</h3><p>Avaliação da residência, móveis e reformas: <b>'+CityLife.money(p.appraisal(H))+'</b></p>'+
       '<p class="home-copy">Despesas e manutenção são registradas na carteira local. Contas gerais continuam no sistema existente.</p>';
   }
   return '';
 }
 function act(H,cmd){
   const [kind,a,b,c,d]=cmd.split('|'),p=CityHomePlus;let result={ok:false,text:'Ação não reconhecida'};
   if(kind==='paint')result=p.decorate(H,Number(a),b,c,d);
   if(kind==='power')result=p.togglePower(H);
   if(kind==='addlight')result=p.installLight(H,Number(a),b);
   if(kind==='light')result=p.light(H,a,b);
   if(kind==='saveplan')result=p.capture(H,document.getElementById('city-home-plan-name')?.value);
   if(kind==='applyplan')result=p.apply(H,Number(a));
   if(kind==='guestmode')result=p.setGuestMode(H,a);
   if(kind==='invite')result=p.invite(H,document.getElementById('city-home-guest-name')?.value);
   if(kind==='removeguest')result=p.removeGuest(H,decodeURIComponent(a));
   if(kind==='service')result=p.repair(H,a);
   if(kind==='mount')result=CityHome.mountOn(H,a,b);
   if(kind==='use')result=p.activity(H,a);
   return result;
 }
 return {render,act};
})();
window.CityHomePlusUI=CityHomePlusUI;