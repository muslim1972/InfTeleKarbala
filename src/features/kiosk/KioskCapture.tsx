/**
 * KioskCapture.tsx
 * ─────────────────────────────────────────────────────────────
 * واجهة البصمة الدائمة للكيوسك: شكل بيضوي مفتوح دائماً لالتقاط الوجه،
 * تعرف 1:N على موظفي المديرية بنفس مكتبة وعتبات التطبيق الرئيسي،
 * تحقق حيوي (ثبات/رمش) ثم تثبيت البصمة تلقائياً وعرض النتيجة.
 * الحالات: بحث → تحقق → معالجة → نتيجة/اعتراض → عودة إلى البحث.
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { LogOut, ArrowRight, UserX, CheckCircle2, AlertTriangle, Loader2, CameraOff, Clock3 } from 'lucide-react';
import { useCamera } from '../attendance/hooks/useCamera';
import { useFaceDetection } from '../attendance/hooks/useFaceDetection';
import { resolvePunchRequestContext } from '../attendance/services/attendanceRequestEngine';
import { attendanceRecordService } from '../attendance/services/attendanceService';
import { uploadSnapshot } from '../attendance/utils/snapshotStorage';
import { getServerNow } from '../attendance/services/serverTimeService';
import type { AttendanceRecord } from '../attendance/types';
import {
  buildKioskLocationText, toDescriptorArrays,
  type KioskActivation, type KioskEmployee, fetchKioskEmployees
} from './kioskService';

// ── عتبات المطابقة — مطابقة للتطبيق الرئيسي (AttendanceCheckInOut) ──
const AWARENESS_DISTANCE = 0.45;   // عتبة الوعي بالوجه
const PERFECT_DISTANCE = 0.38;     // مطابقة تامة + 3 إطارات
const GOOD_BLINK_DISTANCE = 0.42;  // مطابقة جيدة + رمشة عين
const GOOD_HOLD_DISTANCE = 0.45;   // مطابقة جيدة + 15 إطار ثبات
const PERFECT_FRAMES_NEEDED = 3;
const HOLD_FRAMES_NEEDED = 15;
const EAR_BLINK_THRESHOLD = 0.28;
const AMBIGUITY_GAP = 0.03;        // فرق ضئيل بين أفضل مطابقتين = غموض

type Mode = 'searching' | 'verifying' | 'processing' | 'result' | 'objection';

interface ResultInfo {
  name: string;
  time: string;
  punchType: string;
  scheduleLine: string;
  warnings: string[];
  approved: boolean;
}

interface KioskCaptureProps {
  activation: KioskActivation;
  onDeactivate: () => void;
}

const euclidean = (a: Float32Array, b: Float32Array): number => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
};

const computeEAR = (landmarks: any): number => {
  const earOf = (eye: any[]) => {
    const v1 = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
    const v2 = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
    const h = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y);
    return (v1 + v2) / (2.0 * h);
  };
  const leftEye = landmarks.getLeftEye();
  const rightEye = landmarks.getRightEye();
  return (earOf(leftEye) + earOf(rightEye)) / 2.0;
};

const formatClock = (iso: string | null | undefined): string => {
  const d = iso ? new Date(iso) : getServerNow();
  return d.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
};

const todayStr = () => {
  const d = getServerNow();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** تحديد نوع البصمة المثبتة بمقارنة خانات السجل قبل/بعد */
const detectPunchType = (prev: AttendanceRecord | null | undefined, next: AttendanceRecord | null | undefined): string => {
  if (!next) return 'بصمة مسجلة';
  const slots: [string, string][] = [
    ['check_in', 'بصمة حضور — بداية الدوام'],
    ['time_leave_out', 'بصمة خروج زمني'],
    ['time_leave_return', 'بصمة عودة من الزمني'],
    ['time_leave_out_2', 'بصمة خروج زمني (ثانية)'],
    ['time_leave_return_2', 'بصمة عودة من الزمني (ثانية)'],
    ['check_out', 'بصمة انصراف — نهاية الدوام']
  ];
  for (const [key, label] of slots) {
    const before = prev ? (prev as any)[key] : null;
    const after = (next as any)[key];
    if (after && after !== before) return label;
  }
  return 'بصمة مسجلة';
};

