// view3d.js — WebGL nativo sem bibliotecas externas.
// Dois renderizadores compartilham o MESMO mundo, colisao, spawn, tempo e
// personagens. 3D e opcional; 2D continua disponivel mesmo sem WebGL.
'use strict';
const view3d=(()=>{
  const canvas=document.getElementById('world3d');
  const switcher=document.getElementById('mode-switch');
  const status=document.getElementById('mode-status');
  const modes=['2d','iso','third'];
  let mode='2d',gl=null,program=null,objects=[],roofs=[],houseWalls=[],
    actorMesh=null,particlesMesh=null,night=false,camState=null,
    lastWidth=0,lastHeight=0,vertexCount=0,staticCount=0;
  const PI=Math.PI,TAU=PI*2;
  const v3=(x,y,z)=>[x,y,z];
  const add=(a,b)=>a.map((n,i)=>n+b[i]);
  const sub=(a,b)=>a.map((n,i)=>n-b[i]);
  const mul=(a,s)=>a.map(n=>n*s);
  const len=a=>Math.hypot(...a)||1;
  const norm=a=>mul(a,1/len(a));
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const dot=(a,b)=>a.reduce((sum,n,i)=>sum+n*b[i],0);
  const to3=p=>[p[0],p[2],p[1]];
  const clamp01=x=>Math.max(0,Math.min(1,x));
  const color=(hex)=>{
    if(typeof hex!=='string'||!/^#[0-9a-f]{6}$/i.test(hex))return [.56,.57,.54];
    return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
  };
  const matMul=(a,b)=>{
    const out=new Float32Array(16);
    for(let j=0;j<4;j++)for(let i=0;i<4;i++)
      for(let k=0;k<4;k++)out[j*4+i]+=a[k*4+i]*b[j*4+k];
    return out;
  };
  const perspective=(fovy,aspect,near,far)=>{
    const f=1/Math.tan(fovy/2),m=new Float32Array(16);
    m[0]=f/aspect;m[5]=f;m[10]=(far+near)/(near-far);
    m[11]=-1;m[14]=2*far*near/(near-far);return m;
  };
  const orthographic=(hw,hh,near,far)=>{
    const m=new Float32Array(16);
    m[0]=1/hw;m[5]=1/hh;m[10]=-2/(far-near);m[12]=m[13]=0;
    m[14]=-(far+near)/(far-near);m[15]=1;return m;
  };
  const lookAt=(eye,target)=>{
    const z=norm(sub(eye,target)),x=norm(cross([0,1,0],z)),
      y=cross(z,x),m=new Float32Array(16);
    m.set([x[0],y[0],z[0],0,x[1],y[1],z[1],0,
      x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);
    // Columns of view matrix are basis components; above is row-major
    // rows serialized into column-major memory.
    return m;
  };
  class Mesh{
    constructor(){this.data=[];this.buffer=null;this.count=0;}
    triangle(a,b,c,col){
      const pa=to3(a),pb=to3(b),pc=to3(c),
        n=norm(cross(sub(pb,pa),sub(pc,pa))),rgb=Array.isArray(col)?col:color(col);
      for(const p of [pa,pb,pc])this.data.push(...p,...rgb,...n);
    }
    quad(a,b,c,d,col){
      this.triangle(a,b,c,col);this.triangle(a,c,d,col);
    }
    prism(cx,cy,z,w,d,h,col,top=col,side=col,angle=0){
      if(!(w>0&&d>0&&h>0))return;
      const co=Math.cos(angle),si=Math.sin(angle);
      const q=(x,y,zz)=>[cx+co*x-si*y,cy+si*x+co*y,zz];
      const hw=w/2,hd=d/2;
      const a=q(-hw,-hd,z),b=q(hw,-hd,z),c=q(hw,hd,z),d0=q(-hw,hd,z);
      const e=q(-hw,-hd,z+h),f=q(hw,-hd,z+h),g=q(hw,hd,z+h),h0=q(-hw,hd,z+h);
      this.quad(a,b,f,e,side);this.quad(b,c,g,f,col);
      this.quad(c,d0,h0,g,col);this.quad(d0,a,e,h0,side);
      this.quad(e,f,g,h0,top);
    }
    cylinder(x,y,z,r,h,cols=7,col='#685643'){
      for(let k=0;k<cols;k++){
        const a=k*TAU/cols,b=(k+1)*TAU/cols;
        const p=[x+Math.cos(a)*r,y+Math.sin(a)*r],
          q=[x+Math.cos(b)*r,y+Math.sin(b)*r];
        this.quad([p[0],p[1],z],[q[0],q[1],z],
          [q[0],q[1],z+h],[p[0],p[1],z+h],col);
      }
    }
    cone(x,y,z,r,h,col='#47734a',n=8){
      for(let k=0;k<n;k++){
        const a=k*TAU/n,b=(k+1)*TAU/n,
          p=[x+Math.cos(a)*r,y+Math.sin(a)*r,z],
          q=[x+Math.cos(b)*r,y+Math.sin(b)*r,z];
        this.triangle(p,q,[x,y,z+h],col);
        this.triangle([x,y,z],q,p,col);
      }
    }
    sphere(x,y,z,r,col='#66854b',rings=3,n=7){
      for(let j=0;j<rings;j++){
        const a=-PI/2+j*PI/rings,b=-PI/2+(j+1)*PI/rings;
        for(let k=0;k<n;k++){
          const u=k*TAU/n,v=(k+1)*TAU/n,
            p=(lat,ang)=>[x+Math.cos(ang)*Math.cos(lat)*r,
              y+Math.sin(ang)*Math.cos(lat)*r,z+Math.sin(lat)*r];
          this.quad(p(a,u),p(a,v),p(b,v),p(b,u),col);
        }
      }
    }
    upload(){
      if(!gl)return;const a=new Float32Array(this.data);
      if(this.buffer)gl.deleteBuffer(this.buffer);
      this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
      gl.bufferData(gl.ARRAY_BUFFER,a,gl.STATIC_DRAW);
      this.count=a.length/9;this.data=[];vertexCount+=this.count;
    }
  }
  const emit=m=>{m.upload();objects.push(m);};
  function ground(){
    const m=new Mesh();
    // Malha dividida em celulas de 2m para preservar textura procedimental.
    for(let y=0;y<MAP;y+=2)for(let x=0;x<MAP;x+=2){
      const cx=x+1,cy=y+1,f=forest(cx,cy),shade=fbm(cx*.13,cy*.13);
      let c=f>.66?'#4f6745':f>.53?'#688252':f>.42?'#7f8b57':'#8b9565';
      if(shade<.37)c=f>.5?'#577149':'#747e51';
      if(pondVal(cx,cy)<1.03)c='#3b646c';
      m.quad([x,y,-.035],[x+2,y,-.035],
        [x+2,y+2,-.035],[x,y+2,-.035],c);
    }
    // Estradas acompanham as curvas originais ponto a ponto (sem tile distinto).
    for(const road of world.roads){
      const pts=road.pts;for(let i=1;i<pts.length;i++){
        const p=pts[i-1],q=pts[i];
        const off=(v,r)=>[v.x+v.nx*r,v.y+v.ny*r];
        const sides=[ROAD_W+SIDE,ROAD_W+.25,ROAD_W];
        const h=[-.006,.001,.012],cols=['#9e9d94','#797a77','#3b4146'];
        for(let j=0;j<sides.length;j++){
          const r=sides[j],z=h[j],col=cols[j];
          const a=off(p,r),b=off(q,r),c=off(q,-r),d=off(p,-r);
          m.quad([...a,z],[...b,z],[...c,z],[...d,z],col);
        }
        if(i%6===0){
          const a=off(p,.045),b=off(q,.045),
            c=off(q,-.045),d=off(p,-.045);
          m.quad([...a,.024],[...b,.024],[...c,.024],[...d,.024],
            i%3===0?'#b9b6a1':'#777a76');
        }
      }
    }
    // Trilhas de terra leves nas zonas de campo.
    for(const trail of world.trails||[]){
      for(let i=1;i<trail.length;i++){
        const a=trail[i-1],b=trail[i],dx=b[0]-a[0],dy=b[1]-a[1],
          l=Math.hypot(dx,dy)||1,nx=-dy/l*.31,ny=dx/l*.31;
        m.quad([a[0]+nx,a[1]+ny,.014],[b[0]+nx,b[1]+ny,.014],
          [b[0]-nx,b[1]-ny,.014],[a[0]-nx,a[1]-ny,.014],'#937e59');
      }
    }
    emit(m);
  }
  function houses3d(){
    const interior=new Mesh(),exterior=new Mesh(),roofArray=[];
    const details=new Mesh(),doors=new Mesh();
    for(const H of houses){
      const ex=new Mesh(),inside=new Mesh(),roof=new Mesh();
      const body=(s,m)=>{
        const x=(s.x1+s.x2)/2,y=(s.y1+s.y2)/2,
          dx=s.x2-s.x1,dy=s.y2-s.y1,
          len=Math.hypot(dx,dy)||1,angle=Math.atan2(dy,dx),
          h=s.ext?H.h:(H.storeys?H.floorHeight:H.h),
          base=s.floor?H.floorHeight:0;
        const wallColor=s.ext?(H.rural?'#a89374':H.brick?'#98645b':
          (H.style?.plaster||'#c7bda8')):'#bbb2a6';
        // Aberturas reais: vidro e soleira ao inves de parede inteira.
        if(s.door){
          m.prism(x,y,base+2.06,len,.18,Math.max(.12,h-2.06),
            wallColor,wallColor,'#a7a196',angle);
          if(s.ext)m.prism(x,y,base+.03,len,.3,.11,'#9e9b90');
        }else if(s.window&&s.ext){
          m.prism(x,y,base,len,.2,1.00,wallColor,wallColor,wallColor,angle);
          m.prism(x,y,base+2.03,len,.2,Math.max(.10,h-2.03),
            wallColor,wallColor,wallColor,angle);
          m.prism(x,y,base+1.02,len,.035,.075,'#c7c1ae',null,null,angle);
          const glass=new Mesh();
          glass.prism(x,y,base+1.04,len*.78,.044,.93,
            '#729ca7','#a8c2c4','#6a8c98',angle);
          // Vidro fosco e renderizado na malha da casa para simplificar a
          // versao WebGL 1 e evitar problemas de alpha sorting.
          for(const value of glass.data)m.data.push(value);
          m.prism(x,y,base+1.49,len*.07,.07,1.07,'#e1d7c4',null,null,angle);
        }else{
          m.prism(x,y,base,len,.18,h,wallColor,wallColor,wallColor,angle);
        }
      };
      for(const s of H.segs)body(s,s.ext?ex:inside);
      if(H.upper)for(const s of H.upper.walls)body(s,inside);
      const ge=H.roofGeom||(H.roofGeom=buildRoofGeom(H));
      if(ge.flat){
        roof.prism((H.x0+H.x1)/2,(H.y0+H.y1)/2,
          H.h-.1,H.x1-H.x0+.55,H.y1-H.y0+.55,.22,'#89847b');
      }else for(const face of ge.faces){
        const pts=face.p;
        const col=face.gable?'#b6a695':H.style?.roofCol||'#77604c';
        for(let i=1;i+1<pts.length;i++)roof.triangle(pts[0],pts[i],pts[i+1],col);
      }
      if(H.chimney){
        const c=H.chimney;
        roof.prism(c.x,c.y,c.z,.66,.66,c.h,
          c.stone?'#96847a':'#9e6257',
          '#5c5751','#7e4c42');
      }
      // Piso do segundo andar; so aparece quando o teto estiver oculto.
      if(H.upper)inside.prism((H.x0+H.x1)/2,(H.y0+H.y1)/2,
        H.floorHeight-.08,H.x1-H.x0-.28,H.y1-H.y0-.28,.12,
        '#ad977b','#c3aa8a','#84765e');
      ex.upload();inside.upload();roof.upload();
      houseWalls.push({H,ex,inside,roof});
    }
    // Moveis do mesmo mundo, incluindo cozinhas, camas e carros.
    for(const b of boxes){
      if(b.kind==='rug'||b.kind==='mirror')continue;
      const floor=b.floor===1?0:0; // b.z ja armazena elevacao global.
      const z=b.z||0;
      if(b.kind==='car'){
        details.prism(b.x,b.y,z,b.w,b.d,b.h,b.side||'#718392',
          b.top||'#718392','#333a40',b.rot||0);
      }else if((b.w||0)>.06&&(b.d||0)>.06&&(b.h||0)>.04){
        details.prism(b.x,b.y,z,b.w,b.d,b.h,
          b.side||'#a1937e',b.top||'#c0b39d',b.side||'#847764',b.rot||0);
      }
    }
    emit(details);
    // Portas e janelas mudam durante o jogo: malha dinamica.
    actorMesh=new Mesh();
    particlesMesh=new Mesh();
  }
  function props3d(){
    const props=new Mesh(),small=new Mesh();
    for(const p of world.props){
      if(p.type==='tree'){
        const pine=p.sp?.kind==='pine',scale=p.sp?.r||1.05,
          h=pine?4.8:4.1,seed=((p.x*137+p.y*91)|0)%4;
        props.cylinder(p.x,p.y,0,.18+scale*.08,h*.70,7,'#705746');
        if(pine){
          for(let j=0;j<3;j++)props.cone(p.x,p.y,h*.35+j*.78,
            1.28+scale*.27-j*.19,2.25-j*.18,
            ['#4d6850','#527355','#5b7957'][j],8);
        }else{
          const col=['#56794b','#678a54','#527a4c','#6b8551'][Math.abs(seed)];
          props.sphere(p.x,p.y,h*.85,1.28+scale*.40,col,3,7);
          props.sphere(p.x-.72,p.y,h*.68,.89+scale*.21,'#719058',3,7);
          props.sphere(p.x+.61,p.y+.30,h*.78,.76+scale*.22,'#52764c',3,7);
        }
      }else if(p.type==='bush'){
        props.sphere(p.x,p.y,.40,.45,'#617f4e',2,6);
      }else if(p.type==='rock'){
        props.sphere(p.x,p.y,.15,.38,'#89867d',2,6);
      }
    }
    for(const f of fences){
      const dx=f.x2-f.x1,dy=f.y2-f.y1,
        a=Math.atan2(dy,dx),x=(f.x1+f.x2)/2,y=(f.y1+f.y2)/2,
        d=Math.hypot(dx,dy),h=f.h||1.10;
      for(const z of [.34,.82])props.prism(x,y,z,d,.075,.095,
        '#98734f','#b69265','#71553c',a);
      props.prism(f.x1,f.y1,-.08,.13,.13,h+.08,
        '#9b7951','#c2a178','#705237');
    }
    for(const l of world.lamps){
      props.cylinder(l.x,l.y,0,.075,3.95,6,'#596568');
      props.prism(l.x+l.ax*.55,l.y+l.ay*.55,3.85,1.20,.11,.11,
        '#879292','#abb6b2','#6b787a',Math.atan2(l.ay,l.ax));
      props.prism(l.x+l.ax*1.10,l.y+l.ay*1.10,3.72,.33,.23,.12,
        '#dbc79c','#ffe6aa','#f2d99b');
    }
    for(const b of urbanLife.bins||[])props.prism(b.x,b.y,0,.48,.48,.85,
      b.kind==='metal'?'#617478':'#46715a',
      '#374447','#465a54');
    for(const d of urbanLife.litter||[])small.prism(d.x,d.y,.015,.15,.08,.015,
      d.kind==='can'?'#a2aaa8':d.kind==='bottle'?'#62847e':'#c7bca9');
    emit(props);emit(small);
  }
  function programShader(){
    const vs=`attribute vec3 aPos;attribute vec3 aColor;attribute vec3 aNormal;
uniform mat4 uMvp;uniform vec3 uEye;varying vec3 vColor;varying vec3 vNormal;
varying float vDist;
void main(){
  gl_Position=uMvp*vec4(aPos,1.0);
  vColor=aColor;vNormal=aNormal;vDist=distance(aPos,uEye);
}`;
    const fs=`precision mediump float;
varying vec3 vColor;varying vec3 vNormal;varying float vDist;
uniform float uNight;uniform vec3 uFog;
void main(){
  vec3 sun=normalize(vec3(-0.42,0.94,-0.38));
  float shade=max(0.0,dot(normalize(vNormal),sun));
  float light=mix(0.66+shade*0.36,0.22+shade*.15,uNight);
  vec3 finalColor=vColor*light;
  float fog=smoothstep(43.0,140.0,vDist);
  gl_FragColor=vec4(mix(finalColor,uFog,fog),1.0);
}`;
    const compile=(type,src)=>{
      const sh=gl.createShader(type);gl.shaderSource(sh,src);gl.compileShader(sh);
      if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))
        throw Error(gl.getShaderInfoLog(sh));return sh;
    };
    program=gl.createProgram();
    gl.attachShader(program,compile(gl.VERTEX_SHADER,vs));
    gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fs));
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))
      throw Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const pos=gl.getAttribLocation(program,'aPos'),
      col=gl.getAttribLocation(program,'aColor'),
      normal=gl.getAttribLocation(program,'aNormal');
    for(const [loc,off] of [[pos,0],[col,12],[normal,24]]){
      gl.enableVertexAttribArray(loc);
    }
    return {pos,col,normal,
      mvp:gl.getUniformLocation(program,'uMvp'),
      eye:gl.getUniformLocation(program,'uEye'),
      night:gl.getUniformLocation(program,'uNight'),
      fog:gl.getUniformLocation(program,'uFog')};
  }
  let attribs=null;
  function initialize(){
    if(gl)return true;
    gl=canvas.getContext('webgl',{antialias:true,alpha:false,depth:true,
      powerPreference:'high-performance'})||
      canvas.getContext('experimental-webgl',{antialias:true});
    if(!gl){status.textContent='WebGL indisponivel neste navegador';return false;}
    canvas.addEventListener('webglcontextlost',e=>{
      e.preventDefault();mode='2d';canvas.style.display='none';
      document.getElementById('view').style.opacity='1';gl=null;
      status.textContent='WebGL desconectado · 2D restaurado';
    });
    try{
      attribs=programShader();
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
      gl.disable(gl.CULL_FACE);
      ground();houses3d();props3d();
      staticCount=objects.reduce((sum,m)=>sum+m.count,0);
      status.textContent='Cena 3D pronta · '+Math.round(vertexCount/1000)+' mil vertices';
      return true;
    }catch(err){
      console.error('City of God 3D:',err);
      status.textContent='Falha WebGL: '+String(err.message).slice(0,58);
      gl=null;return false;
    }
  }
  function character(m,a){
    const moving=(a.speed||0)>.18,cycle=Math.sin((a.phase||0)*TAU)*.25,
      z=a.floorZ||0,x=a.x,y=a.y;
    const k=a===window.__game?.player?'#c29c78':'#9c8f81',
      coat=a===window.__game?.player?'#3d6172':'#835b55',
      hair=a===window.__game?.player?'#2f2923':'#47382f',
      angle=a.face||0,c=Math.cos(angle),s=Math.sin(angle),
      pos=(u,v)=>[x+u*c-v*s,y+u*s+v*c];
    const box=(u,v,zz,w,d,h,col,top=col)=>{
      const p=pos(u,v);m.prism(p[0],p[1],z+zz,w,d,h,col,top,col,angle);
    };
    box(0,0,.94,.56,.38,.77,coat,'#567387');
    box(0,0,1.70,.26,.30,.23,k);
    m.sphere(x,y,z+2.03,.27,k,3,8);
    box(-.05,-.035,2.23,.47,.35,.10,hair);
    box(.02,.26,1.30,.20,.45,.26,'#504b44');
    for(const side of [-1,1]){
      const step=moving?cycle*side:0;
      box(side*.17+step*.20,0,.06,.22,.26,.83,'#444449');
      box(side*.40,0,1.02,.19,.22,.56,coat);
      box(side*.17+step*.20,.17,.06,.25,.40,.13,'#302d2b');
    }
    if(a.armed!==false){
      box(.18,.26,1.29,.11,.70,.12,'#373d40','#646466');
    }
  }
  function dynamics(actors,player,nightValue,time){
    const m=new Mesh();
    for(const a of actors)character(m,a);
    // Portas acompanham a mesma animacao de abertura 2D.
    for(const H of houses)for(const s of H.segs){
      if(!s.door)continue;
      const openness=s.doorAnim?.open||0;
      if(openness>=.97)continue;
      const x=(s.x1+s.x2)/2,y=(s.y1+s.y2)/2,
        angle=Math.atan2(s.y2-s.y1,s.x2-s.x1)+openness*1.30,
        base=s.floor===1?H.floorHeight:0;
      m.prism(x,y,base,.86,.055,1.93,
        s.ext?'#866c50':'#a38460','#c8aa86','#75573d',angle);
    }
    for(const H of houses)if(H.upper)for(const s of H.upper.walls)if(s.door){
      const open=s.doorAnim?.open||0;if(open>=.97)continue;
      m.prism((s.x1+s.x2)/2,(s.y1+s.y2)/2,
        H.floorHeight,.85,.055,1.95,'#ad8d68','#bc9972','#8b6545',
        Math.atan2(s.y2-s.y1,s.x2-s.x1)+open*1.3);
    }
    // Fumaca sobe realmente em 3D; corpo opaco translúcido estilizado.
    for(const H of houses)if(H.chimney?.smoke){
      const c=H.chimney;
      for(let i=0;i<3;i++){
        const f=(time*.10+i/3+(c.seed%13)*.031)%1;
        m.sphere(c.x+f*.48,c.y+f*.24,c.z+c.h+f*2.5,
          .12+f*.15,'#9a9e9a',2,6);
      }
    }
    m.upload();if(actorMesh?.buffer)gl.deleteBuffer(actorMesh.buffer);
    actorMesh=m;
  }
  function cameraFor(mode,player){
    const angle=cam.ang,dx=Math.sin(angle),dy=Math.cos(angle);
    const focus=[player.x,1.35+(player.floorZ||0),player.y],
      dist=mode==='third'?7.9:Math.max(20,36*(34/cam.zoom)),
      eye=mode==='third'?[player.x+dx*dist,3.85+(player.floorZ||0),
        player.y+dy*dist]:[player.x+dx*dist,dist*.92+(player.floorZ||0),
          player.y+dy*dist],
      target=mode==='third'?[player.x,1.34+(player.floorZ||0),player.y]:
        [player.x,.7+(player.floorZ||0),player.y];
    const w=Math.max(1,canvas.width),h=Math.max(1,canvas.height),aspect=w/h;
    const projection=mode==='iso'
      ?orthographic(Math.max(9,17*34/cam.zoom)*aspect,
        Math.max(9,17*34/cam.zoom),.1,350)
      :perspective(PI/3,aspect,.075,240);
    const forward=norm(sub(target,eye)),right=norm(cross(forward,[0,1,0])),
      up=norm(cross(right,forward));
    const result={eye,target,forward,right,up,projection,
      vp:matMul(projection,lookAt(eye,target)),aspect};
    return result;
  }
  function pickGround(mx,my,z=1.4){
    if(!camState)return null;
    const x=mx/window.innerWidth*2-1,y=1-my/window.innerHeight*2,
      s=camState,plane=z;
    let origin=s.eye,dir=s.forward;
    if(mode==='iso'){
      const hh=Math.max(9,17*34/cam.zoom);
      origin=add(add(origin,mul(s.right,x*hh*s.aspect)),mul(s.up,y*hh));
    }else{
      const t=Math.tan(PI/6);
      dir=norm(add(add(dir,mul(s.right,x*t*s.aspect)),mul(s.up,y*t)));
    }
    if(Math.abs(dir[1])<.0001)return [player.x,player.y];
    const t=(plane-origin[1])/dir[1];
    if(t<0)return [player.x,player.y];
    const v=add(origin,mul(dir,t));
    return [Math.max(0,Math.min(MAP,v[0])),Math.max(0,Math.min(MAP,v[2]))];
  }
  function draw(m){
    if(!m?.buffer||!m.count)return;
    gl.bindBuffer(gl.ARRAY_BUFFER,m.buffer);
    gl.vertexAttribPointer(attribs.pos,3,gl.FLOAT,false,36,0);
    gl.vertexAttribPointer(attribs.col,3,gl.FLOAT,false,36,12);
    gl.vertexAttribPointer(attribs.normal,3,gl.FLOAT,false,36,24);
    gl.drawArrays(gl.TRIANGLES,0,m.count);
  }
  function render(player,actors,state,time){
    if(mode==='2d'||!gl)return false;
    const w=Math.max(1,Math.floor(innerWidth/Math.max(1,RS))),
      h=Math.max(1,Math.floor(innerHeight/Math.max(1,RS)));
    if(w!==lastWidth||h!==lastHeight){
      lastWidth=w;lastHeight=h;canvas.width=w;canvas.height=h;
      gl.viewport(0,0,w,h);
    }
    camState=cameraFor(mode,player);
    night=!!state.night;
    gl.clearColor(night?.045:.62,night?.075:.73,night?.13:.78,1);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);
    gl.uniformMatrix4fv(attribs.mvp,false,camState.vp);
    gl.uniform3fv(attribs.eye,new Float32Array(camState.eye));
    gl.uniform1f(attribs.night,night?1:0);
    gl.uniform3fv(attribs.fog,new Float32Array(night?
      [.045,.075,.13]:[.62,.73,.78]));
    for(const m of objects)draw(m);
    // A casa do jogador nao o oculta: teto e fachada removidos localmente.
    for(const x of houseWalls){
      const H=x.H,inside=player.x>H.x0&&player.x<H.x1&&
        player.y>H.y0&&player.y<H.y1;
      if(!inside)draw(x.ex);
      draw(x.inside);
      if(!inside)draw(x.roof);
    }
    dynamics(actors,player,night,time);
    draw(actorMesh);
    return true;
  }
  function setMode(next){
    if(!modes.includes(next))next='2d';
    if(next!=='2d'&&!initialize())next='2d';
    mode=next;const active=next!=='2d';
    canvas.style.display=active?'block':'none';
    document.getElementById('view').style.opacity=active?'0':'1';
    switcher.textContent=active
      ?next==='iso'?'VISÃO: 3D ISO':'VISÃO: 3D LIVRE':'VISÃO: 2D';
    switcher.setAttribute('aria-label','Alternar visualização entre 2D, 3D isométrico e 3D terceira pessoa');
    if(!active)status.textContent='2D clássico';
    else status.textContent=next==='iso'
      ?'3D isométrico · Q/E girar · roda aproxima':
      '3D terceira pessoa · Q/E girar · WASD mover';
    return mode;
  }
  function cycle(){return setMode(modes[(modes.indexOf(mode)+1)%modes.length]);}
  switcher.addEventListener('click',cycle);
  addEventListener('keydown',e=>{
    if(e.repeat||e.key.toLowerCase()!=='v'||document.activeElement?.id==='say')return;
    cycle();
  });
  return {render,setMode,cycle,pickGround,get mode(){return mode;},
    get ready(){return !!gl;},get vertexCount(){return vertexCount;},
    get staticCount(){return staticCount;},get buildings(){return houseWalls.length;},
    get actorCount(){return actorMesh?.count||0;}};
})();
