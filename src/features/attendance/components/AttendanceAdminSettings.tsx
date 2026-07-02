import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { workLocationService } from '../services/workLocationService';
import type { WorkLocation } from '../types';
import { 
  MapPin, Users, Plus, Trash2, Search, Printer, Calendar, 
  BarChart3, Settings, MapPinned, UserPlus, UserMinus, 
  Check, X, Navigation, Eye, EyeOff, ShieldCheck
} from 'lucide-react';
import { toast } from 'react-hot-toast';

type Tab = 'locations' | 'assignments' | 'reports' | 'deviceLogs';

export default function AttendanceAdminSettings() {
  const [activeTab, setActiveTab] = useState<Tab>('locations');
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
  const [assignedEmployees, setAssignedEmployees] = useState<any[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [shiftStart, setShiftStart] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('lastShiftStart') || '08:00';
    return '08:00';
  });
  const [shiftEnd, setShiftEnd] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('lastShiftEnd') || '14:00';
    return '14:00';
  });

  // Reports State
  const [reportType, setReportType] = useState<'daily' | 'range'>('daily');
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportFromDate, setReportFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportToDate, setReportToDate] = useState(new Date().toISOString().split('T')[0]);
  const [records, setRecords] = useState<any[]>([]);
  const [reportStats, setReportStats] = useState({
    total: 0,
    present: 0,
    absent: 0,
    late: 0,
    earlyLeave: 0
  });

  // Device Logs State
  const [deviceLogs, setDeviceLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Fetch Locations
  const loadLocations = async () => {
    setLoading(true);
    try {
      const data = await workLocationService.getAllLocations();
      setLocations(data);
      if (data.length > 0 && !selectedLocId) {
        setSelectedLocId(data[0].id);
      }
    } catch (err: any) {
      toast.error('فشل تحميل مواقع العمل: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLocations();
  }, []);

  // Assignments loading
  const loadAssignments = async (locationId: string) => {
    if (!locationId) return;
    try {
      const data = await workLocationService.getLocationEmployees(locationId);
      setAssignedEmployees(data);
    } catch (err: any) {
      toast.error('فشل تحميل قائمة الموظفين: ' + err.message);
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
          const results = await workLocationService.searchEmployees(employeeSearch);
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

  // Load Device Logs
  const loadDeviceLogs = async () => {
    setLoadingLogs(true);
    try {
      const { data, error } = await supabase
        .from('device_enrollment_logs')
        .select(`
          id,
          action_type,
          device_name,
          created_at,
          profiles:user_id(full_name, job_number)
        `)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      setDeviceLogs(data || []);
    } catch (err: any) {
      toast.error('فشل تحميل سجل الأجهزة: ' + err.message);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'deviceLogs') {
      loadDeviceLogs();
    }
  }, [activeTab]);

  // Load Reports
  const loadReports = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('attendance_records')
        .select(`
          id,
          check_in,
          check_out,
          status,
          check_in_verified_by_biometric,
          check_out_verified_by_biometric,
          check_in_location,
          check_out_location,
          employee:profiles (
            full_name,
            job_number
          )
        `);

      if (reportType === 'daily') {
        query = query
          .gte('created_at', `${reportDate}T00:00:00`)
          .lte('created_at', `${reportDate}T23:59:59`);
      } else {
        query = query
          .gte('created_at', `${reportFromDate}T00:00:00`)
          .lte('created_at', `${reportToDate}T23:59:59`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const formatted = (data || []).map((r: any) => ({
        id: r.id,
        employeeName: r.employee?.full_name || 'غير معروف',
        jobNumber: r.employee?.job_number || '---',
        checkIn: r.check_in,
        checkOut: r.check_out,
        status: r.status,
        verifiedIn: r.check_in_verified_by_biometric,
        verifiedOut: r.check_out_verified_by_biometric,
        checkInLocation: r.check_in_location
      }));

      setRecords(formatted);

      // Calc stats
      const total = formatted.length;
      const present = formatted.filter(r => r.status === 'present').length;
      const absent = formatted.filter(r => r.status === 'absent').length;
      const late = formatted.filter(r => r.status === 'late').length;
      const earlyLeave = formatted.filter(r => r.status === 'early_leave').length;

      setReportStats({ total, present, absent, late, earlyLeave });

    } catch (err: any) {
      toast.error('فشل تحميل التقارير: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'reports') {
      loadReports();
    }
  }, [activeTab, reportType, reportDate, reportFromDate, reportToDate]);

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

  // Add or update Location
  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locName.trim()) {
      toast.error('يرجى إدخال اسم الموقع');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const locationData = {
        name: locName,
        latitude: locLat,
        longitude: locLng,
        radius_meters: locRadius,
        is_active: true,
        created_by: user?.id
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
    setShowAddForm(true);
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

  // Assign Employee
  const handleAssignEmployee = async (employeeId: string) => {
    if (!selectedLocId) return;
    try {
      await workLocationService.assignEmployee(selectedLocId, employeeId, shiftStart, shiftEnd);
      toast.success('تم ربط الموظف بالموقع بنجاح');
      setEmployeeSearch('');
      setSearchResults([]);
      loadAssignments(selectedLocId);
    } catch (err: any) {
      toast.error('فشل ربط الموظف: ' + err.message);
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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'present': return 'حاضر';
      case 'absent': return 'غائب';
      case 'late': return 'متأخر';
      case 'early_leave': return 'انصراف مبكر';
      default: return status;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'present': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'absent': return 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400';
      case 'late': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
      case 'early_leave': return 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400';
      default: return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900 text-slate-900 dark:text-white transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 pt-8 pb-32">
        
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

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 no-print">
          <div>
            <h1 className="text-3xl font-bold font-tajawal flex items-center gap-3">
              <Settings className="w-8 h-8 text-blue-500" />
              إعدادات نظام الحضور والانصراف البيومتري
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              إدارة مواقع سياج العمل، صلاحيات البصمة والتقارير الدورية للمديرية.
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 mb-8 overflow-x-auto no-print">
          <button
            onClick={() => setActiveTab('locations')}
            className={`flex items-center gap-2 px-6 py-4 font-bold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'locations'
                ? 'border-blue-500 text-blue-500'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <MapPinned className="w-5 h-5" />
            إدارة مواقع العمل
          </button>
          <button
            onClick={() => setActiveTab('assignments')}
            className={`flex items-center gap-2 px-6 py-4 font-bold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'assignments'
                ? 'border-blue-500 text-blue-500'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <UserPlus className="w-5 h-5" />
            ربط الموظفين بالمواقع
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
              activeTab === 'reports' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            تقارير الحضور
          </button>
          <button
            onClick={() => setActiveTab('deviceLogs')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
              activeTab === 'deviceLogs' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck className="w-5 h-5" />
            سجل توثيق الأجهزة
          </button>
        </div>

        {/* Loading Spinner */}
        {loading && activeTab !== 'reports' && (
          <div className="flex justify-center items-center py-12 no-print">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {/* =========================================================================
            TAB 1: MANAGING WORK LOCATIONS 
            ========================================================================= */}
        {!loading && activeTab === 'locations' && (
          <div className="space-y-6 no-print">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <MapPin className="w-6 h-6 text-blue-500" />
                المواقع المسجلة حالياً
              </h2>
              <button
                onClick={() => {
                  setShowAddForm(!showAddForm);
                  if (showAddForm) {
                    setEditingLocationId(null);
                    setLocName('');
                  }
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl shadow-md transition-all flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Plus className="w-5 h-5" />
                إضافة موقع عمل
              </button>
            </div>

            {/* Add/Edit Location Form */}
            {showAddForm && (
              <form onSubmit={handleSaveLocation} className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700/50 p-6 max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                <h3 className="text-lg font-bold border-b border-slate-100 dark:border-slate-700 pb-3">
                  {editingLocationId ? 'تعديل موقع العمل' : 'إضافة موقع عمل جديد'}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold">اسم الموقع (مثال: المبنى الرئيسي)</label>
                    <input
                      type="text"
                      required
                      value={locName}
                      onChange={(e) => setLocName(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold">نصف قطر السياج (متر)</label>
                    <input
                      type="number"
                      required
                      min={10}
                      max={1000}
                      value={locRadius}
                      onChange={(e) => setLocRadius(Number(e.target.value))}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold">خط العرض (Latitude)</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={locLat}
                      onChange={(e) => setLocLat(Number(e.target.value))}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold">خط الطول (Longitude)</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={locLng}
                      onChange={(e) => setLocLng(Number(e.target.value))}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-between pt-4 border-t border-slate-100 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={handleGetCurrentLocation}
                    disabled={isGettingLocation}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Navigation className="w-5 h-5 animate-pulse" />
                    {isGettingLocation ? 'جاري جلب إحداثياتك...' : 'جلب إحداثيات موقعي الحالي'}
                  </button>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddForm(false);
                        setEditingLocationId(null);
                        setLocName('');
                      }}
                      className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 font-bold py-2.5 px-6 rounded-xl transition-all"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-8 rounded-xl shadow-md transition-all"
                    >
                      {editingLocationId ? 'تعديل وحفظ' : 'حفظ وإضافة'}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Grid list of Locations */}
            {locations.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700/50 p-12 text-center text-slate-500">
                <MapPinned className="w-16 h-16 mx-auto mb-4 text-slate-400" />
                <p className="font-bold">لا يوجد أي مواقع عمل مسجلة حتى الآن.</p>
                <p className="text-sm mt-1">اضغط على زر "إضافة موقع عمل" بالأعلى للبدء.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {locations.map((loc) => (
                  <div key={loc.id} className={`bg-white dark:bg-slate-800 rounded-2xl shadow-lg border p-6 flex flex-col justify-between transition-all duration-300 hover:shadow-xl ${
                    loc.is_active ? 'border-slate-100 dark:border-slate-700/50' : 'border-rose-200/50 dark:border-rose-900/30 opacity-75'
                  }`}>
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="font-bold text-lg">{loc.name}</h3>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          loc.is_active ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400'
                        }`}>
                          {loc.is_active ? 'نشط' : 'معطل'}
                        </span>
                      </div>
                      
                      <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400 mb-6">
                        <div className="flex justify-between">
                          <span>خط العرض:</span>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-300">{loc.latitude.toFixed(6)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>خط الطول:</span>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-300">{loc.longitude.toFixed(6)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-blue-600 dark:text-blue-400">
                          <span>نصف القطر:</span>
                          <span>{loc.radius_meters} متر</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 border-t border-slate-100 dark:border-slate-700/50 pt-4 mt-auto">
                      <button
                        onClick={() => handleToggleLocationActive(loc.id, loc.is_active)}
                        className={`p-2 rounded-xl flex-1 text-center font-bold text-xs flex justify-center items-center gap-1 transition-all ${
                          loc.is_active 
                            ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/30' 
                            : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/30'
                        }`}
                        title={loc.is_active ? 'تعطيل الموقع' : 'تفعيل الموقع'}
                      >
                        {loc.is_active ? (
                          <>
                            <EyeOff className="w-4 h-4" />
                            تعطيل
                          </>
                        ) : (
                          <>
                            <Eye className="w-4 h-4" />
                            تفعيل
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleEditLocation(loc)}
                        className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/50 dark:hover:bg-slate-700 p-2 rounded-xl text-slate-700 dark:text-slate-300 transition-all font-bold text-xs flex justify-center items-center gap-1"
                        title="تعديل الإعدادات"
                      >
                        <Trash2 className="w-4 h-4 hidden" /> {/* dummy to balance */}
                        تعديل
                      </button>

                      <button
                        onClick={() => handleDeleteLocation(loc.id)}
                        className="bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 p-2 rounded-xl transition-all font-bold text-xs flex justify-center items-center gap-1"
                        title="حذف الموقع"
                      >
                        <Trash2 className="w-4 h-4" />
                        حذف
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 2: EMPLOYEE ASSIGNMENTS
            ========================================================================= */}
        {!loading && activeTab === 'assignments' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 no-print animate-in fade-in duration-300">
            
            {/* Right Side: Locations Selector */}
            <div className="lg:col-span-1 space-y-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-500" />
                اختر موقع العمل
              </h2>
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700/50 p-4 space-y-2">
                {locations.filter(l => l.is_active).map((loc) => (
                  <button
                    key={loc.id}
                    onClick={() => setSelectedLocId(loc.id)}
                    className={`w-full text-right p-4 rounded-xl font-bold transition-all border flex items-center justify-between ${
                      selectedLocId === loc.id
                        ? 'bg-blue-500 text-white border-blue-600 shadow-md shadow-blue-500/20'
                        : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-300'
                    }`}
                  >
                    <span>{loc.name}</span>
                    <MapPin className={`w-4 h-4 ${selectedLocId === loc.id ? 'text-white' : 'text-slate-400'}`} />
                  </button>
                ))}
                {locations.filter(l => l.is_active).length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-4">يرجى إضافة أو تفعيل موقع عمل واحد على الأقل.</p>
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
                      <label className="text-sm font-bold block mb-2">بحث عن موظف لربطه بالموقع (الاسم أو الرقم الوظيفي)</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="اكتب الاسم أو الرقم الوظيفي..."
                          value={employeeSearch}
                          onChange={(e) => setEmployeeSearch(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-4 pr-11 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                        />
                        <Search className="w-5 h-5 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2" />
                      </div>

                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-700 dark:text-slate-300">وقت بداية الدوام</label>
                          <input
                            type="time"
                            value={shiftStart}
                            onChange={(e) => {
                              setShiftStart(e.target.value);
                              localStorage.setItem('lastShiftStart', e.target.value);
                            }}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-700 dark:text-slate-300">وقت نهاية الدوام</label>
                          <input
                            type="time"
                            value={shiftEnd}
                            onChange={(e) => {
                              setShiftEnd(e.target.value);
                              localStorage.setItem('lastShiftEnd', e.target.value);
                            }}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                          />
                        </div>
                      </div>

                      {/* Dropdown Suggestions */}
                      {searchResults.length > 0 && (
                        <div className="absolute z-30 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl mt-1 overflow-hidden divide-y divide-slate-100 dark:divide-slate-700 max-h-60 overflow-y-auto">
                          {searchResults.map((emp) => (
                            <button
                              key={emp.id}
                              onClick={() => handleAssignEmployee(emp.id)}
                              className="w-full text-right p-4 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex justify-between items-center transition-all"
                            >
                              <div>
                                <p className="font-bold text-sm">{emp.full_name}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">الرقم الوظيفي: {emp.job_number}</p>
                              </div>
                              <UserPlus className="w-5 h-5 text-blue-500" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Assigned list */}
                  <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700/50 p-6">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                      قائمة الموظفين المرتبطين بالموقع ({assignedEmployees.length})
                    </h3>
                    
                    {assignedEmployees.length === 0 ? (
                      <div className="text-center py-12 text-slate-500">
                        <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                        <p>لا يوجد موظفون مرتبطون بهذا الموقع حالياً.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                        {assignedEmployees.map((ae) => (
                          <div key={ae.id} className="py-4 flex justify-between items-center">
                            <div>
                              <p className="font-bold">{ae.employee?.full_name}</p>
                              <div className="flex gap-4 mt-1">
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  الرقم الوظيفي: {ae.employee?.job_number}
                                </p>
                                {(ae.shift_start || ae.shift_end) && (
                                  <p className="text-xs text-blue-600 dark:text-blue-400 font-bold">
                                    الدوام: {ae.shift_start?.slice(0,5) || '--:--'} إلى {ae.shift_end?.slice(0,5) || '--:--'}
                                  </p>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => handleRemoveEmployee(ae.employee_id)}
                              className="text-rose-500 hover:text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 p-2.5 rounded-xl transition-all"
                              title="إلغاء الربط بالموقع"
                            >
                              <UserMinus className="w-5 h-5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700/50 p-12 text-center text-slate-500">
                  <MapPin className="w-12 h-12 mx-auto mb-3 text-slate-400 animate-bounce" />
                  <p>يرجى اختيار أحد مواقع العمل من القائمة الجانبية لإدارة موظفيه.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 3: REPORTS & PRINTING 
            ========================================================================= */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            
            {/* Filters panel - HIDDEN on print */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700/50 p-6 no-print space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Calendar className="w-6 h-6 text-blue-500" />
                  تخصيص فلترة التقرير
                </h2>
                
                <div className="flex gap-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                  <button
                    onClick={() => setReportType('daily')}
                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                      reportType === 'daily'
                        ? 'bg-white dark:bg-slate-800 text-blue-500 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    يومي
                  </button>
                  <button
                    onClick={() => setReportType('range')}
                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                      reportType === 'range'
                        ? 'bg-white dark:bg-slate-800 text-blue-500 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    فترة مخصصة
                  </button>
                </div>
              </div>

              {/* Date pickers */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-end">
                {reportType === 'daily' ? (
                  <div className="space-y-2">
                    <label className="text-sm font-bold">تاريخ التقرير</label>
                    <input
                      type="date"
                      value={reportDate}
                      onChange={(e) => setReportDate(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                    />
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-bold">من تاريخ</label>
                      <input
                        type="date"
                        value={reportFromDate}
                        onChange={(e) => setReportFromDate(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold">إلى تاريخ</label>
                      <input
                        type="date"
                        value={reportToDate}
                        onChange={(e) => setReportToDate(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                      />
                    </div>
                  </>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={loadReports}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 flex-1"
                  >
                    تحديث التقرير
                  </button>

                  <button
                    onClick={() => window.print()}
                    disabled={records.length === 0}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Printer className="w-5 h-5" />
                    طباعة
                  </button>
                </div>
              </div>
            </div>

            {/* Statistics Cards - ALWAYS VISIBLE */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 print-area">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md border border-slate-100 dark:border-slate-700/50 p-4 text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">إجمالي السجلات</p>
                <p className="text-2xl font-bold mt-1 text-slate-800 dark:text-white">{reportStats.total}</p>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-xl shadow-md border border-emerald-100 dark:border-emerald-900/30 p-4 text-center">
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">حاضر</p>
                <p className="text-2xl font-bold mt-1 text-emerald-700 dark:text-emerald-400">{reportStats.present}</p>
              </div>
              <div className="bg-rose-50 dark:bg-rose-950/20 rounded-xl shadow-md border border-rose-100 dark:border-rose-900/30 p-4 text-center">
                <p className="text-xs text-rose-600 dark:text-rose-400 font-bold">غائب</p>
                <p className="text-2xl font-bold mt-1 text-rose-700 dark:text-rose-400">{reportStats.absent}</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl shadow-md border border-amber-100 dark:border-amber-900/30 p-4 text-center">
                <p className="text-xs text-amber-600 dark:text-amber-400 font-bold">متأخر</p>
                <p className="text-2xl font-bold mt-1 text-amber-700 dark:text-amber-400">{reportStats.late}</p>
              </div>
              <div className="bg-sky-50 dark:bg-sky-950/20 rounded-xl shadow-md border border-sky-100 dark:border-sky-900/30 p-4 text-center">
                <p className="text-xs text-sky-600 dark:text-sky-400 font-bold">انصراف مبكر</p>
                <p className="text-2xl font-bold mt-1 text-sky-700 dark:text-sky-400">{reportStats.earlyLeave}</p>
              </div>
            </div>

            {/* Print Header Info - ONLY VISIBLE ON PRINT */}
            <div className="hidden print:block text-center mb-6 print-area">
              <h1 className="text-2xl font-bold">وزارة الاتصالات - الشركة العامة للاتصالات والمعلوماتية</h1>
              <h2 className="text-xl font-bold mt-1">مديرية اتصالات ومعلوماتية كربلاء المقدسة</h2>
              <h3 className="text-lg font-bold text-slate-700 mt-2">
                تقرير حضور وانصراف الموظفين للفترة: {reportType === 'daily' ? reportDate : `${reportFromDate} إلى ${reportToDate}`}
              </h3>
              <div className="w-full border-b border-black mt-4"></div>
            </div>

            {/* Main Table - ALWAYS VISIBLE */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700/50 p-6 print-area">
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : records.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p className="font-bold">لا يوجد أي سجلات حضور للتواريخ المحددة.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="py-4 px-4 font-bold text-slate-500 dark:text-slate-400">اسم الموظف</th>
                        <th className="py-4 px-4 font-bold text-slate-500 dark:text-slate-400">الرقم الوظيفي</th>
                        <th className="py-4 px-4 font-bold text-slate-500 dark:text-slate-400">وقت الحضور</th>
                        <th className="py-4 px-4 font-bold text-slate-500 dark:text-slate-400">وقت الانصراف</th>
                        <th className="py-4 px-4 font-bold text-slate-500 dark:text-slate-400">الحالة</th>
                        <th className="py-4 px-4 font-bold text-slate-500 dark:text-slate-400">بصمة حضور</th>
                        <th className="py-4 px-4 font-bold text-slate-500 dark:text-slate-400 font-mono hidden md:table-cell">موقع البصمة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {records.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors">
                          <td className="py-4 px-4 font-bold text-slate-800 dark:text-slate-200">{r.employeeName}</td>
                          <td className="py-4 px-4 font-mono font-bold text-slate-600 dark:text-slate-400">{r.jobNumber}</td>
                          <td className="py-4 px-4 font-mono font-bold">
                            {r.checkIn ? new Date(r.checkIn).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                          </td>
                          <td className="py-4 px-4 font-mono font-bold">
                            {r.checkOut ? new Date(r.checkOut).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                          </td>
                          <td className="py-4 px-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${getStatusBadgeClass(r.status)}`}>
                              {getStatusLabel(r.status)}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex gap-2">
                              {r.verifiedIn ? (
                                <Check className="w-5 h-5 text-emerald-500" />
                              ) : (
                                <X className="w-5 h-5 text-rose-500" />
                              )}
                              <span className="text-xs text-slate-400">({r.verifiedIn ? 'بيومتري' : 'يدوي'})</span>
                            </div>
                          </td>
                          <td className="py-4 px-4 font-mono text-xs text-slate-400 hidden md:table-cell">
                            {r.checkInLocation || 'غير مسجل'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Print Footer signatures - ONLY VISIBLE ON PRINT */}
            <div className="hidden print:flex justify-between mt-12 px-12 print-area">
              <div className="text-center font-bold">
                <p>معد التقرير</p>
                <p className="mt-12">_________________</p>
              </div>
              <div className="text-center font-bold">
                <p>المشرف العام</p>
                <p className="mt-12">_________________</p>
              </div>
              <div className="text-center font-bold">
                <p>مدير القسم</p>
                <p className="mt-12">_________________</p>
              </div>
            </div>
            
          </div>
        )}

        {/* DEVICE LOGS TAB */}
        {activeTab === 'deviceLogs' && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">سجل توثيق أجهزة الحضور</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">يعرض هذا السجل عمليات ربط أو إلغاء ربط أجهزة الموظفين بالبصمة المشفرة</p>
              </div>
              <button onClick={loadDeviceLogs} className="p-2 text-slate-500 hover:bg-slate-100 rounded-full" title="تحديث">
                <svg className={`w-5 h-5 ${loadingLogs ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>

            {loadingLogs ? (
              <div className="flex justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : deviceLogs.length === 0 ? (
              <div className="text-center py-12 text-slate-500 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-200">
                لا توجد أي حركات في السجل حالياً
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right">
                  <thead className="bg-slate-50 dark:bg-slate-900 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-medium rounded-r-lg">الموظف</th>
                      <th className="px-4 py-3 font-medium">نوع الحركة</th>
                      <th className="px-4 py-3 font-medium">الجهاز</th>
                      <th className="px-4 py-3 font-medium rounded-l-lg">التاريخ والوقت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {deviceLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-800 dark:text-slate-200">{log.profiles?.full_name || 'غير معروف'}</div>
                          <div className="text-xs text-slate-500">{log.profiles?.job_number || 'بدون رقم وظيفي'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                            log.action_type === 'ENROLL' 
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                              : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                          }`}>
                            {log.action_type === 'ENROLL' ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                            {log.action_type === 'ENROLL' ? 'توثيق جهاز' : 'إلغاء توثيق'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          {log.device_name}
                        </td>
                        <td className="px-4 py-3 text-slate-500" dir="ltr" style={{ textAlign: 'right' }}>
                          {new Date(log.created_at).toLocaleString('ar-IQ', {
                            year: 'numeric', month: '2-digit', day: '2-digit',
                            hour: '2-digit', minute: '2-digit', second: '2-digit'
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
