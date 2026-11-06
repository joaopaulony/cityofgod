// Servidor de inspeção: serve o repositório (como tools/serve.mjs) e aceita POST /__shot com uma imagem em data URL,
// gravada em $SHOT_DIR/shot-N.jpg (padrão: .shots/). Usado pelo tools/quaternius/viewer.html p/ capturar quadros
// mesmo com a aba em segundo plano.
import {createServer} from 'node:http';
import {readFile,stat,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep,join} from 'node:path';
const root=process.cwd(),port=Number(process.env.PORT||4323),out=process.env.SHOT_DIR||join(root,'.shots');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.css':'text/css'};
let n=0;
createServer(async(req,res)=>{
 try{
  if(req.method==='POST'&&req.url.startsWith('/__shot')){
   let body='';for await(const c of req)body+=c;
   const name=new URL(req.url,'http://x').searchParams.get('name')||'shot-'+(++n);
   await mkdir(out,{recursive:true});await writeFile(join(out,name.replace(/[^\w-]/g,'')+'.jpg'),Buffer.from(body.split(',')[1],'base64'));
   res.writeHead(200);res.end('ok');return;
  }
  const p=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!p.startsWith(root+sep)&&p!==root)throw Error('path');
  const file=(await stat(p)).isDirectory()?resolve(p,'index.html'):p;
  const body=await readFile(file);
  res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(body);
 }catch{if(!res.headersSent){res.writeHead(404);res.end('Not found');}else res.end();}
}).listen(port,'127.0.0.1',()=>console.log('inspeção: http://127.0.0.1:'+port));
