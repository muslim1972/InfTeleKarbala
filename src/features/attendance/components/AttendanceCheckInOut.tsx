'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAttendance } from '../hooks/useAttendance';
import { geofenceService } from '../services/geofenceService';
import { geolocationManager } from '../../../utils/GeolocationManager';
import type { AttendanceRecord, WorkLocation } from '../types';
import { 
  Fingerprint, LogIn, LogOut, MapPin, ShieldCheck, 
  RefreshCw, AlertTriangle, CheckCircle 
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface AttendanceCheckInOutProps {
  employeeId: string;
  todayAttendance: AttendanceRecord | null;
  loading: boolean;
}

export default function AttendanceCheckInOut({
  employeeId,
  todayAttendance,
  loading
}: AttendanceCheckInOutProps) {
  const { checkIn, checkOut } = useAttendance(employeeId);
  const [useBiometric, setUseBiometric] = useState(true);
  
  // Location and Geofencing State
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [locationText, setLocationText] = useState<string>('');

  
  const [geofenceChecked, setGeofenceChecked] = useState(false);
  const [isAllowed, setIsAllowed] = useState(false);
  const [nearestLoc, setNearestLoc] = useState<WorkLocation | undefined>(undefined);
  const [nearestDistance, setNearestDistance] = useState<number | null>(null);

  // Perform geofence verification
  const verifyLocationAndGeofence = useCallback(async (showToast = false) => {
    setLoadingLocation(true);
    setGeofenceChecked(false);
    try {
      if (showToast) toast.loading('جاري تحديد موقعك الجغرافي...', { id: 'geo-verify' });
      
      const position = await geolocationManager.getCurrentPosition();
      const { latitude, longitude } = position.coords;
      
      // Check if user is within the required geofence
      const geofenceResult = await geofenceService.checkEmployeeGeofence(employeeId, latitude, longitude);
      
      setIsAllowed(geofenceResult.allowed);
      setNearestLoc(geofenceResult.nearestLocation);
      setNearestDistance(geofenceResult.distance ?? null);
      
      const locName = geofenceResult.nearestLocation?.name || 'موقع غير محدد';
      
      if (geofenceResult.allowed) {
        setLocationText(`${latitude.toFixed(6)}, ${longitude.toFixed(6)} - ${locName}`);
        if (showToast) toast.success(`أنت الآن داخل النطاق المسموح لـ: ${locName}`, { id: 'geo-verify' });
      } else {
        setLocationText(`${latitude.toFixed(6)}, ${longitude.toFixed(6)} - خارج النطاق المسموح`);
        if (showToast) toast.error('أنت خارج النطاق الجغرافي المسموح لتسجيل الحضور!', { id: 'geo-verify' });
      }
      
      setGeofenceChecked(true);
    } catch (err: any) {
      console.error('Error fetching position:', err);
      setLocationText('تعذر تحديد الموقع الجغرافي');
      setIsAllowed(false);
      setGeofenceChecked(true);
      if (showToast) toast.error('تعذر تحديد موقعك. يرجى التأكد من تفعيل GPS وإذن الوصول للموقع.', { id: 'geo-verify' });
    } finally {
      setLoadingLocation(false);
    }
  }, [employeeId]);

  // Verify location automatically on load
  useEffect(() => {
    verifyLocationAndGeofence(false);
  }, [verifyLocationAndGeofence]);

  const handleCheckIn = async () => {
    if (!isAllowed) {
      toast.error('لا يمكن تسجيل الحضور: يجب أن تكون متواجداً في نطاق الدائرة (50 متر)');
      return;
    }
    
    try {
      await checkIn(locationText, undefined, useBiometric);
      toast.success('تم تسجيل الحضور بنجاح');
      verifyLocationAndGeofence(false);
    } catch (err: any) {
      toast.error(err.message || 'فشل تسجيل الحضور');
    }
  };

  const handleCheckOut = async () => {
    if (!isAllowed) {
      toast.error('لا يمكن تسجيل الانصراف: يجب أن تكون متواجداً في نطاق الدائرة (50 متر)');
      return;
    }
    
    try {
      await checkOut(locationText, undefined, useBiometric);
      toast.success('تم تسجيل الانصراف بنجاح');
      verifyLocationAndGeofence(false);
    } catch (err: any) {
      toast.error(err.message || 'فشل تسجيل الانصراف');
    }
  };

  const formatTime = (timeString?: string) => {
    if (!timeString) return '--:--';
    return new Date(timeString).toLocaleTimeString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const canCheckIn = !todayAttendance?.check_in;
  const canCheckOut = todayAttendance?.check_in && !todayAttendance?.check_out;

  return (
    <div className="space-y-6">
      {/* Geofence Status Header Card */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl shadow-lg border p-6 flex flex-col md:flex-row items-center justify-between gap-4 transition-colors ${
          loadingLocation 
            ? 'bg-slate-50 border-slate-200 dark:bg-slate-800/40 dark:border-slate-700' 
            : isAllowed
              ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/30'
              : 'bg-rose-50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/30'
        }`}
      >
        <div className="flex items-center gap-4 text-center md:text-right">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            loadingLocation
              ? 'bg-slate-200 text-slate-500 animate-pulse'
              : isAllowed
                ? 'bg-emerald-500 text-white'
                : 'bg-rose-500 text-white'
          }`}>
            {loadingLocation ? (
              <RefreshCw className="w-6 h-6 animate-spin" />
            ) : isAllowed ? (
              <CheckCircle className="w-6 h-6" />
            ) : (
              <AlertTriangle className="w-6 h-6" />
            )}
          </div>
          <div>
            <h3 className="font-bold text-lg leading-tight">
              {loadingLocation 
                ? 'جاري التحقق من موقعك الحالي...' 
                : isAllowed 
                  ? `أنت متواجد داخل: ${nearestLoc?.name || 'موقع العمل'}` 
                  : 'أنت خارج نطاق العمل المسموح'}
            </h3>
            <p className="text-sm mt-1 text-slate-500 dark:text-slate-400">
              {loadingLocation 
                ? 'يرجى الانتظار لحين تحديد الإحداثيات...' 
                : isAllowed
                  ? 'موقعك مطابق لشروط البصمة الجغرافية. يمكنك تسجيل الحضور والانصراف.'
                  : nearestLoc
                    ? `أقرب موقع عمل لك هو "${nearestLoc.name}" ويبعد عنك بمسافة ${nearestDistance && nearestDistance >= 1000 ? (nearestDistance / 1000).toFixed(2) + ' كيلومتر' : nearestDistance + ' متر'}. (النطاق المطلوب: 50 متر)`
                    : 'لم يتم ربطك بأي موقع عمل بعد. يرجى مراجعة المشرف العام.'}
            </p>
          </div>
        </div>

        <button
          onClick={() => verifyLocationAndGeofence(true)}
          disabled={loadingLocation}
          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 font-bold py-2.5 px-4 rounded-xl shadow-sm transition-all flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 text-slate-700 dark:text-slate-300"
        >
          <RefreshCw className={`w-4 h-4 ${loadingLocation ? 'animate-spin' : ''}`} />
          تحديث الموقع الجغرافي
        </button>
      </motion.div>

      {/* Current Status Cards */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.05 }}
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700/50 p-6 md:p-8"
      >
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6 border-b dark:border-slate-700 pb-3">حالة البصمة لليوم</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Check In Status */}
          <div className={`p-6 rounded-2xl border-2 transition-all ${
            todayAttendance?.check_in
              ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/10'
              : 'border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/40'
          }`}>
            <div className="flex items-center gap-3 mb-3">
              <LogIn className={`w-6 h-6 ${
                todayAttendance?.check_in ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-slate-500'
              }`} />
              <span className="font-bold text-gray-800 dark:text-slate-200">وقت الحضور</span>
            </div>
            <div className="text-3xl font-extrabold text-gray-800 dark:text-white font-mono">
              {formatTime(todayAttendance?.check_in)}
            </div>
            {todayAttendance?.check_in_verified_by_biometric && (
              <div className="flex items-center gap-2 mt-3 text-emerald-600 dark:text-emerald-400 text-sm font-bold">
                <ShieldCheck className="w-5 h-5" />
                <span>تم التحقق بيوميترياً بنجاح</span>
              </div>
            )}
          </div>

          {/* Check Out Status */}
          <div className={`p-6 rounded-2xl border-2 transition-all ${
            todayAttendance?.check_out
              ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/10'
              : 'border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/40'
          }`}>
            <div className="flex items-center gap-3 mb-3">
              <LogOut className={`w-6 h-6 ${
                todayAttendance?.check_out ? 'text-teal-600 dark:text-teal-400' : 'text-gray-400 dark:text-slate-500'
              }`} />
              <span className="font-bold text-gray-800 dark:text-slate-200">وقت الانصراف</span>
            </div>
            <div className="text-3xl font-extrabold text-gray-800 dark:text-white font-mono">
              {formatTime(todayAttendance?.check_out)}
            </div>
            {todayAttendance?.check_out_verified_by_biometric && (
              <div className="flex items-center gap-2 mt-3 text-teal-600 dark:text-teal-400 text-sm font-bold">
                <ShieldCheck className="w-5 h-5" />
                <span>تم التحقق بيوميترياً بنجاح</span>
              </div>
            )}
          </div>
        </div>

        {/* Location if available */}
        {todayAttendance?.check_in_location && (
          <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl">
            <div className="flex items-start gap-2.5 text-slate-600 dark:text-slate-400">
              <MapPin className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm text-slate-800 dark:text-slate-300">موقع تسجيل الحضور المعين:</p>
                <p className="text-xs font-mono font-bold mt-1 text-slate-600 dark:text-slate-400">{todayAttendance.check_in_location}</p>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Actions Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700/50 p-6 md:p-8"
      >
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6 border-b dark:border-slate-700 pb-3">البصمة والمصادقة الحيوية</h2>

        {/* Biometric Toggle */}
        <div className="flex items-center justify-between mb-6 p-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl">
          <div className="flex items-center gap-3">
            <Fingerprint className="w-8 h-8 text-blue-500" />
            <div>
              <div className="font-bold text-gray-800 dark:text-white text-sm md:text-base">استخدام البصمة البيومترية للأمان</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">التحقق بواسطة بصمة الإصبع أو التعرف على الوجه المدمج بجهازك</div>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={useBiometric}
              onChange={(e) => setUseBiometric(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-14 h-7 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-500"></div>
          </label>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={handleCheckIn}
            disabled={!canCheckIn || loading || loadingLocation || !geofenceChecked || !isAllowed}
            className={`py-4 px-6 rounded-2xl font-bold text-white transition-all duration-300 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] ${
              canCheckIn && isAllowed
                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-md hover:shadow-lg shadow-emerald-600/20'
                : 'bg-slate-300 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
            }`}
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>جاري تسجيل الحضور...</span>
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                <span>تسجيل الحضور</span>
              </>
            )}
          </button>

          <button
            onClick={handleCheckOut}
            disabled={!canCheckOut || loading || loadingLocation || !geofenceChecked || !isAllowed}
            className={`py-4 px-6 rounded-2xl font-bold text-white transition-all duration-300 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] ${
              canCheckOut && isAllowed
                ? 'bg-teal-600 hover:bg-teal-700 shadow-md hover:shadow-lg shadow-teal-600/20'
                : 'bg-slate-300 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
            }`}
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>جاري تسجيل الانصراف...</span>
              </>
            ) : (
              <>
                <LogOut className="w-5 h-5" />
                <span>تسجيل الانصراف</span>
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
