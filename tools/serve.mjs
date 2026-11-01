import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=process.cwd(),port=Number(process.env.PORT||4322);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.css':'text/css'};
createServer(async(req,res)=>{
 try{
  const p=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!p.startsWith(root+sep)&&p!==root)throw Error('path');
  const file=(await stat(p)).isDirectory()?resolve(p,'index.html'):p;
  // Read first: a missing directory index must never kill the dev server
  // by trying to emit a 404 after already writing a 200 response.
  const body=await readFile(file);
  res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});
  res.end(body);
 }catch{
  if(!res.headersSent){res.writeHead(404);res.end('Not found');}
  else res.end();
 }
}).listen(port,'127.0.0.1',()=>console.log(`City of God: http://127.0.0.1:${port}`));
