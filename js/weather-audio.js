// Rain and wind sound: WebAudio synthesized at runtime; no remote assets.
// Starts only after user input (browser autoplay policy), muffled under roofs.
(function(root){
 'use strict';
 let context=null,noise=null,gain=null,filter=null,frames=0,indoor=false;
 function begin(){
  if(context)return;
  const C=root.AudioContext||root.webkitAudioContext;if(!C)return;
  try{
   context=new C();const sr=context.sampleRate,buffer=context.createBuffer(1,sr*2,sr);
   const data=buffer.getChannelData(0);let prev=0;
   for(let i=0;i<data.length;i++){const raw=Math.random()*2-1;prev=(prev*.88+raw*.12);data[i]=raw*.55+prev*.45;}
   noise=context.createBufferSource();noise.buffer=buffer;noise.loop=true;
   filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1800;
   gain=context.createGain();gain.gain.value=0;
   noise.connect(filter);filter.connect(gain);gain.connect(context.destination);noise.start();
   context.resume().catch(()=>{});
  }catch(e){context=null;noise=null;gain=null;}
 }
 root.addEventListener?.('pointerdown',begin,{once:true});
 root.addEventListener?.('keydown',begin,{once:true});
 function tick(E,actor){
  if(!context||!gain||!E)return;
  // Spatial queries are amortized to avoid traversing all streamed homes at 60 FPS.
  if(actor&&!(frames++%30))indoor=!!root.CityShelter?.isSheltered(actor.x,actor.y,actor.floorZ||0);
  const rainfall=Math.min(1,Math.max(0,E.rain||0));
  const volume=rainfall*.19*(indoor?.22:1);
  gain.gain.setTargetAtTime(volume,context.currentTime,.3);
  filter.frequency.setTargetAtTime(indoor?550:2000,context.currentTime,.3);
 }
 root.CityWeatherAudio={tick,begin,get ready(){return !!context;}};
})(globalThis);
