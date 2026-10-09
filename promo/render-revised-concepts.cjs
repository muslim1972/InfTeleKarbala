const { chromium } = require('playwright');
const fs=require('fs'),path=require('path');
const {execFileSync}=require('child_process');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'rendered-concepts-v2');fs.mkdirSync(out,{recursive:true});
const govDir=path.join(root,'public','govs');
const files=fs.readdirSync(govDir).filter(f=>f.endsWith('.jpeg'));
const center=['مقر الشركة.jpeg','كربلاء المقدسة.jpeg'];
const ordered=[...center,...files.filter(f=>!center.includes(f)).sort((a,b)=>a.localeCompare(b,'ar'))];
const govs=ordered.map(name=>({name:name.replace('.jpeg',''),src:'file:///'+path.join(govDir,name).replace(/\\/g,'/')}));
const appDir=path.join(__dirname,'appmark-frames');
const app=fs.readdirSync(appDir).filter(f=>f.endsWith('.png')).sort().map(f=>'file:///'+path.join(appDir,f).replace(/\\/g,'/'));
const imgPath=p=>'file:///'+p.replace(/\\/g,'/');
const html=`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><style>
@font-face{font-family:Cairo;src:url(${imgPath(path.join(root,'public','fonts','Cairo-Regular.ttf'))})}
@font-face{font-family:Amiri;src:url(${imgPath(path.join(root,'public','fonts','Amiri-Regular.ttf'))})}
*{box-sizing:border-box}html,body{margin:0;width:1280px;height:720px;overflow:hidden;background:#050a15}canvas{width:1280px;height:720px}
</style><canvas id="c" width="1280" height="720"></canvas><script>
const GOV=${JSON.stringify(govs)}, APP=${JSON.stringify(app)};let c=document.querySelector('#c'),x=c.getContext('2d'),logos=GOV.map(d=>{let i=new Image();i.src=d.src;return i}),appFrames=APP.map(s=>{let i=new Image();i.src=s;return i}),brand=new Image(),brandDark=new Image();brand.src='${imgPath(path.join(__dirname,'itpc-white-transparent.png'))}';brandDark.src='${imgPath(path.join(root,'public','logo-new.png'))}';
window.ready=false;Promise.all([...logos.map(i=>new Promise((r,j)=>{i.onload=r;i.onerror=r})),...appFrames.map(i=>new Promise(r=>{i.onload=r;i.onerror=r})),new Promise(r=>brand.onload=r),new Promise(r=>brandDark.onload=r),document.fonts.load('22px Cairo'),document.fonts.load('22px Amiri')]).then(()=>window.ready=true);
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),smo=v=>{v=clamp(v);return v*v*(3-2*v)},quart=v=>{v=clamp(v);return 1-Math.pow(1-v,4)},rr=(a,b,w,h,r)=>{x.beginPath();x.roundRect(a,b,w,h,r)},txt=(s,xx,yy,size,color,font='Cairo',align='center',alpha=1)=>{x.save();x.globalAlpha=alpha;x.font=size+'px '+font;x.textAlign=align;x.textBaseline='middle';x.fillStyle=color;x.fillText(s,xx,yy);x.restore()};
function targets(i){if(i===0)return {x:145,y:190};if(i===1)return {x:275,y:190};let n=i-2,row=Math.floor(n/3),col=n%3;return {x:86+col*126,y:285+row*91}}
function draw(t,style){x.clearRect(0,0,1280,720);let dark=style!==1;let ink=style===0?'#061526':style===1?'#e8dfcd':'#031a1d',accent=style===0?'#45e6d2':style===1?'#b36e36':'#6ed9af',gold=style===1?'#a96f35':'#f0cc73';
// three visual systems
if(style===0){let bg=x.createRadialGradient(650,320,20,630,330,850);bg.addColorStop(0,'#163752');bg.addColorStop(.55,'#0b1b30');bg.addColorStop(1,'#030914');x.fillStyle=bg;x.fillRect(0,0,1280,720);for(let i=0;i<55;i++){let px=(i*213+t*8)%1280,py=(i*103+Math.sin(t*.35+i)*34)%720;x.fillStyle='#8ae9e088';x.beginPath();x.arc(px,py,1+(i%3),0,7);x.fill()} // cinematic lens arcs
x.save();x.translate(650,322);x.rotate(-.17+t*.018);for(let i=0;i<5;i++){x.strokeStyle='#55d8d055';x.lineWidth=1;x.beginPath();x.ellipse(0,0,205+i*31,96+i*19,.08,0,Math.PI*2);x.stroke()}x.restore();
}else if(style===1){x.fillStyle=ink;x.fillRect(0,0,1280,720);x.fillStyle='#e5d8c4';x.fillRect(0,0,411,720); // editorial warm paper
x.fillStyle='#dac8ae';x.fillRect(30,0,1,720);x.fillRect(380,0,1,720);for(let yy=42;yy<720;yy+=22){x.fillStyle='#a98c6a18';x.fillRect(0,yy,411,1)}
// dramatic typographic ghost
x.save();x.globalAlpha=.12;x.fillStyle='#d9c3a5';x.font='210px Amiri';x.textAlign='center';x.fillText('اتصال',785,190);x.restore();x.strokeStyle='#bd8150';x.lineWidth=1;x.beginPath();x.moveTo(470,94);x.lineTo(895,94);x.stroke();
}else{ // map-as-circuit / emerald
x.fillStyle='#031718';x.fillRect(0,0,1280,720);let g=x.createRadialGradient(700,360,40,700,360,690);g.addColorStop(0,'#0d423e');g.addColorStop(1,'#031718');x.fillStyle=g;x.fillRect(0,0,1280,720);
// abstract Iraq silhouette as topographic strokes
let pts=[[475,115],[590,105],[650,135],[743,132],[799,183],[850,205],[821,265],[866,313],[812,367],[833,430],[780,482],[754,551],[690,570],[645,532],[570,542],[525,488],[495,411],[452,367],[468,305],[429,243],[460,190]];x.save();x.beginPath();pts.forEach((p,i)=>i?x.lineTo(...p):x.moveTo(...p));x.closePath();x.fillStyle='#16524b55';x.fill();x.strokeStyle='#7dd8b466';x.lineWidth=2;x.stroke();x.clip();for(let k=0;k<18;k++){x.strokeStyle='#6bd0a51c';x.lineWidth=1;x.beginPath();x.ellipse(650,350,135+k*13,55+k*8,-.3,0,Math.PI*2);x.stroke()}x.restore();for(let i=0;i<40;i++){let px=(i*97+310)%630+400,py=(i*157+30)%630;x.fillStyle='#80e0b755';x.fillRect(px,py,2,2)}
}
// header and title hierarchy on left, never boxed
let titleAlpha=quart((t-.45)/.75);if(style===1){txt('أفق العراق ... نطاقنا',205,77,27,'#4d3929','Amiri','center',titleAlpha);x.strokeStyle='#9e6d44';x.beginPath();x.moveTo(78,107);x.lineTo(332,107);x.stroke()}else {txt('أفق العراق ... نطاقنا',205,74,26,accent,'Cairo','center',titleAlpha);x.fillStyle=accent;x.fillRect(137,98,136,1)}
// hero company mark transparent and present from first second
let hero=style===1?brandDark:brand;let lp=quart((t-.48)/1.35),w=365*(.72+.28*lp),h=w*hero.height/hero.width,cy=327;
x.save();x.globalAlpha=lp;x.shadowColor=style===1?'#d7934e':'#42e4d1';x.shadowBlur=style===2?10:26;x.drawImage(hero,650-w/2,cy-h/2,w,h);x.restore();
// text appears in clean staggered rhythm
let c1=quart((t-1.05)/.7),c2=quart((t-1.8)/.8),c3=quart((t-2.55)/.85),cx=650;
txt('وزارة الاتصالات',cx,507,29,style===1?'#403328':'#f9f5ec','Cairo','center',c1);txt('الشركة العامة للاتصالات والمعلوماتية',cx,552,25,style===1?'#514033':'#e1f3ef','Cairo','center',c2);txt('نظام الادارة المحوكمة الشامل',cx,598,25,gold,'Cairo','center',c3);
// provincial seals: center (company, Karbala) in first centered row, then 3 x 5
logos.forEach((im,i)=>{let st=1+i*.61,d=targets(i);if(t<st-.01)return;
let dx=d.x,dy=d.y,phase=clamp((t-st)/2.4),q=smo(phase);if(t<st-.01)return;
let px,py;
if(phase<.12){let u=smo(phase/.12);px=650+230*u;py=cy-7}
else if(phase<.68){let u=(phase-.12)/.56,theta=-Math.PI*u+((i%3)-1)*.14*Math.sin(Math.PI*u);px=650+230*Math.cos(theta);py=cy-7+158*Math.sin(theta)}
else{let u=smo((phase-.68)/.32);px=420+(dx-420)*u;py=cy-7+(dy-(cy-7))*u}
let size=i<2?94:88,appear=smo((t-st-.2)/.72),rotation=(1-q)*(style===1?-.45:.65)*(i%2?1:-1);
if(style===0){py+=Math.sin(Math.PI*phase)*9;rotation*=.7}
if(style===1){appear=smo((t-st-.28)/.8);rotation=(1-q)*.25*(i%2?1:-1)}
if(style===2){py-=Math.sin(Math.PI*phase)*25;rotation=(1-q)*.8}
// a restrained orbit trail leads each seal around the central mark
if(phase<.68&&phase>.1){let u=(phase-.12)/.56,theta=-Math.PI*clamp(u);x.save();x.globalAlpha=.12*(1-u*.45);x.strokeStyle=accent;x.lineWidth=style===1?1:2;x.setLineDash(style===1?[2,8]:[9,10]);x.beginPath();x.ellipse(650,cy-7,230,158,0,0,theta,true);x.stroke();x.restore()}
let card=size*(.35+.65*appear);x.save();x.translate(px,py);x.rotate(rotation);x.globalAlpha=Math.min(1,appear*1.15);if(style===1){x.scale(Math.max(.12,1-(1-q)*Math.abs(Math.cos((t-st-.35)*2.2))),1)}
x.shadowColor=accent;x.shadowBlur=style===1?10:18;x.fillStyle=style===1?'#fffaf1':'#f5fbfa';x.beginPath();x.arc(0,0,card/2,0,Math.PI*2);x.fill();x.shadowBlur=0;x.beginPath();x.arc(0,0,card/2-4,0,Math.PI*2);x.clip();x.drawImage(im,-card/2+4,-card/2+4,card-8,card-8);x.restore();});
// mark the constellation as a horizon, no outline around the collection
if(t>12.1){let q=smo((t-12.1)/.8);x.save();x.globalAlpha=q;x.strokeStyle=accent;x.lineWidth=1.2;x.beginPath();x.moveTo(44,120);x.lineTo(368,120);x.stroke();x.restore()}
// developer credits: naked editorial hierarchy, animated minaret movie, fully centered
if(t>=8){let q=quart((t-8)/1.1), mx=1090;let af=appFrames[Math.min(appFrames.length-1,Math.floor((t-8)*15))];x.save();x.globalAlpha=q; x.shadowColor=gold;x.shadowBlur=13;x.drawImage(af,mx-52,16,104,100);x.restore();
let y0=134;txt('تطوير',mx,y0,30,gold,'Cairo','center',q);txt('مديرية اتصالات ومعلوماتية',mx,y0+50,30,style===1?'#403328':'#f5f7f7','Cairo','center',q);txt('كربلاء المقدسة',mx,y0+96,23,style===1?'#66513e':'#dbe9e6','Cairo','center',q);txt('المهندس مسلم عقيل',mx,y0+135,19,style===1?'#4e594b':accent,'Cairo','center',q)}
// pace and punctuation vary by art direction
if(style===0){let u=(t*45)%1500,beam=x.createLinearGradient(u-250,0,u-130,0);beam.addColorStop(0,'#ffffff00');beam.addColorStop(.5,'#ffffff10');beam.addColorStop(1,'#ffffff00');x.fillStyle=beam;x.fillRect(u-250,0,120,720)}
if(style===1){x.fillStyle='#bd8150';x.fillRect(458,635,7,7);x.fillStyle='#d9c9b2';x.fillRect(475,635,7,7);x.fillRect(492,635,7,7)}
if(style===2){let pulse=(t%3)/3;x.save();x.globalAlpha=.24*(1-pulse);x.strokeStyle=accent;x.lineWidth=2;x.beginPath();x.arc(650,328,140+pulse*110,0,Math.PI*2);x.stroke();x.restore()}
}
window.draw=draw;
</script></html>`;
(async()=>{let browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--allow-file-access-from-files']});let page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});let file=path.join(__dirname,'render-v2.html');fs.writeFileSync(file,html);await page.goto('file:///'+file.replace(/\\/g,'/'),{waitUntil:'load'});await page.waitForFunction(()=>window.ready,{timeout:90000});for(let s=0;s<3;s++){let d=path.join(out,String.fromCharCode(65+s));fs.mkdirSync(d,{recursive:true});for(let f=0;f<225;f++){await page.evaluate(({t,s})=>window.draw(t,s),{t:f/15,s});await page.screenshot({path:path.join(d,'frame'+String(f).padStart(4,'0')+'.jpg'),type:'jpeg',quality:86})}let n=['ITPC_Concept_A_Cinematic_15s','ITPC_Concept_B_Editorial_15s','ITPC_Concept_C_IraqNetwork_15s'][s];execFileSync(process.env.FFMPEG||'ffmpeg',['-y','-framerate','15','-i',path.join(d,'frame%04d.jpg'),'-c:v','libx264','-preset','slow','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart','-an',path.join(__dirname,n+'.mp4')],{stdio:'ignore'});await page.evaluate(({s})=>window.draw(14.8,s),{s});await page.screenshot({path:path.join(__dirname,n+'.jpg'),type:'jpeg',quality:92})}await browser.close()})().catch(e=>{console.error(e);process.exit(1)});

