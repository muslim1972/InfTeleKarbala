const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const width = 720, height = 1280, fps = 24, duration = 25;
const govDir = path.join(root, 'public', 'govs');
const appDir = path.join(__dirname, 'appmark-frames');
const framesDir = path.join(__dirname, 'moc-nomap-portrait-frames');
fs.mkdirSync(framesDir, { recursive: true });

const names = fs.readdirSync(govDir).filter(f => f.endsWith('.jpeg'));
const first = ['مقر الشركة.jpeg', 'كربلاء المقدسة.jpeg'];
const ordered = [...first, ...names.filter(f => !first.includes(f)).sort((a, b) => a.localeCompare(b, 'ar'))];
const flights = [0, 16, ...Array.from({ length: 14 }, (_, i) => i + 2), 1];
const govUrls = ordered.map(n => 'file:///' + path.join(govDir, n).replace(/\\/g, '/'));
const appUrls = fs.readdirSync(appDir).filter(f => f.endsWith('.png')).sort().map(f => 'file:///' + path.join(appDir, f).replace(/\\/g, '/'));
const fileUrl = p => 'file:///' + p.replace(/\\/g, '/');

const audioFile = path.join(__dirname, 'splash_audio_25s.aac');
const finalVideoOut = path.join(root, 'public', 'media', 'MOC_Nomap_Concept_portrait_25s.mp4');
const posterOut = path.join(root, 'public', 'media', 'MOC_Nomap_Concept_portrait_25s.jpg');

