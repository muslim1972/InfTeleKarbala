/**
 * KioskPage.tsx
 * ─────────────────────────────────────────────────────────────
 * مدخل كيوسك البصمة (/kiosk) — نسخة عامة بلا تسجيل دخول موظف:
 *  - جهاز غير مفعل: شاشة تفعيل (رمز الجهاز + حساب خدمة الكيوسك) لمسؤول الإدارة مرة واحدة
 *  - جهاز مفعل: واجهة البصمة البيضوية الدائمة (KioskCapture)
 * المسار عام في App.tsx — خارج ProtectedRoute — ويخفي العناصر العامة للتطبيق.
 */

import { useState, useEffect, useCallback } from 'react';
import { Fingerprint, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { KioskCapture } from './KioskCapture';
import {
  getStoredActivation, clearStoredActivation, activateKiosk,
  type KioskActivation
} from './kioskService';

const KioskActivationScreen = ({ onActivated }: { onActivated: (a: KioskActivation) => void }) => {
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !email.trim() || !password) {
      setError('أدخل رمز التفعيل وبيانات حساب الخدمة كاملة');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const activation = await activateKiosk(code, email, password);
      toast.success(`تم تفعيل الكيوسك: ${activation.device.name}`);
      onActivated(activation);
    } catch (err: any) {
      setError(err?.message || 'فشل التفعيل');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-tajawal flex items-center justify-center p-5" dir="rtl">
      <form onSubmit={handleActivate} className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl">
        <div className="text-center space-y-2">
          <div className="bg-emerald-900/40 w-14 h-14 rounded-full flex items-center justify-center mx-auto">
            <Fingerprint size={28} className="text-emerald-400" />
          </div>
          <h1 className="text-lg font-extrabold">تفعيل كيوسك البصمة</h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            خطوة لمرة واحدة لمسؤول الإدارة: أدخل رمز تفعيل الجهاز (من لوحة إدارة الكيوسكات)
            وبيانات حساب خدمة الكيوسك.
          </p>
        </div>

        <div className="space-y-3">
          <input
            dir="ltr"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="KSK-XXXXXXXX"
            className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-center font-mono tracking-widest focus:outline-none focus:border-emerald-500"
          />
          <input
            dir="ltr"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="بريد حساب الخدمة"
            autoComplete="username"
            className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500"
          />
          <input
            dir="ltr"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="كلمة سر حساب الخدمة"
            autoComplete="current-password"
            className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500"
          />
        </div>

        {error && (
          <div className="bg-rose-900/40 border border-rose-700 text-rose-200 rounded-xl p-3 text-xs flex items-start gap-2">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-xl font-extrabold flex items-center justify-center gap-2 transition-colors"
        >
          {busy ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
          {busy ? 'جاري التفعيل...' : 'تفعيل الجهاز'}
        </button>
      </form>
    </div>
  );
};

export const KioskPage = () => {
  const [activation, setActivation] = useState<KioskActivation | null>(() => getStoredActivation());
  const [checking, setChecking] = useState(true);

  // التحقق من أن الجلسة المحلية ما تزال صالحة (إن أبطل الأدمن كلمة السر تُعاد الشاشة للتفعيل)
  useEffect(() => {
    if (!activation) {
      setChecking(false);
      return;
    }
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data?.session) {
          // الجلسة فقدت (إعادة تشغيل بعد انتهاء صلاحية طويلة) — نعيد التفعيل
          clearStoredActivation();
          setActivation(null);
        }
      } catch {
        clearStoredActivation();
        setActivation(null);
      } finally {
        setChecking(false);
      }
    })();
  }, [activation?.code]);

  const handleDeactivate = useCallback(() => {
    clearStoredActivation();
    supabase.auth.signOut().catch(() => {});
    setActivation(null);
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-950 text-white font-tajawal flex items-center justify-center" dir="rtl">
        <Loader2 size={32} className="animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!activation) return <KioskActivationScreen onActivated={setActivation} />;

  return <KioskCapture activation={activation} onDeactivate={handleDeactivate} />;
};
