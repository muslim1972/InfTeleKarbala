import { useState, useEffect, useCallback } from 'react';
import { 
  getServerNow, 
  getServerLocalDateStr, 
  checkClockTampering, 
  syncServerTime, 
  subscribeServerTime,
  type ClockTamperingResult 
} from '../services/serverTimeService';

export function useServerTime() {
  const [tamperState, setTamperState] = useState<ClockTamperingResult>(() => checkClockTampering());
  const [currentDateStr, setCurrentDateStr] = useState<string>(() => getServerLocalDateStr());

  const updateStatus = useCallback(() => {
    setTamperState(checkClockTampering());
    setCurrentDateStr(getServerLocalDateStr());
  }, []);

  useEffect(() => {
    // تحديث عند أي مزامنة جديدة
    const unsubscribe = subscribeServerTime(updateStatus);

    // فحص دوري كل 15 ثانية لتحديث التاريخ وفحص التلاعب
    const interval = window.setInterval(updateStatus, 15000);

    return () => {
      unsubscribe();
      window.clearInterval(interval);
    };
  }, [updateStatus]);

  const forceSync = useCallback(async () => {
    const success = await syncServerTime(true);
    updateStatus();
    return success;
  }, [updateStatus]);

  return {
    getServerNow,
    currentDateStr,
    isTampered: tamperState.isTampered,
    tamperInfo: tamperState,
    forceSync
  };
}
