// Serverless admin authentication for the current local-only City of God game.
// Does NOT make the local game state server-authoritative. Future multiplayer
// commands must be enforced on the authoritative game server separately.
'use strict';
const {createHash,createHmac,timingSafeEqual}=require('node:crypto');
const NAME='cog_admin',LIFETIME=60*60*3;
const hash=v=>createHash('sha256').update(v).digest('hex');
const constant=(a,b)=>{
 const x=Buffer.from(String(a)),y=Buffer.from(String(b));
 return x.length===y.length&&timingSafeEqual(x,y);
};
function sign(exp,secret){return createHmac('sha256',secret).update('admin-v1.'+exp).digest('hex');}
function verify(cookie,secret,now=Math.floor(Date.now()/1000)){
 if(!secret||!cookie)return false;
 const m=/^(\d{10})\.([0-9a-f]{64})$/.exec(cookie);
 if(!m||Number(m[1])<now||Number(m[1])>now+LIFETIME+30)return false;
 return constant(m[2],sign(m[1],secret));
}
const bodyJSON=(req)=>new Promise((resolve,reject)=>{
 if(req.body&&typeof req.body==='object')return resolve(req.body);
 let text='';req.on('data',chunk=>{text+=chunk;if(text.length>8192)reject(Error('too-large'));});
 req.on('end',()=>{try{resolve(JSON.parse(text||'{}'));}catch{reject(Error('invalid-json'));}});
 req.on('error',reject);
});
function handler(req,res){
 const secret=process.env.CITY_ADMIN_SESSION_SECRET||'';
 const passhash=process.env.CITY_ADMIN_PASSWORD_SHA256||'';
 const configured=secret.length>=32&&/^[0-9a-f]{64}$/.test(passhash);
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','private, no-store, max-age=0');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(!configured){res.statusCode=503;return res.end(JSON.stringify({ok:false,configured:false,error:'Painel administrativo ainda não configurado no servidor'}));}
 const cookies=Object.fromEntries((req.headers.cookie||'').split(';').map(s=>s.trim().split('=').slice(0,2)));
 const valid=verify(cookies[NAME],secret);
 if(req.method==='GET'){res.statusCode=valid?200:401;return res.end(JSON.stringify({ok:valid,configured:true}));}
 if(req.method!=='POST'&&req.method!=='DELETE'){res.setHeader('Allow','GET, POST, DELETE');res.statusCode=405;return res.end('{"ok":false}');}
 const origin=req.headers.origin,host=req.headers['x-forwarded-host']||req.headers.host||'';
 if(!origin||origin!=='https://'+host){res.statusCode=403;return res.end('{"ok":false,"error":"Origem não permitida"}');}
 if(req.method==='DELETE'){
  res.setHeader('Set-Cookie',NAME+'=; Path=/api/admin-auth; HttpOnly; Secure; SameSite=Strict; Max-Age=0');
  res.statusCode=200;return res.end('{"ok":true}');
 }
 return bodyJSON(req).then(body=>{
  const candidate=typeof body.password==='string'?body.password:'';
  const correct=candidate.length>=16&&candidate.length<=256&&constant(hash(candidate),passhash);
  if(!correct){res.statusCode=401;return res.end('{"ok":false,"error":"Credencial inválida"}');}
  const until=Math.floor(Date.now()/1000)+LIFETIME;
  res.setHeader('Set-Cookie',NAME+'='+until+'.'+sign(until,secret)+'; Path=/api/admin-auth; HttpOnly; Secure; SameSite=Strict; Max-Age='+LIFETIME);
  res.statusCode=200;return res.end('{"ok":true,"expiresIn":10800}');
 }).catch(()=>{res.statusCode=400;res.end('{"ok":false,"error":"Requisição inválida"}');});
}
module.exports=handler;
module.exports._test={verify,sign,constant,hash};
