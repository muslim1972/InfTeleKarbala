import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { startOfDay, endOfDay } from 'date-fns';

export function useLiveAttendance() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date();
      const start = startOfDay(today).toISOString();
      const end = endOfDay(today).toISOString();

      const { data, error: fetchError } = await supabase
        .from('attendance_records')
        .select(`
          *,
          employee:profiles(id, full_name, job_number, department_id),
          department:departments(name)
        `)
        .gte('created_at', start)
        .lte('created_at', end);

      if (fetchError) throw fetchError;
      setRecords(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();

    // Subscribe to realtime changes on attendance_records
    const channel = supabase
      .channel('live-attendance')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance_records' },
        (payload) => {
          setRecords((current) => {
            if (payload.eventType === 'INSERT') {
              // Note: payload.new doesn't have the joined profile/department data.
              // We refetch the initial data or just fetch the missing row data here.
              // For a simple robust implementation, let's just refetch.
              fetchInitialData();
              return current;
            }
            if (payload.eventType === 'UPDATE') {
              // Update the specific record while keeping the joined data if it exists
              return current.map((rec) => 
                rec.id === payload.new.id ? { ...rec, ...payload.new } : rec
              );
            }
            if (payload.eventType === 'DELETE') {
              return current.filter((rec) => rec.id !== payload.old.id);
            }
            return current;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchInitialData]);

  return { records, loading, error, refetch: fetchInitialData };
}
