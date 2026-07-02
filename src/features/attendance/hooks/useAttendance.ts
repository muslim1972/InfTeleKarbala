import { useState, useCallback } from 'react';
import {
  attendanceRecordService,
  attendanceExceptionService,
  attendanceStatsService
} from '../services/attendanceService';
import { webauthnService } from '../services/webauthnService';
import type { AttendanceRecord, AttendanceException, AttendanceStats, BiometricVerificationResult } from '../types';

export function useAttendance(employeeId: string) {
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [exceptions, setExceptions] = useState<AttendanceException[]>([]);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTodayAttendance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const record = await attendanceRecordService.getTodayByEmployeeId(employeeId);
      setTodayAttendance(record || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  const loadAttendanceHistory = useCallback(async (startDate?: string, endDate?: string) => {
    setLoading(true);
    setError(null);
    try {
      const records = await attendanceRecordService.getByEmployeeId(employeeId, startDate, endDate);
      setAttendanceHistory(records);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  const loadExceptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const records = await attendanceExceptionService.getByEmployeeId(employeeId);
      setExceptions(records);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  const loadStats = useCallback(async (startDate: string, endDate: string) => {
    setLoading(true);
    setError(null);
    try {
      const statistics = await attendanceStatsService.getStats(employeeId, startDate, endDate);
      setStats(statistics);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  const checkIn = useCallback(async (location?: string, deviceId?: string, useBiometric: boolean = false) => {
    setLoading(true);
    setError(null);
    try {
      let verifiedByBiometric = false;
      
      if (useBiometric) {
        const verification = await webauthnService.verify(employeeId);
        if (!verification.success) {
          throw new Error(verification.message || 'فشل التحقق البيومتري');
        }
        verifiedByBiometric = true;
      }

      const record = await attendanceRecordService.checkIn(employeeId, location, deviceId, verifiedByBiometric);
      setTodayAttendance(record);
      return record;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  const checkOut = useCallback(async (location?: string, deviceId?: string, useBiometric: boolean = false) => {
    setLoading(true);
    setError(null);
    try {
      let verifiedByBiometric = false;
      
      if (useBiometric) {
        const verification = await webauthnService.verify(employeeId);
        if (!verification.success) {
          throw new Error(verification.message || 'فشل التحقق البيومتري');
        }
        verifiedByBiometric = true;
      }

      const record = await attendanceRecordService.checkOut(employeeId, location, deviceId, verifiedByBiometric);
      setTodayAttendance(record);
      return record;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  const requestException = useCallback(async (exception: Omit<AttendanceException, 'id' | 'created_at' | 'updated_at' | 'status' | 'approved_by' | 'approved_at'>) => {
    setLoading(true);
    setError(null);
    try {
      const newException = await attendanceExceptionService.create({
        ...exception,
        status: 'pending'
      });
      setExceptions(prev => [newException, ...prev]);
      return newException;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    todayAttendance,
    attendanceHistory,
    exceptions,
    stats,
    loading,
    error,
    loadTodayAttendance,
    loadAttendanceHistory,
    loadExceptions,
    loadStats,
    checkIn,
    checkOut,
    requestException
  };
}

export function useBiometricVerification() {
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<BiometricVerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const verify = useCallback(async (employeeId: string) => {
    setIsVerifying(true);
    setError(null);
    setResult(null);
    try {
      const verificationResult = await webauthnService.verify(employeeId);
      setResult(verificationResult);
      return verificationResult;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
      throw err;
    } finally {
      setIsVerifying(false);
    }
  }, []);

  return {
    isVerifying,
    result,
    error,
    verify,
    reset: () => {
      setResult(null);
      setError(null);
    }
  };
}
