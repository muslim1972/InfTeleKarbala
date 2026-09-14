// 🛡️ معالجة خطأ الشاشة البيضاء (White Screen of Death) على الموبايل
// عند تحديث التطبيق، قد يحتفظ المتصفح بـ index.html القديم الذي يشير لملفات JS تم حذفها
window.addEventListener('error', function(e) {
  if (e.target && (e.target.tagName === 'SCRIPT' || e.target.tagName === 'LINK')) {
    console.warn('⚠️ فشل تحميل مورد، جاري تحديث الصفحة لجلب النسخة الجديدة...');
    if (!sessionStorage.getItem('asset-error-reloaded')) {
      sessionStorage.setItem('asset-error-reloaded', 'true');
      window.location.reload(true);
    }
  }
}, true);
