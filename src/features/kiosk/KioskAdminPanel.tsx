/**
 * KioskAdminPanel.tsx
 * ─────────────────────────────────────────────────────────────
 * لوحة إدارة أكشاك البصمة البيومترية (Honor Pad X9):
 *  - إنشاء جهاز كشك مرتبط بأقسام/مواقع عمل مسجلة ومحافظة معينة
 *  - توليد وإعادة توليد رموز التفعيل الآمنة KSK-XXXXXXXX
 *  - عرض المشرف الذي قام بتفعيل الجهاز بيومترياً وتاريخ التفعيل
 *  - إيقاف/تنشيط الجهاز وتدوير كلمة سر حساب الخدمة
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Tablet, Plus, RefreshCw, Power, KeyRound, Copy, Loader2,
  MapPin, Check, UserCheck, Trash2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { workLocationService } from '../attendance/services/workLocationService';
import { useGovernorate } from '../../context/GovernorateContext';

interface KioskLocationRef {
  id: string;
  name: string;
}

interface KioskDevice {
  id: string;
  name: string;
  activation_code: string;
  locations: KioskLocationRef[];
  governorate?: string;
  activated_by_supervisor_name?: string | null;
  activated_at?: string | null;
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
}

interface WorkLocationLite {
  id: string;
  name: string;
}

export const KioskAdminPanel = () => {
  const { activeGovernorate } = useGovernorate();
  const [devices, setDevices] = useState<KioskDevice[]>([]);
  const [locations, setLocations] = useState<WorkLocationLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [newPassword, setNewPassword] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const toggleLocation = (id: string) => {
    setSelectedLocationIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: devData }, locs] = await Promise.all([
        supabase.rpc('admin_list_kiosk_devices'),
        workLocationService.getAllLocations().catch(() => [])
      ]);
      const devRes = devData as any;
      if (devRes?.success) setDevices(devRes.devices || []);
      setLocations(((locs as any[]) || []).map(l => ({ id: l.id, name: l.name })));
    } catch (err) {
      console.error('KioskAdminPanel load:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleCreate = async () => {
    if (newName.trim().length < 2) {
      toast.error('أدخل اسماً وصفياً للجهاز (مثال: طرفية مدخل مقر المديرية)');
      return;
    }
    if (selectedLocationIds.length === 0) {
      toast.error('اختر موقع عمل أو قسماً واحداً على الأقل مرتبطاً بهذه الطرفية العامة');
      return;
    }
    setCreating(true);
    try {
      const { data } = await supabase.rpc('admin_create_kiosk_device', {
        p_name: newName.trim(),
        p_work_location_ids: selectedLocationIds,
        p_governorate: activeGovernorate || 'karbala'
      });
      const res = data as any;
      if (!res?.success) throw new Error(res?.message || 'فشل الإنشاء');
      toast.success('تم إنشاء الطرفية العامة بنجاح — رمز التفعيل جاهز في القائمة');
      setNewName('');
      setSelectedLocationIds([]);
      await loadAll();
    } catch (err: any) {
      toast.error(err?.message || 'فشل إنشاء الطرفية العامة');
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (device: KioskDevice) => {
    setBusyId(device.id);
    try {
      const { data } = await supabase.rpc('admin_set_kiosk_active', {
        p_device_id: device.id,
        p_active: !device.is_active
      });
      const res = data as any;
      if (!res?.success) throw new Error(res?.message || 'فشل التغيير');
      await loadAll();
    } catch (err: any) {
      toast.error(err?.message || 'فشل التغيير');
    } finally {
      setBusyId(null);
    }
  };

  const handleRegenerate = async (device: KioskDevice) => {
    if (!window.confirm(`تجديد رمز التفعيل لـ«${device.name}»؟ سيتوقف الرمز القديم فوراً ويتطلب إعادة تفعيل الجهاز.`)) return;
    setBusyId(device.id);
    try {
      const { data } = await supabase.rpc('admin_regenerate_kiosk_code', { p_device_id: device.id });
      const res = data as any;
      if (!res?.success) throw new Error(res?.message || 'فشل التجديد');
      toast.success('تم توليد رمز جديد');
      await loadAll();
    } catch (err: any) {
      toast.error(err?.message || 'فشل التجديد');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (device: KioskDevice) => {
    if (!window.confirm(`هل أنت متأكد من حذف الطرفية «${device.name}» نهائياً؟\nسيتم إبطال رمز التفعيل وإلغاء ارتباط هذه الطرفية بجميع مواقع العمل نهائياً ولا يمكن التراجع عن ذلك.`)) return;
    setBusyId(device.id);
    try {
      const { data, error } = await supabase.rpc('admin_delete_kiosk_device', { p_device_id: device.id });
      if (error) throw error;
      const res = data as any;
      if (!res?.success) throw new Error(res?.message || 'فشل الحذف');
      toast.success('تم حذف الطرفية بنجاح');
      await loadAll();
    } catch (err: any) {
      toast.error(err?.message || 'فشل حذف الطرفية');
    } finally {
      setBusyId(null);
    }
  };

  const handleSetPassword = async () => {
    if (newPassword.length < 8) {
      toast.error('كلمة السر يجب أن تكون 8 أحرف على الأقل');
      return;
    }
    if (!window.confirm('تعيين كلمة سر حساب خدمة الطرفيات العامة؟ ستُبطل جلسات جميع الأجهزة الحالية وتتطلب إعادة تفعيلها.')) return;
    try {
      const { data } = await supabase.rpc('admin_set_kiosk_password', { p_password: newPassword.trim() });
      const res = data as any;
      if (!res?.success) throw new Error(res?.message || 'فشل التعيين');
      toast.success(res.message || 'تم التعيين');
      setNewPassword('');
    } catch (err: any) {
      toast.error(err?.message || 'فشل التعيين');
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard?.writeText(code).then(
      () => toast.success('نُسخ الرمز إلى الحافظة'),
      () => toast.error('تعذر النسخ')
    );
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-5 md:p-6 mb-6 shadow-sm">
      {/* العنوان والوصف */}
      <div className="flex items-center gap-3.5 mb-5">
        <div className="bg-indigo-100 dark:bg-indigo-900/40 p-3 rounded-2xl">
          <Tablet className="text-indigo-600 dark:text-indigo-400" size={24} />
        </div>
        <div>
          <h3 className="font-black text-slate-900 dark:text-white text-lg">طرفيات البصمة البايومترية العامة</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5">
            تثبيت واجهة البصمة البايومترية العامة على الهواتف والطرفيات بالمواقع عبر الرابط <span dir="ltr" className="font-mono font-bold text-indigo-600 dark:text-indigo-400">…/kiosk</span> وتفعيلها مرة واحدة بمصادقة وجه المشرف المخوّل.
          </p>
        </div>
      </div>

      {/* تعيين كلمة سر حساب الخدمة كبديل طوارئ */}
      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-4 mb-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
          <KeyRound size={16} className="shrink-0 text-amber-600 dark:text-amber-400" />
          <span>كلمة سر خدمة البصمة العامة (تُستخدم كبديل طوارئ إذا تعذر التحقق البيومتري من وجه المشرف)</span>
        </div>
        <div className="flex gap-2 shrink-0">
          <input
            dir="ltr"
            type="text"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="كلمة سر (8+ أحرف)"
            className="bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl px-3 py-1.5 text-xs w-48 font-mono focus:outline-none"
          />
          <button
            onClick={handleSetPassword}
            className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl px-4 py-1.5 text-xs font-bold transition-colors shadow-sm"
          >
            تعيين
          </button>
        </div>
      </div>

      {/* إنشاء طرفية جديدة */}
      <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 mb-5 space-y-3.5">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-200">إضافة طرفية عامة جديدة</h4>
          <span className="text-xs text-slate-400 font-bold">المحافظة: {activeGovernorate || 'كربلاء المقدسة'}</span>
        </div>

        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="اسم الطرفية (مثال: طرفية مدخل مقر المديرية)"
          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
        />

        <div>
          <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">
            المواقع / الأقسام التي تخدمها هذه الطرفية العامة (اختر المواقع التابعة للمقر — تقبل التعدد):
          </p>
          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-1">
            {locations.length === 0 ? (
              <span className="text-xs text-slate-400">لا توجد مواقع مسجلة.</span>
            ) : (
              locations.map(loc => {
                const selected = selectedLocationIds.includes(loc.id);
                return (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => toggleLocation(loc.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                      selected
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {selected && <Check size={12} />}
                    {loc.name}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <button
          onClick={handleCreate}
          disabled={creating}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl px-5 py-2.5 text-sm font-extrabold flex items-center justify-center gap-2 transition-colors shadow-md shadow-indigo-600/20"
        >
          {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          إنشاء الطرفية العامة ({selectedLocationIds.length} موقع/قسم)
        </button>
      </div>

      {/* قائمة الطرفيات المسجلة */}
      {loading ? (
        <div className="text-center py-8 text-slate-400 text-sm">
          <Loader2 className="inline animate-spin ml-2 text-indigo-500" size={18} /> جاري تحميل الطرفيات...
        </div>
      ) : devices.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm">
          لا توجد طرفيات مسجلة بعد — أنشئ طرفية لكل موقع عمل.
        </div>
      ) : (
        <div className="space-y-3">
          {devices.map(device => (
            <div
              key={device.id}
              className="border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="font-black text-sm text-slate-900 dark:text-white">{device.name}</span>
                  <span
                    className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                      device.is_active
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-300 dark:border-rose-800'
                    }`}
                  >
                    {device.is_active ? 'نشط' : 'موقوف'}
                  </span>
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 flex items-center gap-1.5 flex-wrap">
                  <MapPin size={13} className="shrink-0 text-emerald-500" />
                  <span>{(device.locations || []).map(loc => loc.name).join(' / ') || 'بلا مواقع محددة'}</span>
                </div>

                {device.activated_by_supervisor_name && (
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-1 flex items-center gap-1.5">
                    <UserCheck size={13} />
                    <span>مفعَّل بيومترياً بواسطة المشرف: {device.activated_by_supervisor_name}</span>
                    {device.activated_at && (
                      <span className="text-slate-400 font-normal">
                        ({new Date(device.activated_at).toLocaleDateString('ar-IQ')} {new Date(device.activated_at).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })})
                      </span>
                    )}
                  </div>
                )}

                {device.last_seen_at && (
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    آخر تواصل: {new Date(device.last_seen_at).toLocaleString('ar-IQ', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>

              {/* أزرار الإجراءات ورمز التفعيل */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => copyCode(device.activation_code)}
                  className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-mono font-bold tracking-wider flex items-center gap-2 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-sm"
                  title="نسخ رمز تفعيل الطرفية العامة"
                  dir="ltr"
                >
                  <Copy size={13} />
                  <span>{device.activation_code}</span>
                </button>

                <button
                  onClick={() => handleRegenerate(device)}
                  disabled={busyId === device.id}
                  className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl p-2 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  title="تجديد رمز التفعيل (إبطال القديم)"
                >
                  <RefreshCw size={15} />
                </button>

                <button
                  onClick={() => handleToggle(device)}
                  disabled={busyId === device.id}
                  className={`rounded-xl p-2 text-white transition-colors shadow-sm ${
                    device.is_active ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                  title={device.is_active ? 'إيقاف مؤقت للطرفية' : 'تنشيط وتشغيل الطرفية'}
                >
                  <Power size={15} />
                </button>

                <button
                  onClick={() => handleDelete(device)}
                  disabled={busyId === device.id}
                  className="rounded-xl p-2 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 hover:bg-rose-600 hover:text-white transition-colors shadow-sm"
                  title="حذف الطرفية نهائياً"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
