import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/supabase';
import { toast } from 'react-hot-toast';

// ─── قائمة معرفات بيئة الاختبار المعتمدة حصراً ───
// عند حذف البيئة لاحقاً: احذف هذا الملف واربطاته فقط.
export const TEST_ENV_USERNAMES = [
  'test-attendance-admin',
  'test-user-1',
  'test-user-2'
] as const;

// هؤلاء فقط يظهر لهم زر تصفير البصمات
export const TEST_ENV_RESETERS = [
  'test-user-1',
  'test-user-2'
] as const;

// مطابقة باسم المستخدم أو الاسم الكامل (تتوافق مع حقل username في profiles)
export const isTestEnvironmentUser = (identifier?: string | null): boolean => {
  if (!identifier) return false;
  return TEST_ENV_USERNAMES.includes(identifier as typeof TEST_ENV_USERNAMES[number]);
};

export const isTestEnvironmentResetter = (identifier?: string | null): boolean => {
  if (!identifier) return false;
  return TEST_ENV_RESETERS.includes(identifier as typeof TEST_ENV_RESETERS[number]);
};

// ─── Hook أساسي للبيئة التجريبية (معزول بكل معنى الكلمة) ───
export const useTestEnvironment = () => {
  const { user } = useAuth();
  const username = user?.username;
  const fullName = user?.full_name;

  const isTest = isTestEnvironmentUser(username) || isTestEnvironmentUser(fullName);
  const canResetPunches = isTest
    && (isTestEnvironmentResetter(username) || isTestEnvironmentResetter(fullName));

  const resetPunches = async (employeeId: string) => {
    if (!canResetPunches) {
      toast.error('لا تملك صلاحية تصفير البصمات (بيئة تجريبية محدودة)');
      return false;
    }
    try {
      const { error } = await supabase.rpc('reset_test_attendance_today', {
        p_employee_id: employeeId
      });
      if (error) throw error;
      toast.success('تم تصفير بصمات اليوم بنجاح (بيئة تجريبية)');
      return true;
    } catch (err: any) {
      console.error('resetPunches [test-env]:', err);
      toast.error('فشل تصفير البصمات: ' + (err?.message || 'خطأ غير معروف'));
      return false;
    }
  };

  return {
    isTest,
    canResetPunches,
    username,
    resetPunches
  };
};
