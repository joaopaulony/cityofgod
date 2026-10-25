import * as T from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {buildCartoon,normalizeLook,DEFAULT_LOOK} from './cartoon-character.mjs';
export const LOOK_KEY='cityofgod.cartoon.v1';
export function loadLook(){try{const raw=localStorage.getItem(LOOK_KEY);return raw?normalizeLook(JSON.parse(raw)):null;}catch{return null;}}

export function installCartoonCreator(system,bridge,source){
 const dialog=document.createElement('dialog');dialog.id='cartoon-creator';
 dialog.style.cssText='border:1px solid #718999;border-radius:18px;background:#14212e;color:#f4eee4;padding:20px;width:min(850px,90vw);max-height:90vh;overflow:auto;font:15px system-ui';
 dialog.innerHTML=`<h2 style="margin:0 0 8px">Seu personagem</h2><p>Crie sua identidade em City of God. Você pode editar novamente pelo botão Personagem.</p><div style="display:flex;flex-wrap:wrap;gap:24px"><canvas aria-label="Prévia 3D do personagem" width="380" height="470" style="position:static;inset:auto;display:block;z-index:auto;width:min(380px,100%);height:470px;border-radius:12px;background:#293e50"></canvas><form method="dialog" style="flex:1;min-width:220px"><label>Nome <input name="name" maxlength="24" required></label><p><label>Cabelo <select name="style"><option value="long">Longo</option><option value="bob">Curto arredondado</option><option value="braids">Tranças estilizadas</option><option value="short">Curto lateral</option></select></label></p><div id="cartoon-colors"></div><p><label>Silhueta <input name="shape" type="range" min="0" max="1" step=".05"></label></p><p><label>Largura do rosto <input name="face" type="range" min=".85" max="1.15" step=".025"></label></p><p><label>Tamanho dos olhos <input name="eyeSize" type="range" min=".85" max="1.15" step=".025"></label></p><p><label>Girar prévia <input name="rotation" type="range" min="-3.14" max="3.14" step=".05" value="0"></label></p><button type="button" id="cartoon-cancel">Cancelar</button> <button type="submit">Salvar e jogar</button><p role="status" id="cartoon-message"></p></form></div>`;
 const form=dialog.querySelector('form'),colors=dialog.querySelector('#cartoon-colors');
 for(const [key,label] of Object.entries({skin:'Pele',hair:'Cabelo',eyes:'Olhos',shirt:'Roupa superior',pants:'Calça'})){
  const row=document.createElement('label');row.style.cssText='display:flex;justify-content:space-between;margin:8px 0';row.textContent=label;const input=document.createElement('input');input.name=key;input.type='color';row.append(input);colors.append(row);
 }
 const button=document.createElement('button');button.textContent='Personagem';button.id='cartoon-editor-button';button.style.cssText='position:fixed;top:16px;left:calc(50% - 50px);z-index:40;padding:9px;border-radius:8px;background:#14212e;color:white;border:1px solid #718999';
 document.body.append(dialog,button);
 const canvas=dialog.querySelector('canvas'),renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(380,470,false);renderer.outputColorSpace=T.SRGBColorSpace;
 const scene=new T.Scene();scene.background=new T.Color('#293e50');scene.add(new T.HemisphereLight(0xfff4e5,0x526b8e,2.5));
 const key=new T.DirectionalLight(0xffe5cf,3);key.position.set(2,3,4);scene.add(key);const rim=new T.DirectionalLight(0xa8d6ff,2);rim.position.set(-3,2,-2);scene.add(rim);
 const camera=new T.PerspectiveCamera(32,380/470,.01,20);camera.position.set(0,1.15,4.4);camera.lookAt(0,1.05,0);
 const root=clone(source.scene);scene.add(root);let preview;const rest=[];root.traverse(o=>{if(o.isBone)rest.push([o,o.position.clone(),o.quaternion.clone(),o.scale.clone()]);});
 const mixer=new T.AnimationMixer(root);const idle=source.animations.find(c=>c.name==='idle');if(idle)mixer.clipAction(idle).play();
 let last=performance.now();function animate(now){const dt=Math.min(.05,(now-last)/1000);last=now;if(dialog.open){mixer.update(dt);render();}requestAnimationFrame(animate);}requestAnimationFrame(animate);
 const values=()=>normalizeLook(Object.fromEntries(new FormData(form)));
 function render(){renderer.render(scene,camera);}
 function refresh(){root.rotation.y=0;for(const [b,p,q,s] of rest){b.position.copy(p);b.quaternion.copy(q);b.scale.copy(s);}preview=buildCartoon(root,values());root.rotation.y=Number(form.elements.rotation.value);render();}
 function open(){const look=system.getAppearance(bridge.player)||DEFAULT_LOOK;for(const [k,v] of Object.entries(look))if(form.elements[k])form.elements[k].value=v;
  window.cityCharacterEditorOpen=true;window.dispatchEvent(new Event('blur'));dialog.showModal();refresh();}
 button.onclick=open;
 form.oninput=e=>{if(e.target.name==='rotation'){root.rotation.y=+e.target.value;render();}else if(e.target.name!=='name'){root.rotation.y=0;refresh();}};
 form.onsubmit=e=>{e.preventDefault();const look=values();system.setAppearance(bridge.player,look);try{localStorage.setItem(LOOK_KEY,JSON.stringify(look));}catch{dialog.querySelector('#cartoon-message').textContent='Não foi possível salvar neste navegador. A aparência vale nesta sessão.';return;}dialog.close();};
 dialog.querySelector('#cartoon-cancel').onclick=()=>dialog.close();dialog.onclose=()=>{window.cityCharacterEditorOpen=false;};
 if(!loadLook())open();
 system.openCreator=open;
}