const html = `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><style>
@font-face{font-family:Cairo;src:url(${fileUrl(path.join(root, 'public', 'fonts', 'Cairo-Regular.ttf'))})}
*{box-sizing:border-box}html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;background:#031416}canvas{width:${width}px;height:${height}px}
</style><canvas id="c" width="${width}" height="${height}"></canvas><script>
const GU=${JSON.stringify(govUrls)},AP=${JSON.stringify(appUrls)},ORDER=${JSON.stringify(flights)};
const c=document.querySelector('canvas'),x=c.getContext('2d');
const gov=GU.map(src=>{let i=new Image();i.src=src;return i}),apps=AP.map(src=>{let i=new Image();i.src=src;return i});
const brand=new Image(),we=new Image(),itpcCorner=new Image();
brand.src='${fileUrl(path.join(__dirname, 'moc-emblem-with-text.png'))}';
we.src='${fileUrl(path.join(__dirname, 'we-cropped.png'))}';
itpcCorner.src='${fileUrl(path.join(root, 'public', 'itpc-watermark-gray.png'))}';
window.ready=false;
Promise.all([
  ...gov.map(i=>new Promise(r=>{i.onload=r;i.onerror=r})),
  ...apps.map(i=>new Promise(r=>{i.onload=r;i.onerror=r})),
  new Promise(r=>brand.onload=r),
  new Promise(r=>we.onload=r),
  new Promise(r=>itpcCorner.onload=r),
  document.fonts.load('24px Cairo')
]).then(()=>window.ready=true);

const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),ease=v=>{v=clamp(v);return v<.5?4*v*v*v:1-Math.pow(-2*v+2,3)/2},fade=(t,s,d=.45)=>ease((t-s)/d);
const txt=(s,x0,y0,size,color,alpha=1)=>{x.save();x.globalAlpha=alpha;x.font=size+'px Cairo';x.textAlign='center';x.textBaseline='middle';x.fillStyle=color;x.fillText(s,x0,y0);x.restore()};
const starts=Array.from({length:17},(_,i)=>i<4?1.05+i*.7:0);for(let i=4;i<17;i++)starts[i]=starts[i-4]+3.9;
function target(slot){if(slot===0)return{x:285,y:790};if(slot===1)return{x:435,y:790};let n=slot-2;return{x:160+(n%3)*200,y:887+Math.floor(n/3)*78}}

function draw(t){
  x.clearRect(0,0,720,1280);
  let bg=x.createRadialGradient(360,560,25,360,560,780);
  bg.addColorStop(0,'#0c3b38');bg.addColorStop(.58,'#052523');bg.addColorStop(1,'#020c12');
  x.fillStyle=bg;x.fillRect(0,0,720,1280);
  for(let i=0;i<70;i++){let xx=(i*127+t*5)%720,yy=(i*173+Math.sin(t*.4+i)*25)%1280;x.fillStyle='#63dfbb44';x.beginPath();x.arc(xx,yy,1+(i%2),0,7);x.fill()}

  // ── Corner Company Watermarks (Top Left & Top Right) ──
  let wmAlpha=fade(t,0.8,1.2);
  if(wmAlpha>0){
    x.save();x.globalAlpha=wmAlpha*0.88;
    let cw=90, ch=cw*itpcCorner.height/itpcCorner.width;
    x.drawImage(itpcCorner, 36, 36, cw, ch);
    x.drawImage(itpcCorner, 720 - cw - 36, 36, cw, ch);
    x.restore();
  }

  // Developer identity
  let mx=360,appAlpha=fade(t,8,.65),af=apps[Math.min(apps.length-1,Math.floor((t-8)*15))];
  if(t>=8){
    x.save();x.globalAlpha=appAlpha;x.shadowColor='#f0c86b';x.shadowBlur=10;let aw=250,ah=aw*af.height/af.width;x.drawImage(af,mx-aw/2,4,aw,ah);x.restore();
    txt('تطوير',mx,163,26,'#f4ca69',fade(t,8.65,.65));
    txt('مديرية اتصالات ومعلوماتية',mx,198,21,'#fff7ea',fade(t,9.3,.65));
    txt('كربلاء المقدسة',mx,229,18,'#dcebe6',fade(t,9.95,.65));
    txt('المهندس مسلم عقيل',mx,257,12,'#92ddc0',fade(t,10.6,.65));
  }

  // Orbit radar waves around central emblem (No Iraq map)
  let cx=360, cy=388;
  let waveAlpha=fade(t,0.3,1.5);
  if(waveAlpha>0){
    x.save();x.globalAlpha=waveAlpha*0.7;
    for(let k=0;k<6;k++){
      x.beginPath();
      x.ellipse(cx,cy,85+k*22,70+k*20,-0.12,0,Math.PI*2);
      x.strokeStyle='rgba(126,231,192,'+(0.12-k*0.015)+')';
      x.lineWidth=1.2;
      x.stroke();
    }
    x.restore();
  }

  // Ministry Emblem with MOC below
  let mark=fade(t,.5,1.5);
  x.save();x.globalAlpha=mark;
  let targetW=190, targetH=targetW*brand.height/brand.width;
  x.shadowColor='rgba(255,255,255,0.55)';
  x.shadowBlur=20;
  x.drawImage(brand, cx-targetW/2, cy-targetH/2, targetW, targetH);
  x.restore();

  // Institutional text below
  txt('وزارة الاتصالات',360,542,22,'#fff4e7',fade(t,1.5,.75));
  txt('الشركة العامة للاتصالات والمعلوماتية',360,572,17,'#e5f2ec',fade(t,2.3,.75));
  txt('نظام الادارة المحوكمة الشامل',360,600,16,'#f3d18a',fade(t,3.1,.75));
  let wp=fade(t,3.9,.9);x.save();x.globalAlpha=wp;x.shadowColor='#f0d18e';x.shadowBlur=10;x.drawImage(we,360-48,618,96,74);x.restore();

  let titleAlpha=fade(t,.25,1);txt('أفق العراق ... نطاقنا',360,715,21,'#91e5c7',titleAlpha);
  x.save();x.globalAlpha=titleAlpha;x.strokeStyle='#4abf9c';x.lineWidth=1.4;x.beginPath();x.moveTo(175,739);x.lineTo(545,739);x.stroke();x.restore();

  // Provinces orbiting around the Ministry Emblem
  for(let i=0;i<ORDER.length;i++){
    let gi=ORDER[i],st=starts[i],phase=clamp((t-st)/3.9);if(t<st)continue;
    let corner=i%4,start,entry;
    if(corner===0){start={x:-55,y:-55};entry=-3*Math.PI/4}
    else if(corner===1){start={x:775,y:-55};entry=-Math.PI/4}
    else if(corner===2){start={x:775,y:1335};entry=Math.PI/4}
    else{start={x:-55,y:1335};entry=3*Math.PI/4}
    let tx=target(gi===0?0:gi===1?1:gi===16?2:gi+1),ox=360,oy=388,rx=195,ry=180,ex=ox+rx*Math.cos(entry),ey=oy+ry*Math.sin(entry),px,py;
    if(phase<.22){let u=ease(phase/.22);px=start.x+(ex-start.x)*u;py=start.y+(ey-start.y)*u}
    else if(phase<.76){let u=(phase-.22)/.54,ang=entry+2*Math.PI*u;px=ox+rx*Math.cos(ang);py=oy+ry*Math.sin(ang)}
    else{let u=ease((phase-.76)/.24);px=ex+(tx.x-ex)*u;py=ey+(tx.y-ey)*u}
    let alpha=fade(t,st,.7),size=gi<2?78:74;
    x.save();x.globalAlpha=alpha;x.translate(px,py);x.rotate((1-phase)*Math.sin(i*1.3)*.25);x.shadowColor='#75f0c8';x.shadowBlur=13;x.fillStyle='#f8fffb';x.beginPath();x.arc(0,0,size/2,0,Math.PI*2);x.fill();x.shadowBlur=0;x.beginPath();x.arc(0,0,size/2-3,0,Math.PI*2);x.clip();x.drawImage(gov[gi],-size/2+3,-size/2+3,size-6,size-6);x.restore();
    if(phase<.76&&phase>.22){x.save();x.globalAlpha=.32*(1-(phase-.22)/.54);x.fillStyle='#d4ffef';x.beginPath();x.arc(px,py,2,0,Math.PI*2);x.fill();x.restore()}
  }
  let out=clamp((t-24)/1);if(out>0){x.fillStyle='rgba(0,0,0,'+out+')';x.fillRect(0,0,720,1280)}
}
window.draw=draw;
</script></html>`;

