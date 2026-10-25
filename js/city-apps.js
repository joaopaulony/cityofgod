// CityApps — aplicativos locais do celular CityOS; ações sempre ligadas ao CitySim.
'use strict';
const CityApps = (() => {
 const names={ camera:'Câmera',social:'CitySocial',jobs:'Carreiras',taxi:'Viagens',business:'Meus negócios',
   services:'Serviços',properties:'Imóveis',cars:'Concessionária',browser:'CityWeb',settings:'Aparência',calls:'Ligações' };
 const icons={camera:'📷',social:'🌐',jobs:'💼',taxi:'🚕',business:'🏪',services:'🛎️',properties:'🏠',cars:'🚗',browser:'🌍',settings:'🎨',calls:'📞'};
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let lastPhoto=null,lastPhotoUrl=null,selectedMode='world',lastCall='',frameTimestamp=0;
 const price=n=>CityLife.money(n);
 const btn=(action,label,dis=false)=>'<button class="city-action" data-action="'+esc(action)+'" type="button" '+(dis?'disabled':'')+'>'+label+'</button>';
 const card=(title,description,controls,icon='')=>'<article class="city-panel city-rich-card"><div class="city-rich-head"><span class="city-rich-icon">'+icon+'</span><div><h3>'+esc(title)+'</h3><p>'+esc(description)+'</p></div></div><div class="city-row city-rich-actions">'+controls+'</div></article>';
 const banner=txt=>'<div class="city-page-banner">'+txt+'</div>';
 function render(app) {
  const data=CitySim.data;
  if(app==='browser')return banner('<strong>CityWeb</strong><small>O portal da cidade · serviços simulados dentro do jogo</small>')+
    '<div class="city-app-grid">'+[
     ['cars','🚗','AutoShow'],['properties','🏠','CasaCerta'],['jobs','💼','VagasJá'],
     ['business','🏪','Negócios'],['services','🛎️','Serviços'],['taxi','🚕','CityTaxi']
    ].map(x=>'<button class="city-app" data-app="'+x[0]+'"><span class="city-app-icon">'+x[1]+'</span>'+x[2]+'</button>').join('')+'</div><p class="city-help">Este navegador contém portais fictícios integrados à economia do jogo, não sites externos.</p>';
  if(app==='jobs')return banner('<strong>Carreiras</strong><small>Conquiste seu próprio dinheiro</small>')+
    (data.job?card('Seu emprego: '+CitySim.JOBS[data.job].title,
      'Faça um turno a cada 4 minutos reais. O trabalho reduz energia, fome e sede.',
      btn('sim:work','Iniciar turno'),'💼'):'')+
    Object.entries(CitySim.JOBS).map(([id,j])=>card(j.title,j.detail+' · salário por turno '+price(j.pay),
      btn('sim:apply:'+id,id===data.job?'Emprego atual':'Candidatar-se',id===data.job),j.icon)).join('');
  if(app==='taxi')return banner('<strong>CityTaxi</strong><small>Viaje sem usar o mapa principal</small>')+
    '<p class="city-help">As corridas cobram o valor indicado e transferem o personagem para um ponto seguro próximo ao bairro. Animação do táxi será adicionada depois.</p>'+
    (CitySim.destinations().length?CitySim.destinations().map(d=>card(d.name,
      'Corrida '+price(d.price)+' · viagem expressa',btn('sim:travel:'+d.id,'Chamar corrida'),d.icon)).join(''):
      '<p class="city-help">Viagens disponíveis no mundo aberto.</p>');
  if(app==='business')return banner('<strong>Meus negócios</strong><small>Abasteça o caixa, monte a equipe e abra as portas</small>')+
    Object.entries(CitySim.BUSINESSES).map(([id,b])=>{
      const o=data.businesses[id];
      if(!o)return card(b.title,'Comprar estabelecimento · '+price(b.price),
        btn('sim:business-buy:'+id,'Adquirir',CityLife.funds<b.price),b.icon);
      return card(b.title,(o.open?'Aberto · ':'Fechado · ')+o.staff+' funcionário(s) · lucro por caixa: '+price(b.income*o.staff-25*o.staff),
        btn('sim:business:'+id+':toggle',o.open?'Fechar':'Abrir')+' '+btn('sim:business:'+id+':hire','Contratar (R$ 70)',o.staff>=3)+
        ' '+btn('sim:business:'+id+':fire','Demitir',o.staff===0)+' '+btn('sim:business:'+id+':collect','Fechar caixa',!o.open||!o.staff),b.icon);
    }).join('')+'<p class="city-help">Gestão econômica local: funcionários não aparecem como NPCs até a integração de IA e estabelecimentos.</p>';
  if(app==='services')return banner('<strong>Serviços da cidade</strong><small>Peça ajuda pelo telefone</small>')+
    Object.entries(CitySim.SERVICES).map(([id,v])=>card(v.title,v.note+' · '+price(v.price),
      btn('sim:service:'+id,'Contratar',CityLife.funds<v.price || (id==='adopt'&&!!data.pet)),v.icon)).join('')+
      (data.pet?'<div class="city-panel">🐶 Pet adotado: '+esc(data.pet)+'</div>':'');
  if(app==='properties'){
    const owned=data.ownedLots.map(l=>card(l.name,'Terreno adquirido · '+Math.round(l.area)+' m²',
      btn('sim:home:'+l.key,data.home?.name===l.name?'Residência atual':'Mudar para cá',data.home?.name===l.name),'🏡')).join('');
    return banner('<strong>CasaCerta</strong><small>Moradia e contas</small>')+
      '<div class="city-panel"><h3>Minha residência</h3><p>'+esc(data.home?.name||'Sem residência cadastrada')+'</p>'+
      '<div class="city-row"><strong>Contas pendentes</strong><strong>'+price(data.bills)+'</strong></div>'+
      btn('sim:bills','Pagar contas',!data.bills)+'</div>'+
      (!data.home?card('Quarto alugado (virtual)','Contrato inicial de aluguel com entrada de R$ 160. Não cria uma casa 3D automaticamente.',
         btn('sim:rent','Alugar',CityLife.funds<160),'🛏️'):'')+
      (owned||'')+
      '<div class="city-phone-label">Terrenos reais com placa VENDE-SE carregados por perto</div>'+
      (CitySim.nearbyLots().length?CitySim.nearbyLots().map(l=>card(l.name,
         Math.round(l.area)+' m² · '+price(l.price),btn('sim:lot:'+l.key,'Comprar',CityLife.funds<l.price),'🏘️')).join(''):
         '<p class="city-help">Aproxime-se de terrenos com placas VENDE-SE para ver ofertas reais do mapa.</p>');
  }
  if(app==='cars')return banner('<strong>AutoShow</strong><small>Garagem e concessionária virtual</small>')+
   '<p class="city-help">Compre veículos do catálogo 3D já existente. Após comprar, peça a entrega perto do personagem, se houver espaço livre.</p>'+
   Object.entries(CitySim.CARS).map(([id,car])=>card(car.title,
       (data.cars.includes(id)?'Na sua garagem':'Preço '+price(car.price)),
       data.cars.includes(id)?btn('sim:car-deliver:'+id,'Entregar veículo') :
       btn('sim:car-buy:'+id,'Comprar',CityLife.funds<car.price),car.icon)).join('');
  if(app==='settings'){
    const wallpaper=data.themes.wallpaper,caseColor=data.themes.caseColor;
    return banner('<strong>Seu estilo</strong><small>Personalize o celular do seu personagem</small>')+
     '<div class="city-panel"><h3>Papel de parede</h3><div class="city-swatches">'+
       ['ocean','rose','midnight','sunset'].map(v=>btn('sim:wallpaper:'+v,esc(({ocean:'Oceano',rose:'Rosa',midnight:'Noite',sunset:'Pôr do sol'})[v])+(wallpaper===v?' ✓':''))).join('')+'</div></div>'+
     '<div class="city-panel"><h3>Capinha</h3><div class="city-swatches">'+
       ['graphite','silver','pink','blue'].map(v=>btn('sim:case:'+v,esc(({graphite:'Grafite',silver:'Prata',pink:'Rosa',blue:'Azul'})[v])+(caseColor===v?' ✓':''))).join('')+'</div></div>';
  }
  if(app==='camera')return banner('<strong>CityCam</strong><small>Capture momentos da cidade</small>')+
    '<div class="city-panel"><h3>Enquadramento</h3><div class="city-row">'+
    btn('sim:photo:world','📷 Foto')+' '+btn('sim:photo:selfie','🤳 Selfie')+'</div>'+
    (lastPhotoUrl?'<img class="city-photo" alt="Última foto tirada no jogo" src="'+lastPhotoUrl+'"><div class="city-row">'+btn('sim:photo-download','Salvar foto PNG')+' '+btn('sim:photo-post','Postar no CitySocial')+'</div>':
      '<p class="city-help">Faça uma foto do mundo ao redor ou uma selfie com retrato do personagem. Você pode salvar o arquivo ou publicar a legenda no CitySocial.</p>')+'</div>';
  if(app==='social'){
   return banner('<strong>CitySocial</strong><small>Sua vida na cidade · feed local</small>')+
    '<form id="city-social-form" class="city-panel"><label for="city-social-text">Nova publicação</label>'+
    '<textarea id="city-social-text" maxlength="180" rows="3" placeholder="O que aconteceu por aí?"></textarea>'+
    '<div class="city-row"><small>'+(lastPhoto?'📷 Última foto da sessão disponível':'Adicione uma foto pela CityCam')+'</small>'+
    '<button type="submit" class="city-primary">Publicar</button></div></form>'+
    (data.posts.length?data.posts.slice().reverse().map(post=>'<article class="city-panel city-social-post"><b>👤 Você</b> <small>· '+new Date(post.time||0).toLocaleDateString('pt-BR')+'</small><p>'+esc(post.text)+'</p>'+
     (typeof post.photo==='string'&&post.photo.startsWith('data:image/jpeg;base64,')?'<img class="city-photo" alt="Foto publicada" src="'+post.photo+'">':'')+
     btn('sim:like:'+post.id,(post.likes?'❤️':'♡')+' '+(post.likes||0))+'</article>').join(''):
     '<div class="city-panel"><p>✨ Seu feed está vazio. Publique seu primeiro momento!</p></div>')+
     '<p class="city-help">Publicações locais neste navegador; perfis de outros jogadores exigirão backend online.</p>';
  }
  if(app==='calls')return banner('<strong>Ligações</strong><small>Chame seus contatos da cidade</small>')+
    ['Lucas','Ana'].map(name=>card(name,'Ligação simulada com NPC (não é chamada por voz)',
    btn('sim:call:'+name,'Ligar'),'📞')).join('')+
    (lastCall?'<div class="city-panel"><h3>Última ligação</h3><p>'+esc(lastCall)+'</p></div>':'');
  return '';
 }
 function afterRender(app){
  if(app==='social')document.getElementById('city-social-form')?.addEventListener('submit',e=>{
    e.preventDefault();
    const input=document.getElementById('city-social-text');
    let thumbnail=null;
    if(lastPhoto){
      const small=document.createElement('canvas');small.width=320;small.height=180;
      const sc=small.getContext('2d');sc.drawImage(lastPhoto,0,0,320,180);
      thumbnail=small.toDataURL('image/jpeg',.58);
    }
    const result=CitySim.post(input?.value,thumbnail);
    window.CityUI.notify(result.text);
    if(result.ok)window.CityUI.refreshPhone();
  });
 }
 function photo(mode){
  const view=document.getElementById('view'),vehicle=document.getElementById('vehicle3d');
  if(!view)return {ok:false,text:'Cena indisponível'};
  const canvas=document.createElement('canvas');
  canvas.width=Math.min(1280,Math.max(320,view.width));canvas.height=Math.min(720,Math.max(240,view.height));
  const ctx=canvas.getContext('2d');
  try{
    ctx.drawImage(view,0,0,canvas.width,canvas.height);
    if(vehicle)ctx.drawImage(vehicle,0,0,canvas.width,canvas.height);
    if(mode==='selfie' && typeof paintPortrait==='function'){
      const portrait=paintPortrait(100),size=Math.round(Math.min(canvas.width,canvas.height)*.34);
      ctx.save();
      ctx.fillStyle='#ffffffdd';ctx.beginPath();ctx.roundRect(15,15,size+12,size+12,20);ctx.fill();
      ctx.drawImage(portrait,21,21,size,size);ctx.restore();
      ctx.fillStyle='#fefefe';ctx.strokeStyle='#000b';ctx.lineWidth=3;ctx.font='700 19px system-ui';ctx.strokeText('SELFIE · CITY OF GOD',24,size+64);ctx.fillText('SELFIE · CITY OF GOD',24,size+64);
    }
    ctx.font='700 20px system-ui';ctx.fillStyle='#fff';ctx.strokeStyle='#000b';ctx.lineWidth=3;
    ctx.strokeText('CITY OF GOD',20,canvas.height-24);ctx.fillText('CITY OF GOD',20,canvas.height-24);
    if(lastPhotoUrl)URL.revokeObjectURL(lastPhotoUrl);
    lastPhoto=canvas;
    lastPhotoUrl=canvas.toDataURL('image/png'); // foto da sessão, sem salvar base64 no localStorage
    selectedMode=mode;frameTimestamp=Date.now();
    return {ok:true,text:mode==='selfie'?'Selfie registrada!':'Foto tirada!'};
  }catch(e){
    lastPhoto=null;lastPhotoUrl=null;
    return {ok:false,text:'Não foi possível capturar a cena neste navegador'};
  }
 }
 function download(){
  if(!lastPhotoUrl)return {ok:false,text:'Tire uma foto primeiro'};
  const a=document.createElement('a');a.href=lastPhotoUrl;
  a.download='city-of-god-'+frameTimestamp+'.png';document.body.appendChild(a);a.click();a.remove();
  return {ok:true,text:'Foto pronta para salvar'};
 }
 async function action(value) {
  const args=value.split(':');
  if(args[0]!=='sim')return null;
  const [_,type,id,arg]=args;
  let result;
  if(type==='apply')result=CitySim.applyJob(id);
  else if(type==='work')result=CitySim.work();
  else if(type==='travel')result=CitySim.travel(id);
  else if(type==='business-buy')result=CitySim.buyBusiness(id);
  else if(type==='business')result=CitySim.manage(id,arg);
  else if(type==='service')result=CitySim.service(id);
  else if(type==='rent')result=CitySim.rentApartment();
  else if(type==='home')result=CitySim.setHome(id);
  else if(type==='lot')result=CitySim.buyLot(id);
  else if(type==='bills')result=CitySim.payBills();
  else if(type==='car-buy')result=CitySim.buyCar(id);
  else if(type==='car-deliver')result=await CitySim.deliverCar(id);
  else if(type==='wallpaper'||type==='case'){
    const v=CitySim.data.themes;
    result=CitySim.theme(type==='wallpaper'?id:v.wallpaper,type==='case'?id:v.caseColor)
      ?{ok:true,text:'Aparência do celular atualizada'}:{ok:false,text:'Tema inválido'};
    window.CityUI.updatePhoneTheme();
  }
  else if(type==='photo')result=id==='world'||id==='selfie'?photo(id):
    id==='download'?download():id==='post'?(window.CityUI.goApp('social'),{ok:true,text:'Escreva a legenda no CitySocial'}):null;
  else if(type==='like')result=CitySim.like(id);
  else if(type==='call'){
    const line=id==='Lucas'?'Estou na cidade. Me chama se precisar de ajuda com uma entrega.':'Olá! Está tudo bem por aqui. Como anda a sua vida na cidade?';
    lastCall=id+': “'+line+'”';result={ok:true,text:'Ligação simulada concluída · '+id};
  }
  return result || {ok:false,text:'Ação indisponível'};
 }
 return {names,icons,render,afterRender,action};
})();
window.CityApps=CityApps;