const describeSchedule = (emp: KioskEmployee): string => {
  if (emp.today_rest) return 'يوم راحة — خارج دوامه الرسمي';
  const shiftLabel = emp.today_is_night ? 'دوام ليلي' : emp.today_is_evening ? 'دوام مسائي' : 'دوام صباحي';
  const start = emp.today_start ? emp.today_start.substring(0, 5) : '—';
  const end = emp.today_end ? emp.today_end.substring(0, 5) : '—';
  return `${shiftLabel} (${start} - ${end})`;
};

export const KioskCapture = ({ activation, onDeactivate }: KioskCaptureProps) => {
  const { videoRef, startCamera, stopCamera, captureFrame } = useCamera();
  const { loadModels, detectFaceInFrame, modelsLoaded } = useFaceDetection();

  const [employees, setEmployees] = useState<KioskEmployee[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('searching');
  const [hint, setHint] = useState('ضع وجهك داخل الإطار البيضاوي');
  const [result, setResult] = useState<ResultInfo | null>(null);
  const [objection, setObjection] = useState<string | null>(null);
  const [clock, setClock] = useState(formatClock(null));
  const [debugInfo, setDebugInfo] = useState('');

  const modeRef = useRef<Mode>('searching');
  const employeesRef = useRef<KioskEmployee[]>([]);
  const candidateRef = useRef<KioskEmployee | null>(null);
  const matchedFramesRef = useRef(0);
  const perfectFramesRef = useRef(0);
  const blinkedRef = useRef(false);
  const unknownFramesRef = useRef(0);
  const lastPunchAtRef = useRef<Record<string, number>>({});
  const runningRef = useRef(true);

  const setModeSafe = (m: Mode) => { modeRef.current = m; setMode(m); };

  // ── تحميل موظفي البصمة (مع إعادة دورية لالتقاط التسجيلات الجديدة) ──
  const refreshEmployees = useCallback(async () => {
    try {
      const list = await fetchKioskEmployees(activation.code);
      employeesRef.current = list;
      setEmployees(list);
      setLoadError(null);
    } catch (err: any) {
      const msg = err?.message || 'خطأ غير معروف';
      // جلسة منتهية أو رمز موقوف → العودة لشاشة التفعيل
      if (/JWT|session|log ?in|رمز التفعيل|موقوف/i.test(msg)) {
        onDeactivate();
        return;
      }
      setLoadError(msg);
    }
  }, [activation.code, onDeactivate]);

  useEffect(() => {
    refreshEmployees();
    const interval = window.setInterval(refreshEmployees, 10 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [refreshEmployees]);

  // ── ساعة الشاشة (عرض حي) ──
  useEffect(() => {
    const t = window.setInterval(() => setClock(formatClock(null)), 15000);
    return () => window.clearInterval(t);
  }, []);

  // ── الكاميرا والموديلات ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadModels();
        if (cancelled) return;
        await startCamera({ video: { facingMode: 'user' } });
      } catch (err: any) {
        if (!cancelled) setObjection(err?.message || 'تعذر فتح الكاميرا');
      }
    })();
    return () => { cancelled = true; stopCamera(); };
  }, [loadModels, startCamera, stopCamera]);

  // ── الشاشة لا تنام أثناء وضع الالتقاط (Wake Lock) ──
  useEffect(() => {
    let lock: any = null;
    const acquire = async () => {
      try {
        if ('wakeLock' in navigator) lock = await (navigator as any).wakeLock.request('screen');
      } catch { /* غير مدعوم — لا شيء */ }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') acquire(); };
    acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      try { lock?.release?.(); } catch { /* تم تحريرها */ }
    };
  }, []);

  // ── تثبيت البصمة للمطابَق ──
  const processPunch = useCallback(async (emp: KioskEmployee) => {
    setModeSafe('processing');
    setHint('جاري تثبيت البصمة...');
    try {
      // منع الازدواج المحلي: بصمتان خلال 30 ثانية لنفس الموظف
      const lastAt = lastPunchAtRef.current[emp.id] || 0;
      if (Date.now() - lastAt < 30 * 1000) {
        throw new Error('تم تثبيت بصمة لك للتو — انتظر قليلاً قبل المحاولة مجدداً');
      }

      const locationText = buildKioskLocationText(activation.device);
      const today = todayStr();
      const leaveCtx = await resolvePunchRequestContext(emp.id, today);
      const prevRecord = await attendanceRecordService.getTodayByEmployeeId(emp.id);

      // يوم إجازة صارم: نثبت تلقائياً مع تجاوز التحذير (يظهر كاعتراض في النتيجة)
      const bypass = leaveCtx.strictDayLeave;

      const canvas = document.createElement('canvas');
      let snapshotUrl: string | undefined;
      try {
        const base64 = await captureFrame(canvas);
        const snap = await uploadSnapshot(base64, 'kiosk');
        snapshotUrl = snap.url ?? undefined;
      } catch { /* اللقطة غير حرجة — البصمة تثبت بدونها */ }

      const warnings: string[] = [];
      if (leaveCtx.dayLeave && leaveCtx.strictDayLeave) {
        warnings.push(`⚠ بُصمت في يوم إجازة (${leaveCtx.dayLeave.label}) — أُبلغ المشرفون وستُراجع الساعات إدارياً`);
      } else if (leaveCtx.dayLeave) {
        warnings.push(`دوام في يوم إجازة رسمية (${leaveCtx.dayLeave.label}) — وضع طبيعي ومتوقع`);
      }
      if (leaveCtx.pendingRequests.length > 0) {
        warnings.push('لديك طلب إجازة قيد المراجعة — البصمة سُجلت بشكل طبيعي وأُبلغ المشرفون');
      }

      const record = await attendanceRecordService.registerPunch(
        emp.id,
        locationText,
        `kiosk-${activation.code.replace('KSK-', '')}`,
        false,
        snapshotUrl,
        `بصمة كيوسك — ${activation.device.name}`,
        bypass,
        undefined,
        { skipDeviceCheck: true }
      );

      lastPunchAtRef.current[emp.id] = Date.now();

      const punchType = detectPunchType(prevRecord, record);
      const newTime = (() => {
        for (const key of ['check_in', 'time_leave_out', 'time_leave_return', 'time_leave_out_2', 'time_leave_return_2', 'check_out']) {
          const before = prevRecord ? (prevRecord as any)[key] : null;
          const after = (record as any)[key];
          if (after && after !== before) return formatClock(after);
        }
        return formatClock(null);
      })();

      setResult({
        name: emp.full_name,
        time: newTime,
        punchType,
        scheduleLine: describeSchedule(emp),
        warnings,
        approved: true
      });
      setModeSafe('result');
    } catch (err: any) {
      setObjection(err?.message || 'تعذر تثبيت البصمة — حاول مجدداً');
      setModeSafe('objection');
    }
  }, [activation, captureFrame]);

  // ── حلقة الكشف والمطابقة 1:N ──
  useEffect(() => {
    let timer: number | undefined;
    const loop = async () => {
      if (!runningRef.current) return;
      const currentMode = modeRef.current;

      if ((currentMode === 'searching' || currentMode === 'verifying') && modelsLoaded) {
        try {
          const video = videoRef.current;
          if (video && video.readyState >= 2 && video.videoWidth > 0) {
            // كشف واحد لكل إطار ثم مطابقة محلية ضد كل الموظفين
            let dbg = `M:${currentMode} L:${modelsLoaded} vW:${video.videoWidth}x${video.videoHeight} ready:${video.readyState}`; const { detection } = await detectFaceInFrame(video, []); if (!detection) { dbg += ` Det:NULL`; } else { dbg += ` Det:YES(${Math.round(detection.detection.box.width)}x${Math.round(detection.detection.box.height)})`; } setDebugInfo(dbg);

            if (!detection) {
              if (currentMode === 'verifying') {
                candidateRef.current = null;
                matchedFramesRef.current = 0;
                perfectFramesRef.current = 0;
                blinkedRef.current = false;
                setModeSafe('searching');
              }
              unknownFramesRef.current = 0;
              setHint('ضع وجهك داخل الإطار البيضاوي');
            } else {
              const descriptor: Float32Array = detection.descriptor;
              const ear = computeEAR(detection.landmarks);

              let best: { emp: KioskEmployee; dist: number } | null = null;
              let secondBest: { emp: KioskEmployee; dist: number } | null = null;
              
              if (window.location.search.includes('debug=1')) {
                const box = detection.detection.box;
                console.log(`[Kiosk Debug] Face at ${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}x${Math.round(box.height)}`);
              }

              for (const emp of employeesRef.current) {
                let minDist = 999;
                for (const ref of toDescriptorArrays(emp.face_descriptor)) {
                  const d = Math.abs(euclidean(descriptor, ref)); // Math.abs for safety
                  if (d < minDist) minDist = d;
                }
                
                if (!best || minDist < best.dist) {
                  secondBest = best;
                  best = { emp, dist: minDist };
                } else if (!secondBest || minDist < secondBest.dist) {
                  secondBest = { emp, dist: minDist };
                }
              }

              if (currentMode === 'searching') {
                if (!best || best.dist > AWARENESS_DISTANCE) {
                  // وجه غير معروف: تلميح مستقر بعد ~2 ثانية من الظهور
                  unknownFramesRef.current += 1;
                  if (unknownFramesRef.current > 8) setHint('وجه غير مطابق للسجلات — يرجى مراجعة الإدارة');
                  else setHint('جاري التعرف على الوجه...');
                } else if (secondBest && (secondBest.dist - best.dist) < AMBIGUITY_GAP) {
                  // الغموض: تم إيجاد حسابين بوجوه متشابهة جداً
                  unknownFramesRef.current = 0;
                  setHint(`تطابق مع حسابين (${best.emp.full_name} و ${secondBest.emp.full_name}) — راجع الإدارة`);
                } else {
                  // مطابقة مرشحة → بدء التحقق الحيوي
                  unknownFramesRef.current = 0;
                  candidateRef.current = best.emp;
                  matchedFramesRef.current = 1;
                  perfectFramesRef.current = best.dist <= PERFECT_DISTANCE ? 1 : 0;
                  blinkedRef.current = ear < EAR_BLINK_THRESHOLD;
                  setModeSafe('verifying');
                  setHint(best.dist <= PERFECT_DISTANCE ? 'جاري التحقق...' : 'ارمش بعينيك للتأكيد');
                }
              } else if (currentMode === 'verifying') {
                const candidate = candidateRef.current;
                if (!candidate) {
                  setModeSafe('searching');
                } else {
                  let dist = 999;
                  for (const ref of toDescriptorArrays(candidate.face_descriptor)) {
                    const d = euclidean(descriptor, ref);
                    if (d < dist) dist = d;
                  }

                  if (dist > AWARENESS_DISTANCE + 0.05) {
                    // فقد المرشح — العودة للبحث
                    candidateRef.current = null;
                    matchedFramesRef.current = 0;
                    perfectFramesRef.current = 0;
                    blinkedRef.current = false;
                    setModeSafe('searching');
                    setHint('ضع وجهك داخل الإطار البيضاوي');
                  } else {
                    matchedFramesRef.current += 1;
                    if (ear < EAR_BLINK_THRESHOLD) blinkedRef.current = true;
                    if (dist <= PERFECT_DISTANCE) perfectFramesRef.current += 1;
                    else perfectFramesRef.current = 0;

                    const isPerfect = perfectFramesRef.current >= PERFECT_FRAMES_NEEDED;
                    const isBlink = dist <= GOOD_BLINK_DISTANCE && blinkedRef.current;
                    const isHold = dist <= GOOD_HOLD_DISTANCE && matchedFramesRef.current >= HOLD_FRAMES_NEEDED;

                    if (isPerfect || isBlink || isHold) {
                      await processPunch(candidate);
                      return;
                    }
                    setHint(blinkedRef.current ? 'لا تتحرك — جاري التحقق...' : 'ارمش بعينيك للتأكيد');
                  }
                }
              }
            }
          }
        } catch (err: any) { setDebugInfo(`Err: ${err.message}`);
          console.warn('[Kiosk] detection error:', err);
        }
      }

      timer = window.setTimeout(loop, 350);
    };

    loop();
    return () => { runningRef.current = false; if (timer) window.clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelsLoaded, processPunch]);

  // إعادة تشغيل الحلقة عند العودة من النتيجة/الاعتراض
  useEffect(() => {
    if (mode === 'searching') {
      runningRef.current = true;
      setHint('ضع وجهك داخل الإطار البيضاوي');
    }
  }, [mode]);

  const backToSearch = () => {
    setResult(null);
    setObjection(null);
    candidateRef.current = null;
    matchedFramesRef.current = 0;
    perfectFramesRef.current = 0;
    blinkedRef.current = false;
    setModeSafe('searching');
  };

  const isResultOrObjection = mode === 'result' || mode === 'objection';

  return (
    <div className="fixed inset-0 bg-slate-950 text-white font-tajawal overflow-hidden select-none" dir="rtl">
      {/* زر الإغلاق — ينهي وضع الكيوسك ويعود لواجهة التابليت */}
      <button
        onClick={() => {
          window.close();
          window.setTimeout(() => {
            alert('لإغلاق الكيوسك واستخدام التابليت: استخدم إيماءة النظام (الرجوع/الرئيسية) أو أغلق التطبيق من شريط المهام.');
          }, 400);
        }}
        className="fixed top-3 left-3 z-[60] bg-slate-800/80 hover:bg-red-600 border border-slate-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors shadow-lg"
        title="إغلاق وضع البصمة"
      >
        <LogOut size={18} />
        إغلاق
      </button>

      {/* اسم الجهاز والأقسام المرتبطة — يثبت هوية الكيوسك للموظفين */}
      <div className="fixed top-3 right-3 z-[60] bg-slate-800/80 border border-slate-600 rounded-xl px-4 py-2 text-xs leading-relaxed shadow-lg max-w-[60%]">
        <div className="font-bold text-emerald-400">{activation.device.name}</div>
        <div className="text-slate-300 truncate">
          {(activation.device.locations || []).map(loc => loc.name).join(' / ') || 'أقسام غير محددة'}
        </div>
      </div>

      {/* ── الشاشة الأساسية: الفيديو والشكل البيضوي ── */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-full max-w-[420px] aspect-[3/4] max-h-[80vh]">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover rounded-[3rem] scale-x-[-1]"
          />
          {/* قناع بيضوي — أخضر عند التحقق/المعالجة */}
          <svg viewBox="0 0 300 360" className="absolute inset-0 w-full h-full pointer-events-none">
            <defs>
              <mask id="kioskOvalMask">
                <rect width="300" height="360" fill="white" />
                <ellipse cx="150" cy="180" rx="88" ry="118" fill="black" />
              </mask>
            </defs>
            <rect width="300" height="360" fill="rgba(2,6,23,0.72)" mask="url(#kioskOvalMask)" />
            <ellipse
              cx="150" cy="180" rx="88" ry="118" fill="none"
              stroke={mode === 'verifying' || mode === 'processing' || mode === 'result' ? '#22c55e' : '#ffffff'}
              strokeWidth="3"
              strokeDasharray={mode === 'searching' || mode === 'objection' ? '10 8' : 'none'}
              className="transition-all duration-300"
            />
          </svg>
        </div>
      </div>

      {/* ── شريط التلميح السفلي ── */}
      <div className="absolute bottom-0 inset-x-0 pb-8 pt-6 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent">
        {!isResultOrObjection ? (
          <div className="text-center px-6 space-y-3">
            <p className={`text-lg font-bold ${mode === 'verifying' ? 'text-emerald-400' : 'text-white'}`}>{hint}</p>
            <div className="flex items-center justify-center gap-2 text-slate-400 text-sm">
              <Clock3 size={15} />
              <span>{clock}</span>
              {mode === 'processing' && <Loader2 size={15} className="animate-spin text-amber-400" />}
            </div>
            {window.location.search.includes('debug=1') && (<div className="text-[10px] text-amber-500 font-mono mt-2 opacity-80 break-words">{debugInfo}</div>)}
              {loadError && (
              <div className="mx-auto max-w-sm bg-amber-900/40 border border-amber-700 text-amber-200 rounded-xl p-3 text-xs">
                تعذر تحديث قائمة الموظفين: {loadError}
                <button onClick={refreshEmployees} className="underline mr-2 font-bold">إعادة المحاولة</button>
              </div>
            )}
          </div>
        ) : mode === 'result' && result ? (
          /* ── بطاقة النتيجة ── */
          <div className="px-5 pb-2">
            <div className="mx-auto max-w-md bg-slate-900 border border-emerald-600/60 rounded-2xl p-5 shadow-2xl space-y-3">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-900/50 p-2.5 rounded-full"><CheckCircle2 className="text-emerald-400" size={26} /></div>
                <div className="flex-1">
                  <h3 className="text-xl font-extrabold">{result.name}</h3>
                  <p className="text-sm text-emerald-400 font-bold">{result.punchType}</p>
                </div>
                <div className="text-left">
                  <div className="text-2xl font-black text-emerald-400" dir="ltr">{result.time}</div>
                  <div className="text-[10px] text-slate-400">وقت التثبيت</div>
                </div>
              </div>
              <div className="bg-slate-800/70 rounded-xl p-3 text-xs text-slate-300 space-y-1">
                <p><span className="text-slate-500">الدوام:</span> {result.scheduleLine}</p>
                {result.warnings.map((w, i) => (
                  <p key={i} className="text-amber-300 font-bold">{w}</p>
                ))}
              </div>
              <button
                onClick={backToSearch}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-extrabold text-base flex items-center justify-center gap-2 transition-colors shadow-lg"
              >
                <ArrowRight size={20} />
                العودة
              </button>
            </div>
          </div>
        ) : (
          /* ── بطاقة الاعتراض ── */
          <div className="px-5 pb-2">
            <div className="mx-auto max-w-md bg-slate-900 border border-rose-600/60 rounded-2xl p-5 shadow-2xl space-y-3">
              <div className="flex items-center gap-3">
                <div className="bg-rose-900/50 p-2.5 rounded-full">
                  {objection?.includes('كاميرا') ? <CameraOff className="text-rose-400" size={24} /> : <UserX className="text-rose-400" size={24} />}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-extrabold text-rose-300">لم تُثبت البصمة</h3>
                  <p className="text-sm text-slate-300 mt-1 leading-relaxed">{objection}</p>
                </div>
              </div>
              <div className="bg-slate-800/70 rounded-xl p-3 text-xs text-slate-400 flex items-start gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-400" />
                <span>إن تكرر الاعتراض راجع إدارة الموارد البشرية في المديرية.</span>
              </div>
              <button
                onClick={backToSearch}
                className="w-full py-3.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-extrabold text-base flex items-center justify-center gap-2 transition-colors"
              >
                <ArrowRight size={20} />
                العودة
              </button>
            </div>
          </div>
        )}
      </div>

      {/* شارة عدد الموظفين المسجلين بالبصمة (تشخيص صامت للجهاز) */}
      <div className="absolute bottom-1 left-2 text-[9px] text-slate-700" dir="ltr">
        kiosk v1 · {employees.length} enrolled
      </div>
    </div>
  );
};
