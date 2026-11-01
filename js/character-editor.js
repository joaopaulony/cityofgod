// Small in-game appearance editor; assets remain the actual Tomb models.
(()=>{
 const button=document.createElement('button');button.id='character-editor-button';button.textContent='Personagem';
 button.style.cssText='position:fixed;left:calc(50% - 55px);top:16px;z-index:40;background:#172a2c;color:#eee;border:1px solid #889886;border-radius:5px;padding:8px;display:none';
 document.body.append(button);
 const dialog=document.createElement('dialog');dialog.id='character-editor';
 dialog.style.cssText='background:#16252b;color:#eee;border:1px solid #748b85;border-radius:10px;padding:22px;max-width:380px;font:15px system-ui';
 dialog.innerHTML='<h2 style="margin-top:0">Personagem · Tomb</h2><p>Compare os modelos no mapa principal.</p><label>Corpo <select id="tomb-sex"><option value="male">Masculino</option><option value="female">Feminino</option></select></label><p><label>Rosto <select id="tomb-face"></select></label></p><p><label>Tom de pele <select id="tomb-tone"><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></label></p><p><label>Camiseta <input type="color" id="tomb-shirt"></label> <label>Calça <input type="color" id="tomb-trousers"></label></p><p style="font-size:12px">Corpos, peles e rostos: Tomb.<br>Roupas e adaptação: City of God.</p><button id="tomb-close">Voltar ao jogo</button>';
 document.body.append(dialog);
 const field=id=>dialog.querySelector('#tomb-'+id);
 const faces=()=>{
  const c=window.cityCharacters,current=c.getAppearance(player);field('face').replaceChildren();
  for(const f of c.appearances().faces.filter(f=>f.sex===current.sex)){const option=document.createElement('option');option.value=option.textContent=f.name;field('face').append(option);}
  field('face').value=current.face;
 };
 button.onclick=()=>{const c=window.cityCharacters,current=c.getAppearance(player);if(!current)return;
  input.keys.clear();input.lmb=input.rmb=false;window.cityCharacterEditorOpen=true;
  for(const id of ['sex','tone','shirt','trousers'])field(id).value=current[id];faces();dialog.showModal();
 };
 field('sex').onchange=async()=>{await window.cityCharacters.setBody(player,field('sex').value);faces();};
 for(const id of ['face','tone','shirt','trousers'])field(id).onchange=()=>window.cityCharacters.setAppearance(player,{[id]:field(id).value});
 field('close').onclick=()=>dialog.close();dialog.onclose=()=>{window.cityCharacterEditorOpen=false;input.keys.clear();};
 setInterval(()=>{button.style.display=window.cityCharacters?.ready&&window.cityCharacters.provider==='tomb'?'block':'none';},300);
})();
