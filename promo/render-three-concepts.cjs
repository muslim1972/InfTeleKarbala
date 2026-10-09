const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const outDir = path.join(__dirname, 'rendered-concepts');
fs.mkdirSync(outDir, {recursive:true});
const govDir = path.join(root,'public','govs');
const govs = fs.readdirSync(govDir).filter(x=>x.endsWith('.jpeg')).sort((a,b)=>a.localeCompare(b,'ar'));
const data = govs.map(x=>({name:x.replace('.jpeg',''), src:'file:///'+path.join(govDir,x).replace(/\\/g,'/')}));
const html = `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><style>@font-face{font-family:Cairo;src:url(file:///${path.join(root,'public','fonts','Cairo-Regular.ttf').replace(/\\/g,'/')})}*{box-sizing:border-box}html,body{margin:0;width:1280px;height:720px;background:#030916;overflow:hidden}canvas{width:1280px;height:720px}</style><canvas id="c" width="1280" height="720"></canvas><script>window.DATA=${JSON.stringify(data)}; window.ready=false; const c=document.querySelector('#c'),x=c.getContext('2d'); const imgs=DATA.map(d=>{let i=new Image();i.src=d.src;return i}); const logo=new Image(); logo.src='file:///${path.join(root,'public','logo-new.png').replace(/\\/g,'/')}'; Promise.all([...imgs.map(i=>new Promise(r=>i.onload=r)),new Promise(r=>logo.onload=r),document.fonts.load('24px Cairo')]).then(()=>window.ready=true);
function rr(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r)}
function ease(v){return Math.max(0,Math.min(1,v))}
window.draw=(t,style)=>{x.clearRect(0,0,1280,720);let colors=style===0?['#061527','#13e5c2','#f2cb7b']:style===1?['#101019','#f3d7a3','#d47e52']:['#071c20','#81edbb','#c5e8ff'];let [bg,a,g]=colors;
let grad=x.createRadialGradient(style===0?640:360,350,20,640,360,900);grad.addColorStop(0,style===1?'#34251f':style===2?'#123a3c':'#0d2941');grad.addColorStop(1,bg);x.fillStyle=grad;x.fillRect(0,0,1280,720);
// living signal field
for(let j=0;j<80;j++){let px=(j*173+ t*23)%1280, py=(j*97+Math.sin(t*.7+j)*24)%720; x.fillStyle=a+'55';x.beginPath();x.arc(px,py,1+(j%3),0,7);x.fill(); if(j%4===0){x.strokeStyle=a+'20';x.beginPath();x.moveTo(px,py);x.lineTo(px+60,py+((j%2)?18:-18));x.stroke()}}
// concept frame accents
if(style===0){x.strokeStyle=a+'55';x.lineWidth=2; for(let r of [165,205,255]){x.beginPath();x.ellipse(640,315,r,r*.43,-.18+t*.16,0,Math.PI*2);x.stroke()} }
if(style===1){x.strokeStyle=g+'77';x.lineWidth=3;for(let i=0;i<3;i++){let y=115+i*28;x.beginPath();x.moveTo(410+i*18,y+450);x.quadraticCurveTo(360+i*18,270,430+i*18,90);x.quadraticCurveTo(640,35,850-i*18,90);x.quadraticCurveTo(920-i*18,270,870-i*18,y+450);x.stroke()}}
if(style===2){ // network globe
x.strokeStyle=a+'55';x.lineWidth=1.5;for(let i=0;i<9;i++){x.beginPath();x.ellipse(640,310,205,105,i*.17+t*.08,0,Math.PI*2);x.stroke()}x.beginPath();x.arc(640,310,210,0,7);x.stroke() }
// logo rises from void
let p=ease((t-.5)/1.2), scale=.52+.48*(1-Math.pow(1-p,3)); let lw=285*scale,lh=lw*logo.height/logo.width; x.save();x.globalAlpha=p; x.shadowColor=a;x.shadowBlur=34*p;rr(x,640-lw/2-20,282-lh/2-18,lw+40,lh+36,22);x.fillStyle=style===1?'#f6ead3':'#edf4f7';x.fill(); x.drawImage(logo,640-lw/2,282-lh/2,lw,lh);x.restore();
// titles staged in sequence
function text(s,y,sz,col,at=1){let q=ease((t-at)/.45);x.save();x.globalAlpha=q;x.font=sz+'px Cairo';x.textAlign='center';x.fillStyle=col;x.shadowColor=col;x.shadowBlur=12*q;x.fillText(s,640,y+(1-q)*16);x.restore()}
text('وزارة الاتصالات',442,29,'#fff4df',1.2);text('الشركة العامة للاتصالات والمعلوماتية',484,24,'#e2eee9',1.8);text('نظام الادارة المحوكمة الشامل',535,26,g,2.5);
// govs orbit toward left grid; stage 1-13, final grid
imgs.forEach((im,i)=>{let start=1+i*.67, q=ease((t-start)/1.05); if(t<start)return; let col=i%3,row=Math.floor(i/3); let gx=58+col*104,gy=120+row*102; let angle= (t-start)*2.25+i*.37;let ox=640+Math.cos(angle)*235,oy=300+Math.sin(angle)*100; let xx=ox+(gx-ox)*q, yy=oy+(gy-oy)*q;let sz=54*(1-q)+44*q; x.save();x.globalAlpha=Math.min(1,q*1.5);x.shadowColor=a;x.shadowBlur=12;rr(x,xx-sz/2,yy-sz/2,sz,sz,style===2?27:8);x.fillStyle='#fff';x.fill();x.clip();x.drawImage(im,xx-sz/2+3,yy-sz/2+3,sz-6,sz-6);x.restore(); });
// destination frame
if(t>12.7){x.save();x.globalAlpha=ease((t-12.7)/.5);x.strokeStyle=a;x.lineWidth=1;x.setLineDash([5,8]);rr(x,36,85,340,590,24);x.stroke();x.setLineDash([]);x.fillStyle=a;x.font='18px Cairo';x.textAlign='center';x.fillText('شبكة المحافظات',206,70);x.restore()}
// developer credit from 8 seconds
if(t>=8){let q=ease((t-8)/.7);x.save();x.globalAlpha=q;rr(x,943,25,310,210,18);x.fillStyle=style===1?'#211a17dd':'#071321dd';x.fill();x.strokeStyle=a+'99';x.lineWidth=1;x.stroke();x.textAlign='right';x.fillStyle=g;x.font='22px Cairo';x.fillText('تطوير',1225,68);x.fillStyle='#fff';x.font='18px Cairo';x.fillText('مديرية اتصالات ومعلوماتية',1225,107);x.fillText('كربلاء المقدسة',1225,145);x.fillStyle=a;x.font='20px Cairo';x.fillText('المهندس مسلم عقيل',1225,190);x.restore()}
};</script></html>`;
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--allow-file-access-from-files']});const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});fs.writeFileSync(path.join(__dirname,'render-temp.html'),html);await page.goto('file:///'+path.join(__dirname,'render-temp.html').replace(/\\\\/g,'/'),{waitUntil:'load'});await page.waitForFunction(()=>window.ready,{timeout:30000});for(let s=0;s<3;s++){const dir=path.join(outDir,'style'+String.fromCharCode(65+s));fs.mkdirSync(dir,{recursive:true});for(let f=0;f<225;f++){await page.evaluate(({t,s})=>window.draw(t,s),{t:f/15,s});await page.screenshot({path:path.join(dir,`frame${String(f).padStart(4,'0')}.jpg`),type:'jpeg',quality:83});}const name=['ITPC_Concept_C_Orbit_15s','ITPC_Concept_D_ArchNetwork_15s','ITPC_Concept_E_GovGrid_15s'][s];const ff=process.env.FFMPEG||'ffmpeg';execFileSync(ff,['-y','-framerate','15','-i',path.join(dir,'frame%04d.jpg'),'-c:v','libx264','-preset','slow','-crf','24','-pix_fmt','yuv420p','-movflags','+faststart','-an',path.join(__dirname,name+'.mp4')],{stdio:'inherit'});await page.evaluate(({s})=>window.draw(14.8,s),{s});await page.screenshot({path:path.join(__dirname,name+'.jpg'),type:'jpeg',quality:90});}await browser.close()})().catch(e=>{console.error(e);process.exit(1)});



