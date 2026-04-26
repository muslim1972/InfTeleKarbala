const fs = require('fs');

// قراءة الصورة وتحويلها لـ Base64
const imageBase64 = fs.readFileSync('public/logo-new.png').toString('base64');

// قالب HTML الكامل (مع الموسيقى والمؤثرات)
const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>ITPC - قريباً</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;600;700;900&display=swap');
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:#030510;font-family:'Tajawal',sans-serif}
#main{position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;direction:rtl;opacity:1;transition:opacity 1.5s}
#main.fade-out{opacity:0}
#c{position:absolute;inset:0;z-index:0;pointer-events:none}
.gb{position:absolute;inset:0;z-index:1;pointer-events:none;animation:gs 20s infinite}
@keyframes gs{0%{background:radial-gradient(ellipse at 30% 50%,rgba(10,36,99,0.9),transparent 70%)}33%{background:radial-gradient(ellipse at 70% 30%,rgba(10,36,99,0.9),transparent 70%)}66%{background:radial-gradient(ellipse at 50% 70%,rgba(10,36,99,0.9),transparent 70%)}100%{background:radial-gradient(ellipse at 30% 50%,rgba(10,36,99,0.9),transparent 70%)}}
.ct{position:relative;z-index:10;text-align:center;display:flex;flex-direction:column;align-items:center;padding:20px}
.lc{position:relative;margin-bottom:30px;opacity:0;transform:scale(0);transition:all 2.8s cubic-bezier(0.16,1,0.3,1)}
.lc.show{opacity:1;transform:scale(1.35)}
.li{max-width:55vw;max-height:35vh;filter:drop-shadow(0 0 45px rgba(34,197,94,0.35));animation:fl 4.5s infinite}
@keyframes fl{0%,100%{transform:translateY(0);filter:drop-shadow(0 0 45px rgba(34,197,94,0.35))}50%{transform:translateY(-12px);filter:drop-shadow(0 0 75px rgba(34,197,94,0.55))}}
.ld{width:0;height:1px;background:linear-gradient(90deg,transparent,#22c55e,transparent);margin:20px auto;transition:width 1.8s;opacity:0}
.ld.show{width:280px;opacity:1}
.ti{color:#fff;opacity:0;transform:translateY(35px);filter:blur(12px);transition:all 1.6s;margin-bottom:8px}
.ti.show{opacity:1;transform:none;filter:none}
.t1{font-size:clamp(1.2rem,5vw,2rem);font-weight:700}
.t2{font-size:clamp(0.9rem,4vw,1.5rem);font-weight:600;opacity:.8}
.sb{margin-top:30px;padding:15px 40px;background:linear-gradient(135deg,rgba(16,185,129,0.3),rgba(16,185,129,0.15),rgba(5,150,105,0.3));border:2px solid rgba(16,185,129,0.5);border-radius:15px;font-size:clamp(1.8rem,7vw,3rem);font-weight:900;color:#fff;letter-spacing:.25em;box-shadow:0 0 40px rgba(16,185,129,0.25),inset 0 2px 0 rgba(255,255,255,0.15);backdrop-filter:blur(8px);opacity:0;transform:scale(.5);filter:blur(15px);transition:all 2.2s cubic-bezier(0.16,1,0.3,1)}
.sb.show{opacity:1;transform:scale(1);filter:none}
.pb{position:absolute;bottom:0;left:0;right:0;height:3px;z-index:50;background:linear-gradient(90deg,#22c55e,#3b82f6,#10b981,#22c55e);background-size:200% 100%;transform-origin:left;transform:scaleX(0);transition:transform 20s linear;animation:pg 6s infinite}
.pb.active{transform:scaleX(1)}
@keyframes pg{0%{background-position:0% 50%}100%{background-position:200% 50%}}
.sk{position:absolute;top:20px;left:20px;z-index:50;padding:10px 24px;border-radius:50px;border:1px solid rgba(255,255,255,0.2);background:rgba(0,0,0,0.3);color:rgba(255,255,255,0.5);font-family:'Tajawal',sans-serif;font-size:.9rem;font-weight:700;cursor:pointer;backdrop-filter:blur(10px);transition:all .4s;opacity:0}
.sk.show{opacity:1}
.sk:hover,.sk:active{color:rgba(255,255,255,0.9);border-color:rgba(16,185,129,0.6);background:rgba(16,185,129,0.15);transform:scale(1.05)}
.ah{position:absolute;bottom:60px;z-index:50;color:rgba(255,255,255,0.3);font-size:.85rem;letter-spacing:.2em;animation:ph 3.5s infinite;opacity:0}
.ah.show{opacity:1}
@keyframes ph{0%,100%{opacity:.3;transform:translateY(0)}50%{opacity:.8;transform:translateY(-8px)}}
</style>
</head>
<body>
<div id="main">
<canvas id="c"></canvas>
<div class="gb"></div>
<div class="pb" id="pb"></div>
<button class="sk" id="sk">← تخطي العرض</button>
<p class="ah" id="ah">انقر لتفعيل التجربة الصوتية الفاخرة</p>
<div class="ct">
<div class="lc" id="lc"><img class="li" id="logoImg" alt="Logo" src="data:image/png;base64,${imageBase64}"></div>
<div class="ld" id="ld"></div>
<div class="ti t1" id="t1">وزارة الاتصالات</div>
<div class="ti t2" id="t2">مديرية اتصالات ومعلوماتية كربلاء المقدسة</div>
<div class="sb" id="sb">قريبــــاً</div>
</div>
</div>
<script>
(function(){
'use strict';
var SPLASH_DURATION = 20000;
var isExiting = false;
var audioCtx = null;
var audioStarted = false;

// === Binary Rain ===
var canvas = document.getElementById('c');
var ctx = canvas.getContext('2d');
var W, H;
function resize() {
W = canvas.width = window.innerWidth;
H = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();
var cols = Math.max(1, Math.floor(W / 25));
var drops = new Array(cols).fill(0).map(function(){ return -Math.random() * 60; });
var chars = "01";
var lastTime = 0;
function drawBinary(timestamp) {
var dt = timestamp - lastTime;
lastTime = timestamp;
ctx.fillStyle = 'rgba(3,5,16,0.12)';
ctx.fillRect(0, 0, W, H);
ctx.fillStyle = '#0ea5e9';
ctx.font = '14px monospace';
ctx.textAlign = 'center';
for (var i = 0; i < cols; i++) {
var ch = chars[Math.floor(Math.random() * chars.length)];
var x = i * 25 + 12.5;
var y = drops[i] * 25;
ctx.globalAlpha = Math.random() * 0.4 + 0.2;
ctx.fillText(ch, x, y);
if (y > H && Math.random() > 0.98) drops[i] = 0;
drops[i] += 0.015 * (dt || 16);
}
ctx.globalAlpha = 1;
if (!isExiting) requestAnimationFrame(drawBinary);
}
requestAnimationFrame(drawBinary);

// === الموسيقى التلقائية (Corporate Chime) ===
function createSplashMusic() {
if (audioCtx) return;
try {
audioCtx = new (window.AudioContext || window.webkitAudioContext)();
} catch(e) {
return;
}
var now = audioCtx.currentTime;
var masterGain = audioCtx.createGain();
masterGain.gain.setValueAtTime(0.25, now);
masterGain.gain.linearRampToValueAtTime(0.3, now + 1);
masterGain.gain.linearRampToValueAtTime(0.25, now + 15);
masterGain.gain.exponentialRampToValueAtTime(0.001, now + 19.5);
masterGain.connect(audioCtx.destination);

// Reverb
var convolver = audioCtx.createConvolver();
var reverbLen = audioCtx.sampleRate * 3;
var reverbBuf = audioCtx.createBuffer(2, reverbLen, audioCtx.sampleRate);
for (var ch = 0; ch < 2; ch++) {
var data = reverbBuf.getChannelData(ch);
for (var i = 0; i < reverbLen; i++) {
data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / reverbLen, 2.5);
}
}
convolver.buffer = reverbBuf;
var reverbGain = audioCtx.createGain();
reverbGain.gain.setValueAtTime(0.12, now);
convolver.connect(reverbGain);
reverbGain.connect(masterGain);

var dryGain = audioCtx.createGain();
dryGain.gain.setValueAtTime(0.88, now);
dryGain.connect(masterGain);

function playNote(freq, startTime, duration, volume, type) {
var osc = audioCtx.createOscillator();
osc.type = type || 'sine';
osc.frequency.setValueAtTime(freq, now + startTime);
var gain = audioCtx.createGain();
gain.gain.setValueAtTime(0, now + startTime);
gain.gain.linearRampToValueAtTime(volume || 0.05, now + startTime + 0.3);
gain.gain.setValueAtTime(volume || 0.05, now + startTime + duration - 1);
gain.gain.exponentialRampToValueAtTime(0.001, now + startTime + duration);
osc.connect(gain);
gain.connect(dryGain);
gain.connect(convolver);
osc.start(now + startTime);
osc.stop(now + startTime + duration);
}

// Pad Chords
var padNotes = [
[130.81, 0, 19, 0.04],
[196.00, 0, 19, 0.04],
[261.63, 0.5, 18.5, 0.04],
[329.63, 1, 18, 0.04],
[392.00, 5, 14, 0.04]
];
padNotes.forEach(function(n){ playNote(n[0], n[1], n[2], n[3], 'sine'); });

// Bell Chimes
var bellNotes = [
[523.25, 0.8, 0.10],
[659.25, 1.6, 0.08],
[783.99, 2.4, 0.09],
[1046.50, 3.2, 0.07],
[783.99, 6.0, 0.06],
[880.00, 9.0, 0.06],
[1046.50, 12.0, 0.05],
[1318.51, 15.0, 0.04],
[1567.98, 17.5, 0.03]
];
bellNotes.forEach(function(n){
playNote(n[0], n[1], 3.5, n[2], 'sine');
playNote(n[0]*2, n[1], 2.5, n[2]*0.3, 'triangle');
});

// Sub Bass
playNote(65.41, 0, 19.8, 0.06, 'sine');

// Shimmer
var shimmerFreqs = [2093, 2637, 3136];
shimmerFreqs.forEach(function(freq, i){
playNote(freq, 2 + i*0.3, 18, 0.006, 'sine');
});
}

// === عناصر التحكم ===
var lc = document.getElementById('lc');
var ld = document.getElementById('ld');
var t1 = document.getElementById('t1');
var t2 = document.getElementById('t2');
var sb = document.getElementById('sb');
var sk = document.getElementById('sk');
var ah = document.getElementById('ah');
var pb = document.getElementById('pb');
var main = document.getElementById('main');

function startAnimation() {
createSplashMusic();
setTimeout(function(){ lc.classList.add('show'); }, 1000);
setTimeout(function(){ ld.classList.add('show'); }, 2000);
setTimeout(function(){ t1.classList.add('show'); }, 3200);
setTimeout(function(){ t2.classList.add('show'); }, 4800);
setTimeout(function(){ sb.classList.add('show'); }, 6800);
setTimeout(function(){ sk.classList.add('show'); }, 3000);
setTimeout(function(){ ah.classList.add('show'); }, 500);
setTimeout(function(){ pb.classList.add('active'); }, 100);
setTimeout(function(){ if(!isExiting) exitSplash(); }, SPLASH_DURATION);
}

function exitSplash() {
if (isExiting) return;
isExiting = true;
main.classList.add('fade-out');
if (audioCtx) { try { audioCtx.close(); } catch(e) {} audioCtx = null; }
setTimeout(function(){
main.innerHTML = '<div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#030510;flex-direction:column;padding:20px;text-align:center;font-family:Tajawal,sans-serif"><div style="color:#22c55e;font-size:2rem;font-weight:900;margin-bottom:20px;letter-spacing:.2em">✨ تم ✨</div><p style="color:rgba(255,255,255,0.5);font-size:1rem">انتهت واجهة السبلاش التجريبية<br>المدة: 20 ثانية بالكامل</p><button onclick="location.reload()" style="margin-top:30px;padding:12px 30px;border-radius:50px;border:1px solid rgba(16,185,129,0.5);background:rgba(16,185,129,0.15);color:#fff;font-family:Tajawal,sans-serif;font-size:1rem;cursor:pointer;font-weight:700">إعادة التشغيل</button></div>';
}, 1500);
}

function handleInteraction() {
if (!audioStarted) {
audioStarted = true;
if (!audioCtx) createSplashMusic();
ah.style.display = 'none';
}
}
document.addEventListener('click', handleInteraction);
document.addEventListener('touchstart', handleInteraction);
document.addEventListener('keydown', handleInteraction);

sk.addEventListener('click', function(e){ e.stopPropagation(); exitSplash(); });

if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', startAnimation);
} else {
startAnimation();
}
setTimeout(function(){ if(!audioStarted) ah.style.display = 'block'; }, 2000);
})();
</script>
</body>
</html>`;

// حفظ الملف النهائي
const outputPath = 'splash_final.html';
fs.writeFileSync(outputPath, html, 'utf8');
const stats = fs.statSync(outputPath);
console.log('✅ تم إنشاء الملف بنجاح!');
console.log('📏 الحجم: ' + (stats.size / 1024).toFixed(0) + ' كيلوبايت');
console.log('📁 المسار: ' + outputPath);
console.log('');
console.log('🔊 يحتوي على موسيقى تلقائية فخمة');
console.log('💻 Binary Rain بسرعة معتدلة');
console.log('🚀 أرسل الملف عبر واتساب');
`;

### الخطوة 2: شغّل الأمر في PowerShell

انسخ والصق هذا الأمر في PowerShell (في مسار `D:\InfTeleKarbala`):

```powershell
node build_full.cjs