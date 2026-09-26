import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/supabase';
import { getLocalDateStr } from '../services/attendanceService';
import { toast } from 'react-hot-toast';

export const TEST_USERS = [
  'test-attendance-admin',
  'test-user-1',
  'test-user-2',
  'test-1',
  'test-2',
  'attend',
  'تجريبي بصمة' // just in case the name is Arabic in the DB
];

export const isTestUser = (identifier?: string | null) => {
  if (!identifier) return false;
  return TEST_USERS.includes(identifier);
};

export const useTestEnvironment = () => {
  const { user } = useAuth();
  // Check against username or full_name
  const isTest = isTestUser(user?.username) || isTestUser(user?.full_name);
  
  const resetPunches = async (employeeId: string) => {
    if (!isTest) return;
    try {
      // 2. Delete the specific record via secure RPC
      const { error } = await supabase.rpc('reset_test_attendance_today', {
        p_employee_id: employeeId
      });
        
      if (error) throw error;
      toast.success('تم تصفير بصمات اليوم بنجاح (بيئة تجريبية)');
      return true;
    } catch (err: any) {
      console.error('Reset punches error:', err);
      toast.error('فشل تصفير البصمات: ' + err.message);
      return false;
    }
  };
  
  return {
    isTest,
    username: user?.username,
    resetPunches
  };
};