(async()=>{
  console.log('Starting portrait no-map render (600 frames)...');
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--allow-file-access-from-files']});
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
  const htmlPath=path.join(__dirname,'render-moc-nomap-portrait-temp.html');
  fs.writeFileSync(htmlPath,html);
  await page.goto('file:///'+htmlPath.replace(/\\/g,'/'),{waitUntil:'load'});
  await page.waitForFunction(()=>window.ready,{timeout:90000});

  const totalFrames = fps * duration;
  for(let f=0; f<totalFrames; f++){
    const t=f/fps;
    await page.evaluate(t=>window.draw(t),t);
    await page.screenshot({path:path.join(framesDir,'frame'+String(f).padStart(4,'0')+'.jpg'),type:'jpeg',quality:88});
    if(f % 120 === 0) console.log(`Rendered frame ${f}/${totalFrames} (${Math.round(f/totalFrames*100)}%)`);
  }

  // Generate poster at t=12s
  await page.evaluate(()=>window.draw(12));
  await page.screenshot({path:posterOut,type:'jpeg',quality:92});
  console.log('Saved portrait poster to:', posterOut);

  await browser.close();

  console.log('Encoding video with audio via ffmpeg...');
  execFileSync(process.env.FFMPEG||'ffmpeg',[
    '-y',
    '-framerate',String(fps),
    '-i',path.join(framesDir,'frame%04d.jpg'),
    '-i',audioFile,
    '-c:v','libx264',
    '-preset','slow',
    '-crf','22',
    '-pix_fmt','yuv420p',
    '-movflags','+faststart',
    '-c:a','aac',
    '-b:a','96k',
    '-shortest',
    finalVideoOut
  ],{stdio:'inherit'});

  console.log('Successfully completed portrait video creation:', finalVideoOut);
})().catch(e=>{console.error(e);process.exit(1)});
