const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const C=require('../js/city-media-core.js');
const media=fs.readFileSync('js/city-media.js','utf8');
const css=fs.readFileSync('css/city-media.css','utf8');
const house={x0:0,x1:12,y0:0,y1:12,contains(x,y,z){return z===0&&x>0&&x<12&&y>0&&y<12;}};
const roomAt=(h,f,x)=>({id:x<6?'living':'kitchen'});
test('every occupant of the same physical living room can view the same TV',()=>{
 const record={screen:C.screenId({id:'tv-7',x:2,y:2,floor:0},house,'house-2026'),room:C.roomAt(house,0,2,2,roomAt),video:'dQw4w9WgXcQ',playing:true,at:Date.now()-3250};
 const one={x:2,y:2,floor:0},two={x:4,y:4,floor:0};
 assert.ok(C.canHear(house,one,record.room,roomAt));
 assert.ok(C.canHear(house,two,record.room,roomAt));
 assert.equal(C.safeState(record).video,record.video);
 assert.equal(C.safeState(record).screen,record.screen);
});
test('watching is forbidden in a different room, outside the property or upstairs',()=>{
 const room=C.roomAt(house,0,2,2,roomAt);
 for(const p of [{x:8,y:4,floor:0},{x:2,y:4,floor:1},{x:14,y:4,floor:0}])
  assert.equal(C.canHear(house,p,room,roomAt),false);
 assert.match(media,/function canWatch\(/);
 assert.match(media,/C\.canHear\(sel\.house,p,sel\.room/);
 assert.match(media,/if\(!canWatch\(\{house:expanded\.house,room:expanded\.room\}\)/);
});
test('in-world and enlarged players are distinct and synchronized with the same video ID/time',()=>{
 assert.match(media,/new YT\.Player\(mount,\{width:960,height:540/);
 assert.match(media,/videoPlayer=new YT\.Player\(mount/);
 assert.match(media,/expanded\.player\.loadVideoById\(\{videoId:record\.video,startSeconds:position\}\)/);
 assert.match(media,/Math\.abs\(\(expanded\.player\.getCurrentTime/);
 assert.match(media,/syncTVVolume\(\)/);
 assert.match(media,/muteVideo\(!expanded\.open\)/);
 assert.match(media,/document\.getElementById\('cog-tv-expand'\)/);
 assert.match(media,/document\.getElementById\('cog-tv-viewer'\)/);
});
test('visitors may watch but only television controllers may change the stream',()=>{
 assert.match(media,/const canEdit=sel=>/);
 assert.match(media,/dialog\.querySelector\('\[data-cm="'\+name\+'"\]'\)\.disabled=!editing/);
 assert.match(media,/if\(!active\|\|!canEdit\(active\)\)return/);
 assert.match(media,/closeExpanded\(\);else syncExpanded/);
 assert.match(media,/if\(!face\)\{[\s\S]*?syncTVVolume\(\)/);
});
test('expanded viewer is optional, accessible and does not replace TV overlay',()=>{
 assert.match(media,/id="cog-tv-viewer" hidden role="dialog"/);
 assert.match(media,/id="cog-tv-large-mount"/);
 assert.match(media,/data-cm="viewer-close"/);
 assert.match(media,/data-cm="viewer-audio"/);
 assert.match(css,/#cog-tv-screen iframe/);
 assert.match(css,/#cog-tv-viewer/);
 assert.match(css,/#cog-tv-viewer\[hidden\]/);
 assert.match(css,/#cog-tv-large-mount iframe/);
});
