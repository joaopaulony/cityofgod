// Chão na GPU (js/ground-gpu.js): carregado depois do mundo aberto e antes do jogo; a tela 2D só fica transparente
// quando a GPU desenhou o chão (sem WebGL2, o fundo sólido e o minimapa de antes continuam).
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');

test('ground-gpu entra entre openworld.js e game.js e fica por baixo da tela 2D',()=>{
 const html=read('index.html'),a=html.indexOf('js/openworld.js'),b=html.indexOf('js/ground-gpu.js'),c=html.indexOf('js/game.js');
 assert.ok(a>0&&b>a&&c>b,'ordem dos scripts');
 assert.match(read('js/ground-gpu.js'),/insertBefore\(canvas, view\)/);
});

test('a tela 2D só limpa o fundo quando a GPU desenhou; o detalhe da CPU entra com fade',()=>{
 const game=read('js/game.js'),ter=read('js/terrain.js');
 assert.match(game,/terrain\.gpu = typeof GroundGPU !== 'undefined' && GroundGPU\.draw\(W, H\)/);
 assert.match(game,/if \(terrain\.gpu\) g\.clearRect\(0, 0, W, H\); else \{ g\.fillStyle = '#26301c'/);
 assert.match(ter,/if \(!terrain\.gpu\) \{ affine\(terrain\.miniPPM/);
 assert.match(ter,/const fade = terrain\.gpu \?/);
});

test('a GPU usa a mesma cor base da CPU (owBaseColor) e a base do setor também',()=>{
 const ow=read('js/openworld.js');
 assert.match(ow,/function owBaseColor\(x, y, pv = pondVal\(x, y\)\)/);
 assert.match(ow,/const c = owBaseColor\(x, y\);/);
 assert.match(read('js/ground-gpu.js'),/owBaseColor\(x, y, pv\)/);
});
