/**
 * KioskAdminPanel.tsx
 * ─────────────────────────────────────────────────────────────
 * لوحة إدارة كيوسكات البصمة (للمشرفين المميزين):
 *  - إنشاء جهاز كيوسك مرتبط بموقع عمل مسجل → يولد رمز تفعيل
 *  - سرد الأجهزة مع آخر ظهور وحالة النشاط
 *  - إيقاف/تفعيل + تجديد الرمز (يبطل الرمز القديم فوراً)
 *  - تعيين/تدوير كلمة سر حساب خدمة الكيوسك (تُخزن مشفرة فقط وتُبطل الجلسات)
 * التعليمات الإرشادية للمسؤول مضمّنة في الواجهة.
 */

import { useState, useEffect, useCallback } from 'react';
import { MonitorSmartphone, Plus, RefreshCw, Power, KeyRound, Copy, Loader2, MapPin, Check } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { workLocationService } from '../attendance/services/workLocationService';

interface KioskLocationRef {
  id: string;
  name: string;
}

interface KioskDevice {
  id: string;
  name: string;
  activation_code: string;
  locations: KioskLocationRef[];
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
}

interface WorkLocationLite {
  id: string;
  name: string;
}

export const KioskAdminPanel = () => {
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

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleCreate = async () => {
    if (newName.trim().length < 2) {
      toast.error('أدخل اسماً وصفياً للجهاز (مثال: كيوسك مجمع الحر)');
      return;
    }
    if (selectedLocationIds.length === 0) {
      toast.error('اختر قسماً/وحدة واحدة على الأقل مرتبطة بالجهاز');
      return;
    }
    setCreating(true);
    try {
      const { data } = await supabase.rpc('admin_create_kiosk_device', {
        p_name: newName.trim(),
        p_work_location_ids: selectedLocationIds
      });
      const res = data as any;
      if (!res?.success) throw new Error(res?.message || 'فشل الإنشاء');
      toast.success('تم إنشاء الكيوسك — رمز التفعيل جاهز في القائمة');
      setNewName('');
      setSelectedLocationIds([]);
      await loadAll();
    } catch (err: any) {
      toast.error(err?.message || 'فشل إنشاء الكيوسك');
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (device: KioskDevice) => {
    setBusyId(device.id);
    try {
      const { data } = await supabase.rpc('admin_set_kiosk_active', { p_device_id: device.id, p_active: !device.is_active });
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

  const handleSetPassword = async () => {
    if (newPassword.length < 8) {
      toast.error('كلمة السر 8 أحرف على الأقل');
      return;
    }
    if (!window.confirm('تعيين كلمة سر حساب خدمة الكيوسك؟ ستُبطل جلسات جميع الأجهزة الحالية وتتطلب إعادة تفعيلها.')) return;
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
      () => toast.success('نُسخ الرمز'),
      () => toast.error('تعذر النسخ')
    );
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-indigo-100 dark:bg-indigo-900/40 p-2.5 rounded-xl">
          <MonitorSmartphone className="text-indigo-600 dark:text-indigo-400" size={22} />
        </div>
        <div>
          <h3 className="font-extrabold text-slate-900 dark:text-white">كيوسكات البصمة (الأجهزة اللوحية)</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5">
            لكل موقع عمل جهاز لوحي يثبَّت عليه التطبيق من الرابط <span dir="ltr" className="font-mono">…/kiosk</span> (إضافة إلى الشاشة الرئيسية)
            ثم يُفعَّل مرة واحدة برمز الجهاز وبيانات حساب الخدمة. عيّن كلمة سر الخدمة أولاً قبل تسليم أي جهاز.
          </p>
        </div>
      </div>

      {/* تعيين كلمة سر حساب الخدمة */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 mb-4 flex flex-col md:flex-row md:items-center gap-2">
        <div className="flex-1 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
          <KeyRound size={14} className="shrink-0" />
          كلمة سر حساب خدمة الكيوسك (واحدة لجميع الأجهزة — تُدخل عند تفعيل كل تابليت)
        </div>
        <div className="flex gap-2">
          <input
            dir="ltr"
            type="text"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="كلمة سر (8+ أحرف)"
            className="bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-lg px-3 py-1.5 text-xs w-44"
          />
          <button
            onClick={handleSetPassword}
            className="bg-amber-500 hover:bg-amber-600 text-white rounded-lg px-3 py-1.5 text-xs font-bold"
          >
            تعيين
          </button>
        </div>
      </div>

      {/* إنشاء جهاز جديد */}
      <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 mb-4 space-y-3">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="اسم الجهاز (مثال: كيوسك مجمع اتصالات الحر)"
          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm"
        />
        <div>
          <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">
            الأقسام / الوحدات المرتبطة بالجهاز (اختر كل ما يخدمه هذا الكيوسك — يقبل التعدد)
          </p>
          <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto">
            {locations.length === 0 && (
              <span className="text-xs text-slate-400">لا توجد مواقع عمل مسجلة — أضفها أولاً من تبويب مواقع سياج العمل.</span>
            )}
            {locations.map(loc => {
              const selected = selectedLocationIds.includes(loc.id);
              return (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => toggleLocation(loc.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                    selected
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {selected && <Check size={12} />}
                  {loc.name}
                </button>
              );
            })}
          </div>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl px-4 py-2.5 text-sm font-bold flex items-center justify-center gap-2"
        >
          {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          إنشاء كيوسك ({selectedLocationIds.length} قسم/وحدة)
        </button>
      </div>

      {/* القائمة */}
      {loading ? (
        <div className="text-center py-6 text-slate-400 text-sm"><Loader2 className="inline animate-spin ml-2" size={16} /> جاري التحميل...</div>
      ) : devices.length === 0 ? (
        <div className="text-center py-6 text-slate-400 text-sm">لا توجد كيوسكات مسجلة بعد — أنشئ جهازاً لكل موقع عمل.</div>
      ) : (
        <div className="space-y-3">
          {devices.map(device => (
            <div key={device.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-slate-900 dark:text-white">{device.name}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${device.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400'}`}>
                    {device.is_active ? 'نشط' : 'موقوف'}
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                  <MapPin size={12} className="shrink-0" />
                  {(device.locations || []).map(loc => loc.name).join(' / ') || 'بلا أقسام مرتبطة'}
                </div>
                {device.last_seen_at && (
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    آخر ظهور: {new Date(device.last_seen_at).toLocaleString('ar-IQ', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => copyCode(device.activation_code)}
                  className="bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold tracking-wider flex items-center gap-1.5 hover:bg-slate-200 dark:hover:bg-slate-700"
                  title="نسخ رمز التفعيل"
                  dir="ltr"
                >
                  <Copy size={12} />
                  {device.activation_code}
                </button>
                <button
                  onClick={() => handleRegenerate(device)}
                  disabled={busyId === device.id}
                  className="bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg p-2 hover:bg-slate-200 dark:hover:bg-slate-700"
                  title="تجديد الرمز"
                >
                  <RefreshCw size={14} />
                </button>
                <button
                  onClick={() => handleToggle(device)}
                  disabled={busyId === device.id}
                  className={`rounded-lg p-2 text-white ${device.is_active ? 'bg-rose-500 hover:bg-rose-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                  title={device.is_active ? 'إيقاف الجهاز' : 'تنشيط الجهاز'}
                >
                  <Power size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
