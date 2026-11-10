const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const css=fs.readFileSync('css/ui-theme.css','utf8');
const adventure=fs.readFileSync('css/city-adventures.css','utf8');

test('a tela J tem cores de fundo e textos apropriadas nos temas claro e escuro',()=>{
 assert.match(css,/html\[data-ui-theme=light\] #city-adventure-shade>\.cga-panel\{/);
 assert.match(css,/html\[data-ui-theme=dark\] #city-adventure-shade>\.cga-panel\{/);
 for(const sel of ['#city-adventure-shade h2','#city-adventure-shade header small',
  '#city-adventure-shade .cga-tabs button.on','#city-adventure-shade .cga-info :is(p,small)',
  '#city-adventure-shade .cga-row small','#city-adventure-shade .cga-row em',
  '#city-adventure-shade .cga-choice small','#city-adventure-shade .cga-row.done']){
  assert.ok(css.includes(sel),sel+' precisa respeitar o tema');
 }
 assert.match(css,/#city-adventure-shade \.cga-row\.done\{\s*opacity:1!important/);
 assert.match(adventure,/#city-adventure-shade \.cga-panel\{/);
});
test('cores de primeiro plano do tema são legíveis no painel J',()=>{
 const rgb=h=>h.replace('#','').match(/../g).map(x=>parseInt(x,16)/255);
 const lum=h=>rgb(h).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4)
  .reduce((t,v,i)=>t+v*[.2126,.7152,.0722][i],0);
 const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
 assert.ok(ratio('#1d2427','#faf9f6')>=7);
 assert.ok(ratio('#f6efe0','#12191d')>=7);
 assert.ok(ratio('#5c676a','#faf9f6')>=4.5);
 assert.ok(ratio('#b6c0bd','#12191d')>=4.5);
});

test('abas do menu J não têm scrollbar, emojis desalinhados nem perda de foco ao trocar de seção',()=>{
 const js=fs.readFileSync('js/city-adventures.js','utf8');
 assert.ok(js.includes('class="cga-tab-icon"'), 'ícones SVG padronizados');
 assert.ok(js.includes("['missions','Objetivos'],['events','Acontecimentos']"), 'rótulos sem emojis');
 assert.ok(js.includes('aria-pressed'), 'estado da aba acessível');
 assert.ok(js.includes('aria-label="Seções de Vida na Cidade"'), 'navegação identificável');
 assert.ok(js.includes("?.focus({preventScroll:true})"), 'foco preservado após atualização');
 assert.match(adventure,/#city-adventure-shade \.cga-tabs\{[^}]*flex-wrap:wrap;[^}]*overflow:visible/);
 assert.match(adventure,/#city-adventure-shade \.cga-tabs button\{[^}]*display:inline-flex;align-items:center/);
 assert.match(adventure,/#city-adventure-shade \.cga-tab-icon\{[^}]*width:17px;height:17px/);
 assert.match(css,/html\[data-ui-theme\] #city-adventure-shade \.cga-tabs\{[^}]*overflow:visible!important/);
});
