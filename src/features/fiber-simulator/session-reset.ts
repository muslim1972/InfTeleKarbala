/**
 * ============================================================
 * إعادة ضبط جلسة المحاكي عند تغيّر الهوية (دخول/خروج/تبديل حساب)
 * ============================================================
 * مخازن المحاكي (التصميم/التعليمي/اللحام) تعيش في الذاكرة على مستوى
 * الوحدة ولا تُمسح عند تسجيل الخروج — فإن دخل حساب آخر من المتصفح
 * نفسه دون إعادة تحميل الصفحة رأى رسم المستخدم السابق (الخريطة
 * المفتوحة والمنشآت وحتى تاريخ التراجع Ctrl+Z).
 *
 * تُستدعى resetFiberSimSession من AuthContext في نفس مواضع
 * setGisStorageOwner بالضبط — بحيث يمسح كل مالك جديد أثر المالك السابق.
 *
 * العزل: لا تستورد أي واجهة ولا أي شيء من التطبيق الأساسي.
 */

import { emptyEntities, type PhaseId, type ToolId } from './types';
import { useSimulatorStore } from './store/simulator.store';
import { useEduStore } from './store/education.store';
import { useLabStore } from './store/lab.store';

/** يعيد كل مخازن المحاكي إلى حالتها الابتدائية — idempotent */
export function resetFiberSimSession(): void {
  /* التصميم: خريطة افتراضية مسجلة + كيانات فارغة + مسودات وقياسات نظيفة.
     القيم مطابقة لحالة الإنشاء في simulator.store حرفياً */
  useSimulatorStore.setState({
    mapId: 'alley-16',
    entities: emptyEntities(),
    phase: 'civil' as PhaseId,
    tool: 'select' as ToolId,
    selectedIds: [],
    trenchDraft: null,
    dropDraft: null,
    measureFrom: null,
    measureTo: null,
    viewport: { scale: 4, tx: 0, ty: 0 },
  });
  /* حاسم أمنياً: تاريخ التراجع (zundo) يحتفظ بكيانات المستخدم السابق —
     بلا مسحه يستعيدها الحساب التالي عبر Ctrl+Z */
  useSimulatorStore.temporal.getState().clear();

  /* الطبقة التعليمية: الجولة + سجل أخطاء الجلسة + العناصر المستكشفة */
  useEduStore.setState({ tourOpen: false, errors: [], explored: [] });

  /* مختبر اللحام والاختبار: اللحمات والقياسات والنتيجة النهائية */
  useLabStore.getState().resetLab();
}
