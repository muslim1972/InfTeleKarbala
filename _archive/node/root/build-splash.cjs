"const fs = require('fs');
const path = require('path');

// قراءة ملف الصورة وتحويله إلى Base64
const imagePath = path.join(__dirname, 'public', 'logo-new.png');
const imageBuffer = fs.readFileSync(imagePath);
const base64Image = imageBuffer.toString('base64');

console.log('✅ تم قراءة الصورة، حجم Base64:', base64Image.length, 'حرف');

// قالب HTML
const htmlTemplate = `<!DOCTYPE html>
<html lang=\"ar\" dir=\"rtl\">
<head>
<meta charset=\"UTF-8\">
<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no\">
<title>ITPC - قريباً</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;600;700;900&display=swap');
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:#030510;font-family:'Tajawal',sans-serif;-webkit-tap-highlight-color:transparent;user-select:none}
#main{position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;direction:rtl;opacity:1;transition:opacity 1.5s}
#main.fade-out{opacity:0}
#c{position:absolute;inset:0;z-index:0;pointer-events:none}
.gb{position:absolute;inset:0;z-index:1;pointer-events:none;animation:gs 20s infinite}
@keyframes gs{0%{background:radial-gradient(ellipse at 30% 50%,rgba(10,36,99,0.9),transparent 70%)}33%{background:radial-gradient(ellipse at 70% 30%,rgba(10,36,99,0.9),transparent 70%)}66%{background:radial-gradient(ellipse at 50% 70%,rgba(10,36,99,0.9),transparent 70%)}100%{background:radial-gradient(ellipse at 30% 50%,rgba(10,36,99,0.9),transparent 70%)}}
.ct{position:relative;z-index:10;text-align:center;display:flex;flex-direction:column;align-items:center;padding:20px}
.lc{position:relative;margin-bottom:30px;opacity:0;transform:scale(0);transition:all 2.8s cubic-bezier(0.16,1,0.3,1)}
.lc.s{opacity:1;transform:scale(1.35)}
.li{max-width:55vw;max-height:35vh;filter:drop-shadow(0 0 45px rgba(34,197,94,0.35));animation:fl 4.5s infinite}
@keyframes fl{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px);filter:drop-shadow(0 0 75px rgba(34,197,94,0.55))}}
.ld{width:0;height:1px;background:linear-gradient(90deg,transparent,#22c55e,transparent);margin:20px auto;transition:width 1.8s;opacity:0}
.ld.s{width:280px;opacity:1}
.ti{color:#fff;opacity:0;transform:translateY(35px);filter:blur(12px);transition:all 1.6s;margin-bottom:8px}
.ti.s{opacity:1;transform:none;filter:none}
.t1{font-size:clamp(1.2rem,5vw,2rem);font-weight:700}
.t2{font-size:clamp(0.9rem,4vw,1.5rem);font-weight:600;opacity:.8}
.sb{margin-top:30px;padding:15px 40px;background:linear-gradient(135deg,rgba(16,185,129,0.3),rgba(16,185,129,0.15),rgba(5,150,105,0.3));border:2px solid rgba(16,185,129,0.5);border-radius:15px;font-size:clamp(1.8rem,7vw,3rem);font-weight:900;color:#fff;letter-spacing:.25em;box-shadow:0 0 40px rgba(16,185,129,0.25),inset 0 2px 0 rgba(255,255,255,0.15);backdrop-filter:blur(8px);opacity:0;transform:scale(.5);filter:blur(15px);transition:all 2.2s cubic-bezier(0.16,1,0.3,1)}
.sb.s{opacity:1;transform:scale(1);filter:none}
.pb{position:absolute;bottom:0;left:0;right:0;height:3px;z-index:50;background:linear-gradient(90deg,#22c55e,#3b82f6,#10b981,#22c55e);background-size:200% 100%;transform-origin:left;transform:scaleX(0);transition:transform 20s linear;animation:pg 6s infinite}
.pb.a{transform:scaleX(1)}
@keyframes pg{0%{background-position:0 50%}100%{background-position:200% 50%}}
.sk{position:absolute;top:20px;left:20px;z-index:50;padding:10px 24px;border-radius:50px;border:1px solid rgba(255,255,255,0.2);background:rgba(0,0,0,0.3);color:rgba(255,255,255,0.5);font-family:'Tajawal',sans-serif;font-size:.9rem;font-weight:700;cursor:pointer;backdrop-filter:blur(10px);transition:all .4s;opacity:0}
.sk.s{opacity:1}
.sk:hover,.sk:active{color:rgba(255,255,255,0.9);border-color:rgba(16,185,129,0.6);background:rgba(16,185,129,0.15);transform:scale(1.05)}
.ah{position:absolute;bottom:60px;z-index:50;color:rgba(255,255,255,0.3);font-size:.85rem;letter-spacing:.2em;animation:ph 3.5s infinite;opacity:0}
.ah.s{opacity:1}
@keyframes ph{0%,100%{opacity:.3;transform:translateY(0)}50%{opacity:.8;transform:translateY(-8px)}}
</style>
</head>
<body>
<div id=main>
<canvas id=c></canvas>
<div class=gb></div>
<div class=pb id=pb></div>
<button class=sk id=sk>← تخطي العرض</button>
<p class=ah id=ah>انقر لتفعيل التجربة الصوتية الفاخرة</p>
<div class=ct>
<div class=lc id=lc><img class=li alt=Logo src=\"data:image/png;base64,` + base64Image + `\"></div>
<div class=ld id=ld></div>
<div class=\"ti t1\" id=t1>وزارة الاتصالات</div>
<div class=\"ti t2\" id=t2>مديرية اتصالات ومعلوماتية كربلاء المقدسة</div>
<div class=sb id=sb>قريبــــاً</div>
</div>
</div>
<script>
(function(){'use strict';
var D=20000,E=false,A=null,H=false;
var c=document.getElementById('c'),x=c.getContext('2d'),W,Hh;
function rs(){W=c.width=innerWidth;Hh=c.height=innerHeight;}
onresize=rs;rs();
var cols=Math.max(1,Math.floor(W/25)),dr=Array(cols).fill(0).map(function(){return -Math.random()*50;}),ch='01',lt=0;
function db(t){
var dt=t-lt;lt=t;
x.fillStyle='rgba(3,5,16,0.12)';x.fillRect(0,0,W,Hh);
x.fillStyle='#0ea5e9';x.font='16px monospace';x.textAlign='center';
for(var i=0;i<cols;i++){var ch2=ch[Math.floor(Math.random()*2)],X=i*25+12.5,Y=dr[i]*25;
x.globalAlpha=Math.random()*0.4+0.2;x.fillText(ch2,X,Y);
if(Y>Hh&&Math.random()>0.975)dr[i]=0;
dr[i]+=0.015*(dt||16);}
x.globalAlpha=1;
if(!E)requestAnimationFrame(db);
}
requestAnimationFrame(db);
function mu(){
if(A)return;
try{A=new(window.AudioContext||window.webkitAudioContext)()}catch(e){return}
var n=A.currentTime,m=A.createGain();
m.gain.setValueAtTime(0.25,n);m.gain.linearRampToValueAtTime(0.3,n+1);m.gain.linearRampToValueAtTime(0.25,n+15);m.gain.exponentialRampToValueAtTime(0.001,n+19.5);m.connect(A.destination);
var rv=A.createConvolver(),rl=A.sampleRate*3,rb=A.createBuffer(2,rl,A.sampleRate);
for(var ch=0;ch<2;ch++){var d=rb.getChannelData(ch);for(var i=0;i<rl;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/rl,2.5);}
rv.buffer=rb;var rg=A.createGain();rg.gain.setValueAtTime(0.12,n);rv.connect(rg);rg.connect(m);
var dy=A.createGain();dy.gain.setValueAtTime(0.88,n);dy.connect(m);
function no(f,st,du,vo,ty){
var o=A.createOscillator();o.type=ty||'sine';o.frequency.setValueAtTime(f,n+st);
var g=A.createGain();g.gain.setValueAtTime(0,n+st);g.gain.linearRampToValueAtTime(vo||0.05,n+st+0.3);g.gain.setValueAtTime(vo||0.05,n+st+du-1);g.gain.exponentialRampToValueAtTime(0.001,n+st+du);
o.connect(g);g.connect(dy);g.connect(rv);o.start(n+st);o.stop(n+st+du);
}
[[130.81,0,19],[196,0,19],[261.63,0.5,18.5],[329.63,1,18],[392,5,14]].forEach(function(v){no(v[0],v[1],v[2],0.04,'sine')});
[[523.25,0.8,0.1],[659.25,1.6,0.08],[783.99,2.4,0.09],[1046.5,3.2,0.07],[783.99,6,0.06],[880,9,0.06],[1046.5,12,0.05],[1318.51,15,0.04],[1567.98,17.5,0.03]].forEach(function(v){no(v[0],v[1],3.5,v[2],'sine');no(v[0]*2,v[1],2.5,v[2]*0.3,'triangle')});
no(65.41,0,19.8,0.06,'sine');[2093,2637,3136].forEach(function(f,i){no(f,2+i*0.3,18,0.006,'sine')});
}
var lc=document.getElementById('lc'),ld=document.getElementById('ld'),t1=document.getElementById('t1'),t2=document.getElementById('t2'),sb=document.getElementById('sb'),sk=document.getElementById('sk'),ah=document.getElementById('ah'),pb=document.getElementById('pb'),me=document.getElementById('main');
function go(){
mu();
setTimeout(function(){lc.classList.add('s')},1e3);
setTimeout(function(){ld.classList.add('s')},2e3);
setTimeout(function(){t1.classList.add('s')},3200);
setTimeout(function(){t2.classList.add('s')},4800);
setTimeout(function(){sb.classList.add('s')},6800);
setTimeout(function(){sk.classList.add('s')},3e3);
setTimeout(function(){ah.classList.add('s')},500);
setTimeout(function(){pb.classList.add('a')},100);
setTimeout(function(){if(!E)ex()},D);
}
function ex(){
if(E)return;E=true;me.classList.add('fade-out');if(A){try{A.close()}catch(e){}A=null}
setTimeout(function(){me.innerHTML='<div style=\"position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#030510;flex-direction:column;padding:20px;text-align:center;font-family:Tajawal,sans-serif\"><div style=\"color:#22c55e;font-size:2rem;font-weight:900;margin-bottom:20px;letter-spacing:.2em\">✨ تم ✨</div><p style=\"color:rgba(255,255,255,0.5);font-size:1rem\">انتهت واجهة السبلاش التجريبية<br>المدة: 20 ثانية بالكامل</p><button onclick=\"location.reload()\" style=\"margin-top:30px;padding:12px 30px;border-radius:50px;border:1px solid rgba(16,185,129,0.5);background:rgba(16,185,129,0.15);color:#fff;font-family:Tajawal,sans-serif;font-size:1rem;cursor:pointer;font-weight:700\">إعادة التشغيل</button></div>'},1500);
}
function hi(){if(!H){H=true;if(!A)mu();ah.style.display='none'}}
document.addEventListener('click',hi);document.addEventListener('touchstart',hi);document.addEventListener('keydown',hi);
sk.addEventListener('click',function(e){e.stopPropagation();ex()});
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',go)}else{go()}
setTimeout(function(){if(!H)ah.style.display='block'},2e3);
})();
</script>
</body>
</html>`;

// حفظ الملف
const outputPath = path.join(__dirname, 'splash_standalone.html');
fs.writeFileSync(outputPath, htmlTemplate, 'utf-8');

const stats = fs.statSync(outputPath);
console.log('✅ تم إنشاء الملف بنجاح!');
console.log('📁 المسار: ' + outputPath);
console.log('📏 الحجم: ' + (stats.size / 1024).toFixed(0) + ' كيلوبايت');
console.log('');
console.log('📱 الآن يمكنك:');
console.log('   1. أرسل الملف splash_standalone.html عبر واتساب');
console.log('   2. عند النقر عليه في الواتساب سيفتح في المتصفح');
console.log('   3. سيعمل تلقائياً لمدة 20 ثانية كاملة مع الصوت والمؤثرات');
console.log('');
console.log('⚠️  ملاحظة: إذا أرسلته عبر واتساب، سيظهر معاينة. اطلب من المستلم');
console.log('   فتحه في المتصفح (Chrome أو Edge) للحصول على أفضل تجربة.');"