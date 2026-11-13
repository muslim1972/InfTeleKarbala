/**
 * KioskPage.tsx
 * ─────────────────────────────────────────────────────────────
 * مدخل كيوسك البصمة البيومترية (/kiosk) للأجهزة اللوحية (Honor Pad X9 وغيرها):
 *  - شاشة تفعيل أولية بمصادقة بيومترية لوجه المشرف المخوّل دون الحاجة لكتابة كلمات سر
 *  - استدعاء RPCs المحصنة لجلب المشرفين المخولين وتوثيق المشرف المفعل في قاعدة البيانات
 *  - الانتقال التلقائي إلى واجهة البصمة الدائمة (KioskCapture)
 *  - حماية الجلسة وإعادة الاتصال التلقائي
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Loader2, ShieldCheck, AlertCircle, CheckCircle2,
  Sparkles, KeyRound, Tablet
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { kioskSupabase } from './kioskService';
import { useCamera } from '../attendance/hooks/useCamera';
import { useFaceDetection } from '../attendance/hooks/useFaceDetection';
import { KioskCapture } from './KioskCapture';
import {
  getStoredActivation, clearStoredActivation, activateKiosk,
  fetchAuthorizedSupervisors, playKioskAudio, toDescriptorArrays,
  signInKioskAccount, type KioskActivation, type KioskSupervisor
} from './kioskService';

const euclidean = (a: Float32Array, b: Float32Array): number => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
};

const KioskActivationScreen = ({ onActivated }: { onActivated: (a: KioskActivation) => void }) => {
  const { videoRef, startCamera, stopCamera } = useCamera();
  const { loadModels, detectFaceInFrame, modelsLoaded } = useFaceDetection();

  const [code, setCode] = useState('');
  const [step, setStep] = useState<'code' | 'supervisor_scan' | 'manual_fallback'>('code');
  const [supervisors, setSupervisors] = useState<KioskSupervisor[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchedSupervisor, setMatchedSupervisor] = useState<KioskSupervisor | null>(null);
  const [manualPassword, setManualPassword] = useState('');

  const loopRunningRef = useRef(false);

  // ── الخطوة 1: التحقق من كود الكشك وجلب المشرفين المخولين ──
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode || cleanCode.length < 5) {
      setError('يرجى إدخال رمز تفعيل الطرفية العامة المعتمد (مثال: KSK-XXXXXXXX)');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const sups = await fetchAuthorizedSupervisors(cleanCode);
      if (sups.length === 0) {
        throw new Error('لا يوجد مشرفون مخولون لهذا الجهاز — يرجى تسجيل بصمة وجه المشرف في النظام أولاً');
      }
      setSupervisors(sups);
      setStep('supervisor_scan');
    } catch (err: any) {
      setError(err?.message || 'رمز التفعيل غير صالح أو الجهاز موقوف');
    } finally {
      setBusy(false);
    }
  };

  // ── الخطوة 2: تشغيل الكاميرا والمطابقة البيومترية لوجه المشرف ──
  useEffect(() => {
    if (step !== 'supervisor_scan') return;

    let cancelled = false;
    loopRunningRef.current = true;

    (async () => {
      try {
        await loadModels();
        if (cancelled) return;
        await startCamera({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
        });
        playKioskAudio('align_face');
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'تعذر تشغيل الكاميرا');
      }
    })();

    return () => {
      cancelled = true;
      loopRunningRef.current = false;
      stopCamera();
    };
  }, [step, loadModels, startCamera, stopCamera]);

  // ── حلقة التعرف على وجه المشرف ──
  useEffect(() => {
    if (step !== 'supervisor_scan' || !modelsLoaded) return;

    let animId: number;
    let lastScan = 0;

    const scanSupervisorLoop = async (now: number) => {
      if (!loopRunningRef.current) return;

      if (now - lastScan >= 200) {
        lastScan = now;
        const video = videoRef.current;
        if (video && video.readyState >= 2 && video.videoWidth > 0) {
          try {
            const { detection } = await detectFaceInFrame(video, []);
            if (detection) {
              const desc: Float32Array = detection.descriptor;
              let found: KioskSupervisor | null = null;
              let minDist = 999;

              for (const sup of supervisors) {
                for (const ref of toDescriptorArrays(sup.face_descriptor)) {
                  const d = euclidean(desc, ref);
                  if (d < minDist) {
                    minDist = d;
                    if (d <= 0.40) {
                      found = sup;
                    }
                  }
                }
              }

              if (found) {
                loopRunningRef.current = false;
                setMatchedSupervisor(found);
                playKioskAudio('supervisor_approved');

                // تفعيل الكشك فورياً وربطه بالمشرف
                try {
                  const cleanCode = code.trim().toUpperCase();
                  const activation = await activateKiosk(cleanCode, found.id);
                  toast.success(`تم تفعيل الطرفية العامة بنجاح بواسطة: ${found.full_name}`);
                  onActivated(activation);
                } catch (actErr: any) {
                  setError(actErr?.message || 'فشل التفعيل السيرفري للطرفية العامة');
                  loopRunningRef.current = true;
                }
                return;
              }
            }
          } catch {
            // استمرار الحلقة
          }
        }
      }

      animId = requestAnimationFrame(scanSupervisorLoop);
    };

    animId = requestAnimationFrame(scanSupervisorLoop);
    return () => cancelAnimationFrame(animId);
  }, [step, modelsLoaded, supervisors, code, detectFaceInFrame, onActivated]);

  // ── التفعيل اليدوي البديل بكلمة السر للمشرف في الحالات الطارئة ──
  const handleManualActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPassword) {
      setError('يرجى إدخال كلمة سر الخدمة');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const cleanCode = code.trim().toUpperCase();
      const activation = await activateKiosk(cleanCode, undefined, undefined, manualPassword);
      toast.success(`تم تفعيل الطرفية العامة: ${activation.device.name}`);
      onActivated(activation);
    } catch (err: any) {
      setError(err?.message || 'فشل التفعيل اليدوي');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-tajawal flex items-center justify-center p-5 select-none" dir="rtl">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-5 shadow-2xl">
        {/* ترويسة الشاشة */}
        <div className="text-center space-y-2">
          <div className="bg-emerald-950/80 border border-emerald-600/50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-950/50">
            <Tablet size={32} className="text-emerald-400" />
          </div>
          <h1 className="text-xl font-black text-white">تفعيل البصمة البايومترية العامة</h1>
          <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
            طرفيات وهواتف المشرفين المعتمدة — مديرية اتصالات ومعلوماتية كربلاء المقدسة
          </p>
        </div>

        {/* ── الخطوة 1: إدخال رمز الكشك ── */}
        {step === 'code' && (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 block">رمز تفعيل الجهاز (من لوحة الإدارة)</label>
              <input
                dir="ltr"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="KSK-XXXXXXXXXX"
                autoFocus
                className="w-full bg-slate-800 border-2 border-slate-700 focus:border-emerald-500 rounded-2xl px-4 py-3.5 text-center font-mono text-lg font-bold tracking-widest text-emerald-400 focus:outline-none transition-colors"
              />
            </div>

            {error && (
              <div className="bg-rose-950/60 border border-rose-700/80 text-rose-200 rounded-2xl p-3 text-xs flex items-start gap-2.5">
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-400" />
                <span className="leading-relaxed font-semibold">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/50"
            >
              {busy ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              {busy ? 'جاري التحقق من الرمز...' : 'متابعة للتحقق البيومتري من المشرف'}
            </button>
          </form>
        )}

        {/* ── الخطوة 2: التحقق البيومتري من وجه المشرف ── */}
        {step === 'supervisor_scan' && (
          <div className="space-y-4 text-center">
            <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-2xl p-3 text-xs text-emerald-300 leading-relaxed font-semibold">
              يرجى وقوف المشرف المخوّل أمام الكاميرا للمصادقة وتفعيل الجهاز تلقائياً.
            </div>

            {/* معاينة الكاميرا البيضاوية لمطابقة المشرف */}
            <div className="relative w-48 h-60 mx-auto rounded-[2.5rem] overflow-hidden border-2 border-emerald-500 shadow-2xl bg-slate-950">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
              <div className="absolute inset-0 border-2 border-emerald-400/40 rounded-[2.5rem] pointer-events-none animate-pulse" />
            </div>

            {matchedSupervisor ? (
              <div className="bg-emerald-950/80 border border-emerald-500 rounded-2xl p-3 text-xs text-emerald-200 font-bold flex items-center justify-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-400" />
                <span>تم التعرف على المشرف: {matchedSupervisor.full_name}</span>
              </div>
            ) : (
              <div className="text-xs text-slate-400 flex items-center justify-center gap-2">
                <Loader2 size={14} className="animate-spin text-emerald-400" />
                <span>جاري مسح ملامح وجه المشرف...</span>
              </div>
            )}

            {error && (
              <div className="bg-rose-950/60 border border-rose-700/80 text-rose-200 rounded-2xl p-3 text-xs flex items-start gap-2.5 text-right">
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-400" />
                <span className="leading-relaxed font-semibold">{error}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  loopRunningRef.current = false;
                  stopCamera();
                  setStep('code');
                  setError(null);
                }}
                className="text-xs text-slate-400 hover:text-white underline font-bold"
              >
                تغيير رمز التفعيل
              </button>

              <button
                type="button"
                onClick={() => {
                  loopRunningRef.current = false;
                  stopCamera();
                  setStep('manual_fallback');
                  setError(null);
                }}
                className="text-xs text-amber-400 hover:text-amber-300 underline font-bold flex items-center gap-1"
              >
                <KeyRound size={12} />
                تفعيل بكلمة السر (يدوي)
              </button>
            </div>
          </div>
        )}

        {/* ── الخطوة البديلة: التفعيل اليدوي بكلمة السر ── */}
        {step === 'manual_fallback' && (
          <form onSubmit={handleManualActivate} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 block">كلمة سر خدمة البصمة العامة</label>
              <input
                dir="ltr"
                type="password"
                value={manualPassword}
                onChange={(e) => setManualPassword(e.target.value)}
                placeholder="كلمة السر المعتمدة"
                autoFocus
                className="w-full bg-slate-800 border-2 border-slate-700 focus:border-amber-500 rounded-2xl px-4 py-3 text-center text-sm font-bold text-white focus:outline-none"
              />
            </div>

            {error && (
              <div className="bg-rose-950/60 border border-rose-700/80 text-rose-200 rounded-2xl p-3 text-xs flex items-start gap-2.5">
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-400" />
                <span className="leading-relaxed font-semibold">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-3.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
              تفعيل الجهاز يدوياً
            </button>

            <button
              type="button"
              onClick={() => {
                setStep('supervisor_scan');
                setError(null);
              }}
              className="w-full text-center text-xs text-slate-400 hover:text-white underline pt-1 font-bold"
            >
              العودة للتحقق البيومتري من الوجه
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export const KioskPage = () => {
  const [activation, setActivation] = useState<KioskActivation | null>(() => getStoredActivation());
  const [checking, setChecking] = useState(true);

  // التحقق من صحة الجلسة المحلية أو استعادتها تلقائياً لحساب خدمة الكيوسك
  useEffect(() => {
    if (!activation) {
      setChecking(false);
      return;
    }
    (async () => {
      try {
        const { data } = await kioskSupabase.auth.getSession();
        if (!data?.session) {
          // استعادة جلسة الخدمة تلقائياً في الخلفية إن انقطعت
          try {
            await signInKioskAccount();
          } catch {
            clearStoredActivation();
            setActivation(null);
          }
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
    kioskSupabase.auth.signOut().catch(() => {});
    setActivation(null);
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-950 text-white font-tajawal flex items-center justify-center" dir="rtl">
        <Loader2 size={36} className="animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!activation) return <KioskActivationScreen onActivated={setActivation} />;

  return <KioskCapture activation={activation} onDeactivate={handleDeactivate} />;
};
