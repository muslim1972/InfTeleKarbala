import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { workLocationService } from '../services/workLocationService';
import type { WorkLocation } from '../types';
import {
  MapPin, Users, Plus, Search, Calendar,
  MapPinned, UserPlus, UserMinus,
  Check, X, Navigation, ShieldCheck, AlertTriangle, Edit2, Save,
  Activity, FileSpreadsheet, Smartphone,
  RefreshCw, Clock, AlertCircle, Tablet, Menu
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../../context/AuthContext';
import { useGovernorate } from '../../../context/GovernorateContext';
import { isDeveloperLevel } from '../../../utils/permissions';

import WorkSchedulesTab from './WorkSchedulesTab';
import WorkHoursModificationTab from './WorkHoursModificationTab';
import LiveAttendanceBoard from './LiveAttendanceBoard';
import Timesheets from './Timesheets';
import HolidaysTab from './HolidaysTab';
import WorkLocationCard from './WorkLocationCard';
import { EmployeeSearch } from '../../../components/shared/EmployeeSearch';
import EmployeeRosterModal from './EmployeeRosterModal';
import { rosterReminderService } from '../services/rosterReminderService';
import { KioskAdminPanel } from '../../kiosk/KioskAdminPanel';

type Tab = 'locations' | 'assignments' | 'deviceLogs' | 'deviceRequests' | 'workSchedules' | 'workHoursModification' | 'liveBoard' | 'timesheets' | 'holidays' | 'kiosks';

export default function AttendanceAdminSettings() {
  const { user } = useAuth();
  const { activeGovernorate } = useGovernorate();
  const isHighAdmin = isDeveloperLevel(user?.admin_role) || user?.admin_role === 'general';
  const isAttendanceAdmin = isHighAdmin || user?.admin_role === 'biometric' || user?.admin_role === 'attendance_supervisor' || user?.has_attendance_access === true || user?.username === 'attend';
  const canManageDevices = user?.admin_role === 'general' || user?.admin_role === 'biometric';
  const canManageKiosks = isHighAdmin || user?.admin_role === 'biometric' || user?.has_kiosk_access === true;
  
  const [activeTab, setActiveTab] = useState<Tab>('liveBoard');
  const [isSubTabsMenuOpen, setIsSubTabsMenuOpen] = useState(false);
  const [locations, setLocations] = useState<WorkLocation[]>([]);
  const [loading, setLoading] = useState(false);

  // Locations Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [locName, setLocName] = useState('');
  const [locLat, setLocLat] = useState<number>(32.616); // default Karbala approx
  const [locLng, setLocLng] = useState<number>(44.025);
  const [locRadius, setLocRadius] = useState<number>(50);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  // Assignments State
  const [selectedLocId, setSelectedLocId] = useState<string>('');
  const [locFilterSearch, setLocFilterSearch] = useState<string>('');
  const [assignedEmployees, setAssignedEmployees] = useState<any[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [, setSearchResults] = useState<any[]>([]);
  const [selectedScheduleId] = useState<string>('');
  const [rosterEmployee, setRosterEmployee] = useState<any | null>(null);
  const [highlightedEmpId, setHighlightedEmpId] = useState<string | null>(null);

  // فلترة المواقع والتحسس الذكي لنوع الشاشة (موبايل: 3 بطاقات / كمبيوتر وتابلت: 6 بطاقات)
  const [workLocQuery, setWorkLocQuery] = useState('');
  const [isMobileScreen, setIsMobileScreen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobileScreen(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const filteredLocations = locations.filter((loc) =>
    loc.name.toLowerCase().includes(workLocQuery.trim().toLowerCase())
  );
  const maxCardsToShow = isMobileScreen ? 3 : 6;
  const displayedLocations = filteredLocations.slice(0, maxCardsToShow);

  const handleSelectGlobalEmployee = async (emp: any) => {
    try {
      setLocFilterSearch('');
      const locId = await workLocationService.getEmployeeLocation(emp.id);
      if (locId) {
        setSelectedLocId(locId);
        setHighlightedEmpId(emp.id);
        const loc = locations.find(l => l.id === locId);
        toast.success(`تم الانتقال إلى: ${loc?.name || 'موقع العمل'} وتحديد الموظف (${emp.full_name})`);

        // Smooth scroll to the location button in the list
        const locBtn = document.getElementById(`loc-btn-${locId}`);
        if (locBtn) {
          locBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      } else {
        toast((t) => (
          <div className="text-xs space-y-1">
            <p className="font-bold">الموظف ({emp.full_name}) غير مرتبط بأي موقع حالياً.</p>
            {selectedLocId ? (
              <button
                onClick={async () => {
                  toast.dismiss(t.id);
                  await handleAssignEmployee(emp.id);
                }}
                className="mt-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs"
              >
                ربطه بموقع ({locations.find(l => l.id === selectedLocId)?.name})
              </button>
            ) : (
              <p className="text-slate-400">اختر موقع عمل أولاً لربطه به.</p>
            )}
          </div>
        ), { duration: 6000 });
      }
    } catch (err: any) {
      toast.error('حدث خطأ أثناء البحث: ' + err.message);
    }
  };




  // Device Logs State
  const [deviceLogs, setDeviceLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [deviceLogsSearch, setDeviceLogsSearch] = useState('');
  const [deviceLogsStatusFilter, setDeviceLogsStatusFilter] = useState<'all' | 'approved' | 'pending' | 'rejected'>('all');

  // Device Requests State
  const [deviceRequests, setDeviceRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Work Schedules State
  const [workSchedules, setWorkSchedules] = useState<any[]>([]);

  // Load Locations on mount & listen for tab switch events
  useEffect(() => {
    loadLocations();
    loadWorkSchedules();
    rosterReminderService.checkAndSendRosterReminders().catch(console.error);

    const pendingSubTab = sessionStorage.getItem('attendance_pending_subtab');
    if (pendingSubTab) {
      sessionStorage.removeItem('attendance_pending_subtab');
      setActiveTab(pendingSubTab as Tab);
    }

    const handleSwitchSubtab = (e: any) => {
      if (e.detail?.subTab) {
        setActiveTab(e.detail.subTab);
      }
    };
    window.addEventListener('switch_attendance_subtab', handleSwitchSubtab);
    return () => window.removeEventListener('switch_attendance_subtab', handleSwitchSubtab);
  }, []);

  const loadWorkSchedules = async () => {
    try {
      const { data } = await supabase
        .from('work_schedules')
        .select('id, name, type, is_default, valid_from, valid_until')
        .order('is_default', { ascending: false });
      setWorkSchedules(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  // Processing Auto Attendance State
  const [processingRecord, setProcessingRecord] = useState<any>(null);
  const [adminAction, setAdminAction] = useState<'accept' | 'absent' | 'vacation' | 'late'>('accept');
  const [adminNotes, setAdminNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Inline Editing State
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [editDutyType, setEditDutyType] = useState<'morning' | 'roster'>('morning');
  const [editScheduleId, setEditScheduleId] = useState<string>('');

  const handleUpdateShift = async (employeeId: string) => {
    if (!selectedLocId) return;
    try {
      let targetScheduleId: string | null = null;
      if (editDutyType === 'morning') {
        const defaultSch = workSchedules.find(s => s.is_default) || workSchedules.find(s => s.name?.includes('صباحي'));
        targetScheduleId = defaultSch?.id || null;
      } else {
        // Duty type is 'roster' - find current employee & roster schedule
        const currentEmp = assignedEmployees.find(ae => ae.employee_id === employeeId);
        const currentSchedId = editScheduleId || currentEmp?.employee?.work_schedule_id;
        const currentSched = currentEmp?.employee?.work_schedule || workSchedules.find(s => s.id === currentSchedId);

        if (currentSched?.type === 'roster' || currentSchedId) {
          targetScheduleId = currentSchedId;
        } else {
          // Look for an existing roster schedule by employee name
          const existingRoster = workSchedules.find(s => s.type === 'roster' && s.name?.includes(currentEmp?.employee?.full_name));
          if (existingRoster) {
            targetScheduleId = existingRoster.id;
          } else {
            toast.error('يرجى تحديد جدول المناوبة للموظف أولاً');
            setRosterEmployee({
              ...(currentEmp?.employee || {}),
              id: employeeId
            });
            return;
          }
        }
      }

      await workLocationService.updateEmployeeSchedule(employeeId, targetScheduleId);
      toast.success('تم تحديث نوع دوام الموظف بنجاح');
      setEditingEmployeeId(null);
      await loadWorkSchedules();
      await loadAssignments(selectedLocId);
    } catch (err: any) {
      toast.error('فشل تحديث الدوام: ' + err.message);
    }
  };

  // Fetch Locations
  const loadLocations = async () => {
    setLoading(true);
    try {
      const data = await workLocationService.getAllLocations();
      setLocations(data);
      if (data.length > 0 && !selectedLocId) {
        const filtered = data.filter(l => l.is_active && (!activeGovernorate || activeGovernorate === 'all' || l.governorate === activeGovernorate));
        if (filtered.length > 0) {
          setSelectedLocId(filtered[0].id);
        } else {
          setSelectedLocId(data[0].id);
        }
      }
    } catch (err: any) {
      toast.error('فشل تحميل مواقع العمل: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Assignments loading
  const loadAssignments = async (locationId: string) => {
    try {
      const data = await workLocationService.getAssignedEmployees(locationId);
      setAssignedEmployees(data);
    } catch (err: any) {
      toast.error('فشل تحميل الموظفين: ' + err.message);
    }
  };

  useEffect(() => {
    if (activeTab === 'assignments' && selectedLocId) {
      loadAssignments(selectedLocId);
    }
  }, [activeTab, selectedLocId]);

  // Employee search
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (employeeSearch.trim().length > 1) {
        try {
          const results = await workLocationService.searchEmployees(employeeSearch, activeGovernorate);
          // filter out already assigned
          const assignedIds = new Set(assignedEmployees.map(ae => ae.employee_id));
          const filtered = results.filter(r => !assignedIds.has(r.id));
          setSearchResults(filtered);
        } catch (err) {
          console.error(err);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [employeeSearch, assignedEmployees]);

  // Helper to parse device info
  const parseDeviceDetails = (deviceStr: string | null | undefined) => {
    if (!deviceStr) return { label: 'جهاز غير محدد', hash: '', type: 'غير محدد', os: '' };
    const hashMatch = deviceStr.match(/\[([a-f0-9]{32,64})\]/i);
    const hash = hashMatch ? hashMatch[1] : '';
    const label = deviceStr.replace(/\[[a-f0-9]{32,64}\]/gi, '').trim() || deviceStr;
    
    let type = 'كمبيوتر شخصي';
    let os = 'Windows';
    if (/android/i.test(label)) {
      type = 'هاتف أندرويد';
      os = 'Android';
    } else if (/iphone|ipad|ios/i.test(label)) {
      type = /ipad/i.test(label) ? 'جهاز iPad' : 'هاتف iPhone';
      os = 'iOS';
    } else if (/mac|macintosh/i.test(label)) {
      type = 'كمبيوتر أبل (Mac)';
      os = 'macOS';
    } else if (/linux/i.test(label)) {
      type = 'جهاز لينوكس';
      os = 'Linux';
    } else if (/windows/i.test(label)) {
      type = 'كمبيوتر شخصي';
      os = 'Windows';
    }
    
    return { label, hash, type, os };
  };

  // Load Device Logs from device_change_requests
  const loadDeviceLogs = async () => {
    setLoadingLogs(true);
    try {
      let query = supabase
        .from('device_change_requests')
        .select(`
          id,
          employee_id,
          old_device_id,
          new_device_id,
          status,
          created_at,
          updated_at,
          profiles!inner(full_name, job_number, primary_device_id, governorate)
        `)
        .order('created_at', { ascending: false });

      if (user?.admin_role !== 'developer' && user?.governorate) {
        query = query.eq('profiles.governorate', user.governorate);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      setDeviceLogs(data || []);
    } catch (err: any) {
      toast.error('فشل تحميل سجل الأجهزة: ' + err.message);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleRevokeDevice = async (req: any) => {
    if (!canManageDevices) {
      toast.error('صلاحية إلغاء توثيق الأجهزة مقتصرة على المشرف العام ومشرف البصمة فقط');
      return;
    }
    const empName = req.profiles?.full_name || 'الموظف';
    if (!window.confirm(`هل أنت متأكد من إلغاء توثيق هذا الجهاز للموظف (${empName})؟ سيتطلب منه ذلك طلب اعتماد جهازه مجدداً عند تسجيل البصمة القادمة.`)) {
      return;
    }
    try {
      // 1. Reset primary_device_id in profiles if it matches
      const { data: prof } = await supabase.from('profiles').select('primary_device_id').eq('id', req.employee_id).single();
      const currentReqHash = (req.new_device_id || '').match(/\[([a-f0-9\-]{16,64})\]/i)?.[1] || req.new_device_id;
      const profHash = (prof?.primary_device_id || '').match(/\[([a-f0-9\-]{16,64})\]/i)?.[1] || prof?.primary_device_id;

      if (!prof?.primary_device_id || (profHash && profHash.toLowerCase() === currentReqHash.toLowerCase())) {
        await supabase.from('profiles').update({ primary_device_id: null }).eq('id', req.employee_id);
      }

      // 2. Update device_change_requests status to rejected
      await supabase.from('device_change_requests').update({ status: 'rejected' }).eq('id', req.id);

      // 3. Mark today's attendance record as pending if exists
      const { data: recs } = await supabase
        .from('attendance_records')
        .select('id, notes')
        .eq('employee_id', req.employee_id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (recs && recs.length > 0) {
        await supabase.from('attendance_records').update({ is_device_pending: true }).eq('id', recs[0].id);
      }

      // 4. Send notification
      await supabase.from('system_notifications').insert({
        recipient_id: req.employee_id,
        type: 'system',
        title: 'تم إلغاء توثيق جهازك',
        content: 'قام المشرف بإلغاء توثيق جهازك الحالي لتسجيل البصمة. يرجى توثيق الجهاز مجدداً عند الحضور القادم.',
      });

      toast.success(`تم إلغاء توثيق الجهاز للموظف (${empName}) بنجاح`);
      loadDeviceLogs();
      loadDeviceRequests();
    } catch (err: any) {
      toast.error('حدث خطأ أثناء إلغاء توثيق الجهاز: ' + err.message);
    }
  };

  // Load Device Requests
  const loadDeviceRequests = async () => {
    setLoadingRequests(true);
    try {
      let query = supabase
        .from('device_change_requests')
        .select(`
          id,
          employee_id,
          old_device_id,
          new_device_id,
          status,
          created_at,
          profiles!inner ( full_name, job_number, primary_device_id, role, admin_role, governorate )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (user?.governorate) {
        query = query.eq('profiles.governorate', user.governorate);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      setDeviceRequests(data || []);
    } catch (err: any) {
      toast.error('فشل تحميل الطلبات: ' + err.message);
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleApproveDevice = async (req: any) => {
    if (!canManageDevices) {
      toast.error('صلاحية اعتماد الأجهزة مقتصرة على المشرف العام ومشرف البصمة فقط');
      return;
    }
    try {
      const { data, error } = await supabase.rpc('settle_device_change_request', {
        p_request_id: req.id,
        p_action: 'approve',
        p_admin_id: user?.id
      });

      if (error) throw error;
      if (data && !data.success) {
        toast.error(data.message || 'تعذر اعتماد الجهاز');
        loadDeviceRequests();
        loadDeviceLogs();
        return;
      }
      
      toast.success('تم اعتماد الجهاز بنجاح');
      loadDeviceRequests();
      loadDeviceLogs();
    } catch (err: any) {
      toast.error('حدث خطأ أثناء اعتماد الجهاز: ' + err.message);
    }
  };

  const handleRejectDevice = async (req: any) => {
    if (!canManageDevices) {
      toast.error('صلاحية رفض الأجهزة مقتصرة على المشرف العام ومشرف البصمة فقط');
      return;
    }
    try {
      const { data, error } = await supabase.rpc('settle_device_change_request', {
        p_request_id: req.id,
        p_action: 'reject',
        p_admin_id: user?.id
      });

      if (error) throw error;
      if (data && !data.success) {
        toast.error(data.message || 'تعذر رفض الجهاز');
        loadDeviceRequests();
        loadDeviceLogs();
        return;
      }
      
      toast.success('تم رفض الجهاز وحذف البصمة المعلقة');
      loadDeviceRequests();
      loadDeviceLogs();
    } catch (err: any) {
      toast.error('حدث خطأ أثناء رفض الجهاز: ' + err.message);
    }
  };

  const handleReviewDevice = async (req: any) => {
    if (!canManageDevices) {
      toast.error('صلاحية مراجعة الأجهزة مقتصرة على المشرف العام ومشرف البصمة فقط');
      return;
    }
    try {
      // Notify the employee
      await supabase.from('system_notifications').insert({
        recipient_id: req.employee_id,
        type: 'system',
        title: 'مراجعة الإدارة بخصوص توثيق الجهاز',
        content: 'لطفا ... تنسب مراجعة السيد معاون مدير المديرية . في هذا اليوم لأتمام الاجراء بشكل اصولي',
      });
      
      toast.success('تم إرسال إشعار للموظف للمراجعة، وبقي الطلب معلقاً');
    } catch (err: any) {
      toast.error('حدث خطأ أثناء الإرسال: ' + err.message);
    }
  };

  useEffect(() => {
    if (activeTab === 'deviceLogs') {
      loadDeviceLogs();
    } else if (activeTab === 'deviceRequests') {
      loadDeviceRequests();
    }
  }, [activeTab]);

  // Realtime subscription for device requests so actions reflect immediately across all supervisors
  useEffect(() => {
    const channel = supabase
      .channel('realtime_device_requests_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'device_change_requests' },
        () => {
          if (activeTab === 'deviceRequests') {
            loadDeviceRequests();
          } else if (activeTab === 'deviceLogs') {
            loadDeviceLogs();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab]);

  // Handle get current coordinates
  const handleGetCurrentLocation = () => {
    setIsGettingLocation(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocLat(position.coords.latitude);
          setLocLng(position.coords.longitude);
          setIsGettingLocation(false);
          toast.success('تم جلب إحداثياتك الحالية بنجاح');
        },
        () => {
          setIsGettingLocation(false);
          toast.error('فشل جلب الموقع الحالي. يرجى تفعيل الـ GPS وإعطاء الإذن للمتصفح.');
        },
        { enableHighAccuracy: true }
      );
    } else {
      setIsGettingLocation(false);
      toast.error('الموقع الجغرافي غير مدعوم في متصفحك');
    }
  };

  /**
   * نسخة وعد-قابلة (Promise) من جلب الإحداثيات، تستهلكها بطاقة الموقع.
   * ترمي استثناءً عند الفشل حتى تعرض البطاقة رسالة صريحة بدل زر ميت.
   */
  const fetchCurrentCoordinates = (): Promise<{ latitude: number; longitude: number }> => {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        reject(new Error('الموقع الجغرافي غير مدعوم في متصفحك.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            reject(new Error('تم رفض إذن الوصول للموقع. فعّل إذن GPS للمتصفح ثم أعد المحاولة.'));
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            reject(new Error('تعذّر تحديد موقعك حالياً. تأكد من تشغيل GPS ثم أعد المحاولة.'));
          } else if (err.code === err.TIMEOUT) {
            reject(new Error('انتهت مهلة تحديد الموقع. حاول في مكان مكشوف.'));
          } else {
            reject(new Error('فشل جلب الموقع الحالي. يرجى تفعيل الـ GPS وإعطاء الإذن للمتصفح.'));
          }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  };

  // Add or update Location
  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locName.trim()) {
      toast.error('يرجى إدخال اسم الموقع');
      return;
    }

    try {
      // عزل المحافظات: بلا محافظة نشطة محددة = رفض (fail-closed)
      if (!activeGovernorate || activeGovernorate === 'all') {
        toast.error('اختر محافظة محددة أولاً من مبدل المحافظات');
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      const locationData = {
        name: locName,
        latitude: locLat,
        longitude: locLng,
        radius_meters: locRadius,
        is_active: true,
        created_by: user?.id,
        governorate: activeGovernorate
      };

      if (editingLocationId) {
        await workLocationService.updateLocation(editingLocationId, locationData);
        toast.success('تم تعديل موقع العمل بنجاح');
      } else {
        await workLocationService.createLocation(locationData);
        toast.success('تم إضافة موقع العمل بنجاح');
      }

      setLocName('');
      setEditingLocationId(null);
      setShowAddForm(false);
      loadLocations();
    } catch (err: any) {
      toast.error('حدث خطأ أثناء الحفظ: ' + err.message);
    }
  };

  const handleEditLocation = (loc: WorkLocation) => {
    setEditingLocationId(loc.id);
    setLocName(loc.name);
    setLocLat(loc.latitude);
    setLocLng(loc.longitude);
    setLocRadius(loc.radius_meters);
    setShowAddForm(false);
  };

  /**
   * حفظ تعديلات بطاقة الموقع في وضع التحرير المدمج (نفس البطاقة).
   * يرسل الحقول المعدَّلة فقط — لا يعيد إرسال created_by/governorate من العميل.
   */
  const handleInlineSaveLocation = async (
    loc: WorkLocation,
    patch: Partial<WorkLocation>
  ): Promise<void> => {
    // عزل المحافظات: بلا محافظة نشطة محددة = رفض (fail-closed)
    if (!activeGovernorate || activeGovernorate === 'all') {
      throw new Error('اختر محافظة محددة أولاً من مبدل المحافظات');
    }

    const payload: Partial<WorkLocation> = {
      radius_meters: patch.radius_meters,
      latitude: patch.latitude,
      longitude: patch.longitude,
    };

    // اسم الموقع قابل للتعديل أيضاً — نحدّثه إن تغيّر
    if (locName.trim() && locName.trim() !== loc.name) {
      payload.name = locName.trim();
    }

    await workLocationService.updateLocation(loc.id, payload);
    setEditingLocationId(null);
    setShowAddForm(false);
    setLocName('');
    toast.success('تم تعديل موقع العمل بنجاح');
    loadLocations();
  };

  const handleDeleteLocation = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف موقع العمل هذا؟ سيتم إزالة جميع الموظفين المرتبطين به.')) return;
    try {
      await workLocationService.deleteLocation(id);
      toast.success('تم حذف الموقع بنجاح');
      loadLocations();
    } catch (err: any) {
      toast.error('فشل حذف الموقع: ' + err.message);
    }
  };

  const handleToggleLocationActive = async (id: string, currentStatus: boolean) => {
    try {
      await workLocationService.toggleLocationActive(id, !currentStatus);
      toast.success(currentStatus ? 'تم تعطيل الموقع' : 'تم تفعيل الموقع');
      loadLocations();
    } catch (err: any) {
      toast.error('فشل تعديل حالة الموقع: ' + err.message);
    }
  };

  const [errorModal, setErrorModal] = useState<{ show: boolean, title: string, message: string }>({ show: false, title: '', message: '' });

  // Assign Employee
  const handleAssignEmployee = async (employeeId: string) => {
    if (!selectedLocId) return;
    try {
      await workLocationService.assignEmployee(selectedLocId, employeeId, selectedScheduleId || null);
      toast.success('تم ربط الموظف بالموقع بنجاح');
      setEmployeeSearch('');
      setSearchResults([]);
      loadAssignments(selectedLocId);
    } catch (err: any) {
      const msg = err.message || 'خطأ غير معروف';
      
      // Log to database
      import('../../../lib/errorLogger').then(({ logSystemError }) => {
         logSystemError(`فشل ربط الموظف بموقع العمل (${employeeId} -> ${selectedLocId})`, err.stack || err.toString(), { error: err });
      });

      // Show prominent modal
      setErrorModal({
         show: true,
         title: 'فشل ربط الموظف',
         message: msg
      });
    }
  };

  // Remove Employee
  const handleRemoveEmployee = async (employeeId: string) => {
    if (!selectedLocId) return;
    if (!window.confirm('هل أنت متأكد من فك ارتباط الموظف بموقع العمل هذا؟')) return;
    try {
      await workLocationService.removeEmployee(selectedLocId, employeeId);
      toast.success('تم إلغاء ربط الموظف بنجاح');
      loadAssignments(selectedLocId);
    } catch (err: any) {
      toast.error('فشل إلغاء ربط الموظف: ' + err.message);
    }
  };

  const handleProcessAutoAttendance = async () => {
    if (!processingRecord) return;
    setIsProcessing(true);
    try {
      let newStatus = processingRecord.status;
      if (adminAction === 'absent') newStatus = 'absent';
      if (adminAction === 'vacation') newStatus = 'vacation'; 
      if (adminAction === 'late') newStatus = 'late';
      
      const { error } = await supabase
        .from('attendance_records')
        .update({
          status: newStatus,
          admin_notes: adminNotes,
          is_auto_check_in: false, 
          is_auto_check_out: false
        })
        .eq('id', processingRecord.id);

      if (error) throw error;
      toast.success('تمت المعالجة بنجاح');
      setProcessingRecord(null);
    } catch (err: any) {
      toast.error('حدث خطأ أثناء المعالجة: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full text-slate-900 dark:text-white transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-1 sm:px-4 pt-0 pb-4">
        
        {/* Print Stylesheet */}
        <style>{`
          @media print {
            body * { visibility: hidden; background: white !important; color: black !important; }
            .print-area, .print-area * { visibility: visible; }
            .print-area { position: absolute; left: 0; top: 0; width: 100%; }
            .no-print { display: none !important; }
            table { border-collapse: collapse; width: 100%; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 12px 8px; text-align: right; font-size: 14px; }
            th { background-color: #f2f2f2 !important; font-weight: bold; }
          }
        `}</style>

        {/* =========================================================================
            ATTENDANCE SUB-TABS: Floating 3-lines Menu & Header Bar (Requested by User)
            ========================================================================= */}
        {(() => {
          const attendanceSubTabs = [
            { id: 'liveBoard' as Tab, label: 'اللوحة الحية (الموقف المباشر والأرشيفي)', icon: Activity, show: isAttendanceAdmin },
            { id: 'timesheets' as Tab, label: 'التقارير المتقدمة (Timesheets)', icon: FileSpreadsheet, show: isAttendanceAdmin },
            { id: 'locations' as Tab, label: 'إدارة مواقع العمل', icon: MapPinned, show: true },
            { id: 'assignments' as Tab, label: 'ربط الموظفين بالمواقع', icon: UserPlus, show: true },
            { id: 'deviceLogs' as Tab, label: 'سجل توثيق الأجهزة', icon: ShieldCheck, show: true },
            { id: 'deviceRequests' as Tab, label: 'طلبات تغيير الأجهزة', icon: AlertTriangle, show: true, badge: deviceRequests.length },
            { id: 'workSchedules' as Tab, label: 'جداول العمل', icon: Calendar, show: true },
            { id: 'workHoursModification' as Tab, label: 'تعديل ساعات الدوام', icon: Clock, show: true },
            { id: 'holidays' as Tab, label: 'إعدادات العطل', icon: Calendar, show: true },
            { id: 'kiosks' as Tab, label: 'البصمة البايومترية العامة', icon: Tablet, show: canManageKiosks },
          ].filter(t => t.show);

          const currentTabInfo = attendanceSubTabs.find(t => t.id === activeTab) || attendanceSubTabs[0];
          const CurrentTabIcon = currentTabInfo?.icon || Activity;

          return (
            <>
              {/* Compact Header Bar with 3-Lines Button */}
              <div className="flex items-center justify-between gap-2.5 mb-3 p-2 sm:p-2.5 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md rounded-2xl border border-slate-200/90 dark:border-slate-700/80 shadow-xs no-print">
                {/* 3-lines Menu Button */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSubTabsMenuOpen(true)}
                    className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-xl shadow-sm shadow-blue-500/25 transition-all transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                    title="فتح قائمة أقسام إدارة البصمة"
                  >
                    <Menu className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                    <span className="text-xs sm:text-sm font-bold">أقسام إدارة البصمة</span>
                  </button>

                  {/* Active tab badge / indicator */}
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60 rounded-xl">
                    <CurrentTabIcon className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span className="text-xs sm:text-sm font-bold text-blue-700 dark:text-blue-300">
                      {currentTabInfo?.label}
                    </span>
                  </div>
                </div>

                {/* Device Requests Alert Quick Badge */}
                {deviceRequests.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('deviceRequests')}
                    className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300 px-3 py-1.5 rounded-xl border border-amber-300/80 dark:border-amber-700 transition-colors animate-pulse cursor-pointer"
                    title="يوجد طلبات تغيير أجهزة جديدة بحاجة للمراجعة"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>{deviceRequests.length} طلبات</span>
                  </button>
                )}
              </div>

              {/* Floating Dropdown Drawer Modal for Sub-Tabs */}
              <AnimatePresence>
                {isSubTabsMenuOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print">
                    {/* Backdrop */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setIsSubTabsMenuOpen(false)}
                      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
                    />

                    {/* Modal Dialog Content */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 15 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 15 }}
                      transition={{ duration: 0.2 }}
                      className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-10 max-h-[85vh] flex flex-col"
                    >
                      {/* Modal Header */}
                      <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-50 to-blue-50/40 dark:from-slate-800/80 dark:to-slate-800/40">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
                            <Menu className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-base text-slate-800 dark:text-white">أقسام إدارة البصمة</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">اختر القسم المطلوب للانتقال إليه</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsSubTabsMenuOpen(false)}
                          className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                          title="إغلاق"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Sub-Tabs List */}
                      <div className="p-3 sm:p-4 overflow-y-auto space-y-1.5 custom-scrollbar">
                        {attendanceSubTabs.map((tab, idx) => {
                          const Icon = tab.icon;
                          const isActive = activeTab === tab.id;
                          return (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => {
                                setActiveTab(tab.id);
                                setIsSubTabsMenuOpen(false);
                              }}
                              className={`w-full flex items-center justify-between p-3 rounded-2xl text-right transition-all cursor-pointer ${
                                isActive
                                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 font-bold'
                                  : 'bg-slate-50/80 dark:bg-slate-800/60 hover:bg-blue-50/70 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-700/60'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl transition-colors ${
                                  isActive
                                    ? 'bg-white/20 text-white'
                                    : 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs'
                                }`}>
                                  <Icon className="w-4 h-4" />
                                </div>
                                <div className="flex flex-col text-right">
                                  <span className="text-sm">{tab.label}</span>
                                  <span className={`text-[10px] ${isActive ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'}`}>
                                    القسم رقم {idx + 1}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                {tab.badge && tab.badge > 0 ? (
                                  <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold shadow-xs">
                                    {tab.badge}
                                  </span>
                                ) : null}
                                {isActive && (
                                  <span className="text-xs bg-white/25 px-2 py-0.5 rounded-full text-white font-medium">النشط</span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </>
          );
        })()}

        {/* Loading Spinner */}
        {loading && (
          <div className="flex justify-center items-center py-12 no-print">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {/* =========================================================================
            TAB 1: MANAGING WORK LOCATIONS (redesigned — compact cards + live search)
            ========================================================================= */}
        {!loading && activeTab === 'locations' && (
          <div className="space-y-4 no-print">
{/* Search + Add button in one line with live interactive filter */}
            <div className="flex gap-2 items-center">
              <div className="relative flex-1 min-w-0">
                <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={workLocQuery}
                  onChange={(e) => setWorkLocQuery(e.target.value)}
                  placeholder="ابحث عن موقع عمل..."
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pr-9 pl-8 py-2 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all"
                />
                {workLocQuery && (
                  <button
                    type="button"
                    onClick={() => setWorkLocQuery('')}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                    title="مسح البحث"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>



              <button
                onClick={() => {
                  setEditingLocationId(null);
                  setShowAddForm(prev => !prev);
                  if (showAddForm) {
                    setLocName('');
                  }
                }}
                className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-2.5 sm:px-4 rounded-xl shadow-md transition-all flex items-center gap-1.5 hover:scale-[1.02] active:scale-[0.98] text-xs sm:text-sm whitespace-nowrap"
                title="إضافة موقع عمل جديد"
              >
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="sm:hidden">إضافة موقع</span>
                <span className="hidden sm:inline">إضافة موقع عمل</span>
              </button>
            </div>

            {/* Add Location Form (compact — shown only when adding a new location) */}
            {showAddForm && !editingLocationId && (
              <form onSubmit={handleSaveLocation} className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700/50 p-5 max-w-2xl mx-auto space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                <h3 className="text-base font-bold border-b border-slate-100 dark:border-slate-700 pb-2">
                  إضافة موقع عمل جديد
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400">اسم الموقع</label>
                    <input
                      type="text"
                      required
                      value={locName}
                      onChange={(e) => setLocName(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold"
                      placeholder="مثال: المبنى الرئيسي"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400">نصف القطر (متر)</label>
                    <input
                      type="number"
                      required
                      min={10}
                      max={1000}
                      value={locRadius}
                      onChange={(e) => setLocRadius(Number(e.target.value))}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400">خط العرض</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={locLat}
                      onChange={(e) => setLocLat(Number(e.target.value))}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold font-mono"
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400">خط الطول</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={locLng}
                      onChange={(e) => setLocLng(Number(e.target.value))}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold font-mono"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={handleGetCurrentLocation}
                    disabled={isGettingLocation}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                  >
                    <Navigation className="w-4 h-4 animate-pulse" />
                    {isGettingLocation ? 'جارٍ الجلب...' : 'جلب إحداثياتي'}
                  </button>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddForm(false);
                        setLocName('');
                      }}
                      className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 font-bold py-2 px-6 rounded-xl transition-all text-sm"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-8 rounded-xl shadow-md transition-all text-sm"
                    >
                      حفظ وإضافة
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Grid of Work Location Cards — Responsive: 3 for mobile, 6 for desktop */}
            {filteredLocations.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700/50 p-8 text-center text-slate-500">
                <MapPinned className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                <p className="font-bold text-sm">
                  {workLocQuery ? `لا توجد أي مواقع عمل مطابقة لـ «${workLocQuery}»` : 'لا يوجد أي مواقع عمل مسجلة حتى الآن.'}
                </p>
                <p className="text-xs mt-1">
                  {workLocQuery ? 'جرّب كتابة كلمات بحث أخرى أو امسح حقل البحث.' : 'اضغط على زر «إضافة موقع عمل» بالأعلى للبدء.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {displayedLocations.map((loc) => (
                  <WorkLocationCard
                    key={loc.id}
                    loc={loc}
                    onToggleActive={handleToggleLocationActive}
                    onEdit={handleEditLocation}
                    onSave={handleInlineSaveLocation}
                    onCancel={() => {
                      setEditingLocationId(null);
                      setShowAddForm(false);
                      setLocName('');
                    }}
                    onDelete={handleDeleteLocation}
                    onGetCurrentLocation={fetchCurrentCoordinates}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 2: EMPLOYEE ASSIGNMENTS & SCHEDULES
            ========================================================================= */}
        {!loading && activeTab === 'assignments' && (
          <div className="space-y-6 no-print animate-in fade-in duration-300">
            {/* Global Employee Search to Navigate to Location and Schedule */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/60 p-5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                <Search className="w-4 h-4 text-blue-500" />
                البحث السريع عن موظف للانتقال المباشر لموقعه وتعديل دوامه
              </label>
              <EmployeeSearch
                onSelect={handleSelectGlobalEmployee}
                placeholder="ابحث بالاسم أو الرقم الوظيفي للوصول المباشر للموظف في موقعه..."
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Right Side: Locations Selector */}
              <div className="lg:col-span-1 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-blue-500" />
                    اختر موقع العمل
                  </h2>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                    {locations.filter(l => l.is_active && (!activeGovernorate || activeGovernorate === 'all' || l.governorate === activeGovernorate)).length} موقع
                  </span>
                </div>

                {/* Filter locations search input */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={locFilterSearch}
                    onChange={(e) => setLocFilterSearch(e.target.value)}
                    placeholder="ابحث عن موقع أو قسم أو مجمع..."
                    className="w-full pr-9 pl-8 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
                  />
                  {locFilterSearch && (
                    <button
                      onClick={() => setLocFilterSearch('')}
                      className="absolute left-2.5 top-2.5 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700/50 p-4 space-y-2 max-h-[480px] overflow-y-auto custom-scrollbar">
                  {locations.filter(l => 
                    l.is_active && 
                    (!activeGovernorate || activeGovernorate === 'all' || l.governorate === activeGovernorate) &&
                    (!locFilterSearch.trim() || l.name.toLowerCase().includes(locFilterSearch.trim().toLowerCase()))
                  ).map((loc) => (
                    <button
                      key={loc.id}
                      id={`loc-btn-${loc.id}`}
                      onClick={() => {
                        setSelectedLocId(loc.id);
                        setHighlightedEmpId(null);
                      }}
                      className={`w-full text-right p-4 rounded-xl font-bold transition-all border flex items-center justify-between ${
                        selectedLocId === loc.id
                          ? 'bg-blue-500 text-white border-blue-600 shadow-md shadow-blue-500/20 ring-2 ring-blue-400'
                          : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-300'
                      }`}
                    >
                      <span>{loc.name}</span>
                      <MapPin className={`w-4 h-4 ${selectedLocId === loc.id ? 'text-white' : 'text-slate-400'}`} />
                    </button>
                  ))}
                  {locations.filter(l => 
                    l.is_active && 
                    (!activeGovernorate || activeGovernorate === 'all' || l.governorate === activeGovernorate) &&
                    (!locFilterSearch.trim() || l.name.toLowerCase().includes(locFilterSearch.trim().toLowerCase()))
                  ).length === 0 && (
                    <p className="text-sm text-slate-500 text-center py-4">
                      {locFilterSearch ? 'لا توجد مواقع عمل مطابقة للبحث.' : 'يرجى إضافة أو تفعيل موقع عمل واحد على الأقل.'}
                    </p>
                  )}
                </div>
              </div>

              {/* Left Side: Assign Panel */}
              <div className="lg:col-span-2 space-y-6">
                {selectedLocId ? (
                  <>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700/50 p-6 space-y-6">
                      <h2 className="text-xl font-bold flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-3">
                        <Users className="w-6 h-6 text-blue-500" />
                        إدارة المنتسبين لـ: <span className="text-blue-500">{locations.find(l => l.id === selectedLocId)?.name}</span>
                      </h2>

                      {/* Search & Assign Input */}
                      <div className="relative">
                        <label className="text-sm font-bold block mb-2">إضافة موظف جديد لهذا الموقع</label>
                        <EmployeeSearch
                          onSelect={(emp) => handleAssignEmployee(emp.id)}
                          placeholder="ابحث عن موظف لربطه بهذا الموقع..."
                        />
                      </div>
                    </div>

                    {/* Assigned list */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700/50 p-6 flex flex-col">
                      <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                        قائمة الموظفين المرتبطين بالموقع ({assignedEmployees.length})
                      </h3>
                      
                      {assignedEmployees.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                          <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                          <p>لا يوجد موظفون مرتبطون بهذا الموقع حالياً.</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-700/50 max-h-[440px] overflow-y-auto custom-scrollbar pr-1">
                          {[...assignedEmployees].sort((a, b) => {
                            if (a.employee_id === highlightedEmpId) return -1;
                            if (b.employee_id === highlightedEmpId) return 1;
                            return (a.employee?.full_name || '').localeCompare(b.employee?.full_name || '', 'ar');
                          }).map((ae) => {
                            const isEditing = editingEmployeeId === ae.employee_id;
                            const isHighlighted = highlightedEmpId === ae.employee_id;
                            const empSchedule = ae.employee?.work_schedule || workSchedules.find(s => s.id === ae.employee?.work_schedule_id);
                            const isRoster = empSchedule?.type === 'roster';

                            let scheduleBadge = (
                              <span className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-[11px] px-2.5 py-1 rounded-md font-bold">
                                دوام صباحي (08:00 - 15:00)
                              </span>
                            );

                            if (isRoster) {
                              scheduleBadge = (
                                <div className="flex items-center gap-2">
                                  <span className="bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 text-[11px] px-2.5 py-1 rounded-md font-bold">
                                    دوام مناوب (شفتات أسبوعية)
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRosterEmployee({
                                        ...ae.employee,
                                        work_schedule_id: ae.employee?.work_schedule_id
                                      });
                                    }}
                                    className="text-[11px] bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-2.5 py-0.5 rounded-lg font-bold transition-colors flex items-center gap-1 border border-purple-200 dark:border-purple-800 shadow-2xs"
                                    title="تعديل جدول شفتات المناوبة لهذا الموظف"
                                  >
                                    <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                                    تعديل الجدول
                                  </button>
                                </div>
                              );
                            }

                            return (
                            <div 
                              key={ae.id} 
                              className={`py-4 px-3 rounded-xl transition-all flex flex-col md:flex-row justify-between md:items-center gap-3 ${
                                isHighlighted ? 'bg-blue-50/80 dark:bg-blue-950/30 ring-2 ring-blue-500/30' : ''
                              }`}
                            >
                              <div className="flex-1">
                                <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{ae.employee?.full_name}</p>
                                <div className="flex flex-wrap items-center gap-3 mt-1.5">
                                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                                    الرقم الوظيفي: {ae.employee?.job_number || '---'}
                                  </p>
                                  
                                  {isEditing ? (
                                    <div className="flex flex-wrap items-center gap-2 mt-2 md:mt-0">
                                      <select
                                        value={editDutyType}
                                        onChange={e => setEditDutyType(e.target.value as 'morning' | 'roster')}
                                        className="text-xs bg-slate-50 border rounded-lg px-2.5 py-1.5 dark:bg-slate-900 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-200 outline-none"
                                      >
                                        <option value="morning">دوام صباحي (08:00 - 15:00)</option>
                                        <option value="roster">دوام مناوب (شفتات متغيرة)</option>
                                      </select>

                                      {editDutyType === 'roster' && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setRosterEmployee({
                                              ...ae.employee,
                                              work_schedule_id: ae.employee?.work_schedule_id
                                            });
                                          }}
                                          className="text-xs bg-purple-100 hover:bg-purple-200 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1 shadow-2xs"
                                        >
                                          <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                                          تخصيص جدول المناوبة (شفتات)
                                        </button>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs text-slate-400">نوع الدوام:</span>
                                      {scheduleBadge}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {isEditing ? (
                                  <>
                                    <button
                                      onClick={() => handleUpdateShift(ae.employee_id)}
                                      className="text-emerald-500 hover:text-emerald-600 bg-emerald-50 hover:bg-emerald-100 p-2.5 rounded-xl transition-all"
                                      title="حفظ"
                                    >
                                      <Save className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => setEditingEmployeeId(null)}
                                      className="text-slate-500 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 p-2.5 rounded-xl transition-all"
                                      title="إلغاء"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => {
                                        setEditingEmployeeId(ae.employee_id);
                                        const isRost = (ae.employee?.work_schedule?.type === 'roster') || (empSchedule?.type === 'roster');
                                        setEditDutyType(isRost ? 'roster' : 'morning');
                                        setEditScheduleId(ae.employee?.work_schedule_id || '');
                                      }}
                                      className="text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 p-2 rounded-xl transition-all flex items-center gap-1 text-xs font-bold"
                                      title="تعديل نوع الدوام"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                      تعديل
                                    </button>
                                    <button
                                      onClick={() => handleRemoveEmployee(ae.employee_id)}
                                      className="text-rose-500 hover:text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 p-2 rounded-xl transition-all"
                                      title="إلغاء الربط بالموقع"
                                    >
                                      <UserMinus className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          )})}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700/50 p-12 text-center text-slate-500">
                    <MapPin className="w-12 h-12 mx-auto mb-3 text-slate-400 animate-bounce" />
                    <p>يرجى اختيار أحد مواقع العمل من القائمة الجانبية لإدارة موظفيه وتخصيص شفتاتهم.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}



        {/* DEVICE LOGS TAB */}
        {activeTab === 'deviceLogs' && (() => {
          const filteredLogs = deviceLogs.filter((log) => {
            const matchesSearch =
              !deviceLogsSearch ||
              log.profiles?.full_name?.toLowerCase().includes(deviceLogsSearch.toLowerCase()) ||
              log.profiles?.job_number?.toLowerCase().includes(deviceLogsSearch.toLowerCase()) ||
              log.new_device_id?.toLowerCase().includes(deviceLogsSearch.toLowerCase()) ||
              log.old_device_id?.toLowerCase().includes(deviceLogsSearch.toLowerCase());

            const matchesStatus =
              deviceLogsStatusFilter === 'all' || log.status === deviceLogsStatusFilter;

            return matchesSearch && matchesStatus;
          });

          const totalCount = deviceLogs.length;
          const approvedCount = deviceLogs.filter((l) => l.status === 'approved').length;
          const pendingCount = deviceLogs.filter((l) => l.status === 'pending').length;
          const rejectedCount = deviceLogs.filter((l) => l.status === 'rejected').length;

          return (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50 p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    سجل توثيق أجهزة الحضور
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                    يعرض هذا السجل كافة عمليات توثيق واعتماد أو إلغاء أجهزة الموظفين بالبصمة المشفرة
                  </p>
                </div>
                <button
                  onClick={loadDeviceLogs}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-medium transition-colors self-start md:self-auto"
                  title="تحديث السجل"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingLogs ? 'animate-spin' : ''}`} />
                  تحديث البيانات
                </button>
              </div>

              {/* Stats Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-500 font-medium block mb-1">إجمالي الحركات</span>
                  <span className="text-xl font-bold text-slate-800 dark:text-white">{totalCount}</span>
                </div>
                <div className="p-3.5 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium block mb-1">أجهزة موثقة ومعتمدة</span>
                  <span className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{approvedCount}</span>
                </div>
                <div className="p-3.5 bg-amber-50/60 dark:bg-amber-950/20 rounded-xl border border-amber-100 dark:border-amber-900/40">
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-medium block mb-1">طلبات قيد المراجعة</span>
                  <span className="text-xl font-bold text-amber-700 dark:text-amber-300">{pendingCount}</span>
                </div>
                <div className="p-3.5 bg-rose-50/60 dark:bg-rose-950/20 rounded-xl border border-rose-100 dark:border-rose-900/40">
                  <span className="text-xs text-rose-600 dark:text-rose-400 font-medium block mb-1">أجهزة مرفوضة / ملغاة</span>
                  <span className="text-xl font-bold text-rose-700 dark:text-rose-300">{rejectedCount}</span>
                </div>
              </div>

              {/* Search & Filter Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={deviceLogsSearch}
                    onChange={(e) => setDeviceLogsSearch(e.target.value)}
                    placeholder="بحث باسم الموظف، الرقم الوظيفي، أو نوع الجهاز..."
                    className="w-full pl-4 pr-10 py-2.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-white"
                  />
                  {deviceLogsSearch && (
                    <button
                      onClick={() => setDeviceLogsSearch('')}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      مسح
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900/80 p-1 rounded-xl shrink-0">
                  {[
                    { id: 'all', label: 'الكل' },
                    { id: 'approved', label: 'المعتمدة' },
                    { id: 'pending', label: 'المعلقة' },
                    { id: 'rejected', label: 'المرفوضة' }
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setDeviceLogsStatusFilter(f.id as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        deviceLogsStatusFilter === f.id
                          ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {loadingLogs ? (
                <div className="flex justify-center p-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="text-center py-12 text-slate-500 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  لا توجد أي سجلات تطابق عوامل البحث المحددة حالياً
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-right">
                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400">
                      <tr>
                        <th className="px-4 py-3 font-semibold rounded-r-lg">الموظف</th>
                        <th className="px-4 py-3 font-semibold">حالة التوثيق</th>
                        <th className="px-4 py-3 font-semibold">نوع ومعلومات الجهاز</th>
                        <th className="px-4 py-3 font-semibold">تاريخ ووقت العملية</th>
                        <th className="px-4 py-3 font-semibold rounded-l-lg text-center">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                      {filteredLogs.map((log) => {
                        const newDev = parseDeviceDetails(log.new_device_id);
                        const oldDev = log.old_device_id ? parseDeviceDetails(log.old_device_id) : null;
                        const dateObj = new Date(log.created_at || log.updated_at);
                        const formattedDateTime = !isNaN(dateObj.getTime())
                          ? dateObj.toLocaleString('ar-IQ', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,
                              timeZone: 'Asia/Baghdad'
                            })
                          : 'غير محدد';

                        return (
                          <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/20 transition-colors">
                            {/* Employee */}
                            <td className="px-4 py-3.5">
                              <div className="font-bold text-slate-800 dark:text-slate-200">
                                {log.profiles?.full_name || 'غير معروف'}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                الرقم الوظيفي: {log.profiles?.job_number || 'بدون رقم وظيفي'}
                              </div>
                            </td>

                            {/* Status */}
                            <td className="px-4 py-3.5">
                              {log.status === 'approved' ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50">
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  جهاز موثق معتمد
                                </span>
                              ) : log.status === 'pending' ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50">
                                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                                  طلب قيد المراجعة
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50">
                                  <X className="w-3.5 h-3.5 text-rose-600" />
                                  تم الرفض / ملغي
                                </span>
                              )}
                            </td>

                            {/* Device details */}
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                  {newDev.type}
                                </span>
                                <span className="font-medium text-slate-800 dark:text-slate-200 text-xs">
                                  {newDev.label}
                                </span>
                              </div>
                              {newDev.hash && (
                                <div className="text-[11px] font-mono text-slate-400 dark:text-slate-500 mt-1 truncate max-w-[260px]" title={newDev.hash}>
                                  رمز العتاد: [{newDev.hash.substring(0, 16)}...]
                                </div>
                              )}
                              {oldDev && oldDev.label !== newDev.label && (
                                <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                                  بديل عن: {oldDev.label}
                                </div>
                              )}
                            </td>

                            {/* Date & Time */}
                            <td className="px-4 py-3.5 font-medium text-slate-600 dark:text-slate-300 text-xs">
                              {formattedDateTime}
                            </td>

                            {/* Action Buttons */}
                            <td className="px-4 py-3.5 text-center">
                              {log.status === 'approved' ? (
                                canManageDevices ? (
                                  <button
                                    onClick={() => handleRevokeDevice(log)}
                                    className="px-3 py-1 text-xs font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800 rounded-lg transition-colors inline-flex items-center gap-1"
                                    title="إلغاء توثيق هذا الجهاز وإعادة تعيينه"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                    إلغاء التوثيق
                                  </button>
                                ) : (
                                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">معتمد</span>
                                )
                              ) : log.status === 'pending' ? (
                                canManageDevices ? (
                                  <button
                                    onClick={() => setActiveTab('deviceRequests')}
                                    className="px-3 py-1 text-xs font-semibold bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-lg transition-colors inline-flex items-center gap-1"
                                    title="الانتقال إلى تبويبة طلبات تغيير الأجهزة لاتخاذ الإجراء"
                                  >
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    مراجعة الطلب
                                  </button>
                                ) : (
                                  <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">قيد المراجعة</span>
                                )
                              ) : (
                                <span className="text-xs text-slate-400">لا يوجد إجراء</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })()}
        {/* DEVICE REQUESTS TAB */}
        {activeTab === 'deviceRequests' && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">طلبات تغيير الأجهزة</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">الموظفون الذين سجلوا دخول من أجهزة جديدة بانتظار الموافقة</p>
              </div>
              <button onClick={loadDeviceRequests} className="p-2 text-slate-500 hover:bg-slate-100 rounded-full" title="تحديث">
                <svg className={`w-5 h-5 ${loadingRequests ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>

            {loadingRequests ? (
              <div className="flex justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
              </div>
            ) : deviceRequests.length === 0 ? (
              <div className="text-center py-12 text-slate-500 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-200">
                لا توجد طلبات تغيير أجهزة معلقة حالياً
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right">
                  <thead className="bg-slate-50 dark:bg-slate-900 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-medium rounded-r-lg">الموظف</th>
                      <th className="px-4 py-3 font-medium">معرف الجهاز الجديد</th>
                      <th className="px-4 py-3 font-medium">تاريخ الطلب</th>
                      <th className="px-4 py-3 font-medium rounded-l-lg text-center">الإجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {deviceRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-800 dark:text-slate-200">{req.profiles?.full_name || 'غير معروف'}</div>
                          <div className="text-xs text-slate-500">{req.profiles?.job_number || 'بدون رقم وظيفي'}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium text-xs">
                          {(() => {
                            const rawStr = req.new_device_id || '';
                            const match = rawStr.match(/^(.*?)\s*\[([a-f0-9]{32,64})\]$/i);
                            if (match) {
                              return (
                                <div className="space-y-0.5">
                                  <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                    <Smartphone className="w-4 h-4 text-blue-500 shrink-0" />
                                    {match[1]}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono tracking-wider">
                                    الرمز المشفر: {match[2].substring(0, 16)}...
                                  </div>
                                </div>
                              );
                            }
                            return (
                              <div className="space-y-0.5">
                                <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                  <Smartphone className="w-4 h-4 text-amber-500 shrink-0" />
                                  جهاز غير مسمى
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  {rawStr}
                                </div>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3 text-slate-500" dir="ltr" style={{ textAlign: 'right' }}>
                          {new Date(req.created_at).toLocaleString('ar-IQ', {
                            year: 'numeric', month: '2-digit', day: '2-digit',
                            hour: '2-digit', minute: '2-digit', second: '2-digit'
                          })}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {canManageDevices ? (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => {
                                  if (window.confirm('هل أنت متأكد من اعتماد هذا الجهاز؟ ستتحول بصمات الموظف المعلقة إلى معتمدة.')) {
                                    handleApproveDevice(req);
                                  }
                                }}
                                className="px-3 py-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-lg text-xs font-bold transition-colors"
                              >
                                موافقة
                              </button>
                              <button
                                onClick={() => {
                                  if (window.confirm('هل تريد إرسال إشعار للموظف لمراجعة الإدارة (مع إبقاء الطلب معلقاً)؟')) {
                                    handleReviewDevice(req);
                                  }
                                }}
                                className="px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg text-xs font-bold transition-colors whitespace-nowrap"
                              >
                                مراجعة الإدارة
                              </button>
                              <button
                                onClick={() => {
                                  if (window.confirm('هل أنت متأكد من الرفض؟ سيتم حذف بصمات الموظف المعلقة لهذا اليوم.')) {
                                    handleRejectDevice(req);
                                  }
                                }}
                                className="px-3 py-1.5 bg-rose-100 text-rose-700 hover:bg-rose-200 rounded-lg text-xs font-bold transition-colors"
                              >
                                رفض
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 font-medium">للمشرف العام ومشرف البصمة فقط</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* WORK SCHEDULES TAB */}
        {activeTab === 'workSchedules' && (
        <WorkSchedulesTab />
      )}

        {/* WORK HOURS MODIFICATION TAB */}
        {activeTab === 'workHoursModification' && (
        <WorkHoursModificationTab />
      )}

      {activeTab === 'liveBoard' && isAttendanceAdmin && (
        <LiveAttendanceBoard />
      )}

      {activeTab === 'timesheets' && isAttendanceAdmin && (
        <Timesheets />
      )}

      {activeTab === 'holidays' && (
        <HolidaysTab />
      )}

      {activeTab === 'kiosks' && canManageKiosks && (
        <KioskAdminPanel />
      )}
    </div>

      {/* Floating Roster Customization Modal */}
      {rosterEmployee && (
        <EmployeeRosterModal
          employee={rosterEmployee}
          locationName={locations.find(l => l.id === selectedLocId)?.name}
          onClose={() => setRosterEmployee(null)}
          onSave={async () => {
            setRosterEmployee(null);
            setEditingEmployeeId(null);
            await loadWorkSchedules();
            if (selectedLocId) await loadAssignments(selectedLocId);
          }}
        />
      )}

      {/* Processing Modal */}
      {processingRecord && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 pb-28 md:pb-32 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 dark:border-slate-700">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">معالجة السجل التلقائي</h3>
              <p className="text-sm text-slate-500 mt-1">للموظف: {processingRecord.employeeName}</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">الإجراء المناسب</label>
                <select 
                  value={adminAction}
                  onChange={(e) => setAdminAction(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="accept">قبول واعتماده كدوام طبيعي</option>
                  <option value="absent">احتساب غياب</option>
                  <option value="vacation">احتساب إجازة</option>
                  <option value="late">احتساب تأخير</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">ملاحظات المشرف (اختياري)</label>
                <textarea 
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="سبب هذا الإجراء..."
                  rows={3}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                ></textarea>
              </div>
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-end gap-3 rounded-b-2xl">
              <button
                onClick={() => setProcessingRecord(null)}
                className="px-6 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
                disabled={isProcessing}
              >
                إلغاء
              </button>
              <button
                onClick={handleProcessAutoAttendance}
                disabled={isProcessing}
                className="px-6 py-2.5 rounded-xl font-bold bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isProcessing ? 'جاري المعالجة...' : 'تأكيد المعالجة'}
              </button>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {errorModal.show && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-700"
            >
              <div className="p-6">
                <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>
                <h2 className="text-xl font-bold text-center text-slate-800 dark:text-white mb-2">{errorModal.title}</h2>
                <div className="bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 p-4 rounded-xl text-sm mb-6 max-h-40 overflow-y-auto whitespace-pre-wrap">
                  {errorModal.message}
                </div>
                
                <button
                  onClick={() => setErrorModal({ show: false, title: '', message: '' })}
                  className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white py-3 rounded-xl font-bold transition-colors"
                >
                  حسناً، فهمت
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}







