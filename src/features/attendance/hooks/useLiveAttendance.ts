import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { fetchDailyAttendanceStats, baghdadDateStr, baghdadDayRange, type DailyAttendanceStats } from '../../../lib/attendanceHelpers';

export function useLiveAttendance(selectedGov?: string) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [trueAbsentCount, setTrueAbsentCount] = useState(0);
  const [dutyInfo, setDutyInfo] = useState<DailyAttendanceStats | null>(null);
  // تاريخ بغداد المعتمد (لا UTC) — يتحدث تلقائياً عند منتصف ليل بغداد
  const [currentDateStr, setCurrentDateStr] = useState(() => baghdadDateStr());

  // Check for day changes (midnight transition — Baghdad time)
  useEffect(() => {
    const intervalId = setInterval(() => {
      const newDateStr = baghdadDateStr();
      if (newDateStr !== currentDateStr) {
        setCurrentDateStr(newDateStr);
      }
    }, 60000); // Check every minute
    return () => clearInterval(intervalId);
  }, [currentDateStr]);

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dateStr = baghdadDateStr();
      const { startIso, endIso } = baghdadDayRange(dateStr);

      const gov = selectedGov || 'karbala';

      // 1. Fetch live attendance records
      const recordsRes = await supabase
        .from('attendance_records')
        .select('*, employee:profiles!attendance_records_employee_id_fkey(id, full_name, job_number, department_id, governorate), department:departments(name)')
        .gte('created_at', startIso)
        .lte('created_at', endIso);

      if (recordsRes.error) throw recordsRes.error;

      // Filter records for the current governorate if needed
      const filteredRecords = (gov && gov !== 'all') 
        ? (recordsRes.data || []).filter((r: any) => r.employee?.governorate === gov)
        : (recordsRes.data || []);

      setRecords(filteredRecords);

      // 2. Fetch profiles count for current governorate
      let pQuery = supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'user');

      if (gov && gov !== 'all') {
        pQuery = pQuery.eq('governorate', gov);
      }

      const countRes = await pQuery;
      setTotalEmployees(countRes.count || 0);

      // 3. Compute accurate daily attendance stats (with holiday & shift worker schedule)
      const stats = await fetchDailyAttendanceStats(dateStr, gov);
      setDutyInfo(stats);
      setTrueAbsentCount(stats.absentCount);

    } catch (err: any) {
      console.error('Error fetching live attendance:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedGov, currentDateStr]);

  useEffect(() => {
    fetchInitialData();
    const channel = supabase
      .channel('live-attendance-' + (selectedGov || 'all'))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance_records' },
        () => {
          fetchInitialData();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchInitialData, selectedGov]);

  return { 
    records, 
    allEmployees: dutyInfo?.allEmployees || [],
    loading, 
    error, 
    refetch: fetchInitialData, 
    totalEmployees, 
    trueAbsentCount,
    dutyInfo
  };
}
