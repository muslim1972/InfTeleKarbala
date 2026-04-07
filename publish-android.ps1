# publish-android.ps1
# سكربت أتمتة بناء ورفع تطبيق أندرويد المتكامل

Write-Host "🚀 بدء عملية بناء التطبيق الشاملة..." -ForegroundColor Cyan

# 0. حذف ملف APK قديم لتجنب تضخم حجم الملف (النسخة داخل النسخة)
Write-Host "🧹 0/4: تنظيف ملفات APK القديم..." -ForegroundColor Yellow
if (Test-Path "public/app.apk") {
    Remove-Item "public/app.apk" -Force
    Write-Host "✅ تم حذف الملف القديم لضمان صغر الحجم." -ForegroundColor Gray
}

# 1. بناء نسخة الويب (React/Vite)
Write-Host "📦 1/4: بناء نسخة الويب..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "❌ فشل بناء مشروع الويب"; exit $LASTEXITCODE }

# 2. المزامنة مع كاباسيتور (Capacitor Sync)
Write-Host "🔄 2/4: مزامنة ملفات الويب مع مشروع أندرويد..." -ForegroundColor Yellow
npx cap sync android
if ($LASTEXITCODE -ne 0) { Write-Error "❌ فشل مزامنة كاباسيتور"; exit $LASTEXITCODE }

# 3. بناء ملف APK (Debug)
Write-Host "🏗️ 3/4: توليد ملف APK عبر Gradle..." -ForegroundColor Yellow
Set-Location android
.\gradlew.bat assembleDebug
if ($LASTEXITCODE -ne 0) { 
    Write-Error "❌ فشل بناء APK. تأكد أن Path الخاص بـ Java و Android SDK معرفان لديك."
    Set-Location ..
    exit $LASTEXITCODE 
}
Set-Location ..

# 4. نقل الملف إلى مجلد الـ Public ليكون متاحاً للتحميل من الرابط مباشرة
Write-Host "🚚 4/4: نقل ملف APK إلى مجلد الـ Public..." -ForegroundColor Yellow
$sourceApk = "android/app/build/outputs/apk/debug/app-debug.apk"
$destApk = "public/app.apk"

if (Test-Path $sourceApk) {
    Copy-Item $sourceApk $destApk -Force
    Write-Host "✅ تم بنجاح! ملف APK متاح الآن في: $destApk" -ForegroundColor Green
    Write-Host "💡 الآن قم بعمل Git Push ليقوم Vercel بنشر النسخة الجديدة." -ForegroundColor Cyan
} else {
    Write-Error "❌ لم يتم العثور على ملف APK الناتج!"
    exit 1
}
