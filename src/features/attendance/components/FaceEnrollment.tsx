import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { Camera, ShieldCheck, X, Loader2, Sparkles, Clock3, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCamera } from '../hooks/useCamera';
import { useFaceDetection } from '../hooks/useFaceDetection';
import { getDeviceFingerprint } from '../../../utils/deviceFingerprint';

const FACE_ENROLL_SECRET = (import.meta.env.VITE_FACE_ENROLL_SECRET || '').trim().toLowerCase();

interface FaceEnrollmentProps {
    employeeId: string;
    onClose: () => void;
    onSuccess: () => void;
}

export const FaceEnrollment = ({ employeeId, onClose, onSuccess }: FaceEnrollmentProps) => {
    const [step, setStep] = useState<'password' | 'loading_models' | 'camera' | 'processing'>('password');
    const [password, setPassword] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [capturedCount, setCapturedCount] = useState(0);
    const [descriptors, setDescriptors] = useState<number[][]>([]);
    const [countdownSeconds, setCountdownSeconds] = useState(8);
    const [timeoutWarning, setTimeoutWarning] = useState<string | null>(null);
    const animFrameRef = useRef<number | null>(null);
    
    const { videoRef, startCamera, stopCamera } = useCamera();
    const { loadModels, extractFaceDescriptor } = useFaceDetection();

    const captureMessages = [
        "التقاط الصورة (الزاوية الأمامية)",
        "التقاط الصورة (الوجه مائل لليمين قليلاً)",
        "التقاط الصورة (الوجه مائل لليسار قليلاً)",
    ];

    // 1. Check Admin Password
    const handlePasswordSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const inputPass = password.trim().toLowerCase();
        if (FACE_ENROLL_SECRET && inputPass === FACE_ENROLL_SECRET) {
            setStep('loading_models');
            handleLoadModelsAndCamera();
        } else {
            setErrorMsg('كلمة المرور غير صحيحة. هذه الميزة للمسؤولين فقط.');
        }
    };

    // 2. Load Face API Models & Start Camera
    const handleLoadModelsAndCamera = async () => {
        try {
            await loadModels();
            setStep('camera');
            const stream = await startCamera();
            
            requestAnimationFrame(() => {
                if (videoRef.current && stream) {
                    videoRef.current.srcObject = stream;
                }
            });
        } catch (err) {
            console.error("Error loading face models or camera:", err);
            toast.error("فشل تهيئة الكاميرا أو نماذج الذكاء الاصطناعي");
            onClose();
        }
    };

    // Cleanup camera and timer on unmount
    useEffect(() => {
        return () => {
            stopCamera();
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        };
    }, [stopCamera]);

    // 4. Capture and Save Descriptor via Offscreen Canvas and Watchdog Timer
    const handleCapture = async () => {
        if (!videoRef.current) return;
        const video = videoRef.current;
        if (video.readyState < 2 || video.videoWidth === 0) {
            toast.error('الكاميرا غير جاهزة بعد، يرجى الانتظار ثانية');
            return;
        }

        setTimeoutWarning(null);

        // انتظار استقرار اللمس لتفادي ركّة اليد لحظة ضغط الزر
        await new Promise((resolve) => window.setTimeout(resolve, 200));

        // التقاط الإطار في لوحة Canvas وسيطة بدقة 416x416 لعزل الكاميرا وحماية كارت الشاشة
        const canvas = document.createElement('canvas');
        canvas.width = 416;
        canvas.height = 416;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
            toast.error('تعذر تهيئة لوحة المعالجة');
            return;
        }

        // قص مربع متمركز من منتصف الفيديو
        const minDim = Math.min(video.videoWidth, video.videoHeight);
        const startX = (video.videoWidth - minDim) / 2;
        const startY = (video.videoHeight - minDim) / 2;
        ctx.drawImage(video, startX, startY, minDim, minDim, 0, 0, 416, 416);

        setStep('processing');
        setCountdownSeconds(8);

        // شريط تنازلي 8 ثوانٍ ناعم
        const startTime = performance.now();
        const DURATION_MS = 8000;
        let isRunning = true;

        const updateTimer = () => {
            if (!isRunning) return;
            const elapsed = performance.now() - startTime;
            const remaining = Math.max(0, Math.ceil((DURATION_MS - elapsed) / 1000));
            setCountdownSeconds(remaining);
            if (elapsed < DURATION_MS) {
                animFrameRef.current = requestAnimationFrame(updateTimer);
            }
        };
        animFrameRef.current = requestAnimationFrame(updateTimer);

        let timerId: number | null = null;
        const timeoutPromise = new Promise<never>((_, reject) => {
            timerId = window.setTimeout(() => {
                reject(new Error('TIMEOUT_EXCEEDED'));
            }, DURATION_MS);
        });

        try {
            // معالجة الوجه من الـ Canvas مع حارس الأمان (Watchdog)
            const descriptorArray = await Promise.race([
                extractFaceDescriptor(canvas),
                timeoutPromise
            ]);

            // إلغاء المؤقت فور الاستجابة السريعة
            isRunning = false;
            if (timerId) window.clearTimeout(timerId);
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

            if (!descriptorArray) {
                toast.error("لم يتم العثور على وجه واضح وثابت، يرجى تثبيت الهاتف والمحاولة مرة أخرى.");
                setStep('camera');
                return;
            }

            const newDescriptors: number[][] = [...descriptors, descriptorArray as number[]];
            setDescriptors(newDescriptors);
            setCapturedCount(newDescriptors.length);

            if (newDescriptors.length < 3) {
                toast.success("تم التقاط الزاوية بنجاح! يرجى الاستعداد للزاوية التالية.");
                setStep('camera');
            } else {
                // Save to database (Array of Arrays because column is jsonb) + Bind device fingerprint
                let deviceId: string | null = null;
                try {
                    deviceId = await getDeviceFingerprint();
                } catch (dErr) {
                    console.warn("Could not compute device fingerprint during face enroll:", dErr);
                }

                const updatePayload: any = { face_descriptor: newDescriptors };
                if (deviceId) {
                    updatePayload.primary_device_id = deviceId;
                }

                const { error } = await supabase
                    .from('profiles')
                    .update(updatePayload)
                    .eq('id', employeeId);

                if (error) throw error;

                // Also clear pending device flag for today's record
                const todayStr = new Date().toISOString().split('T')[0];
                await supabase
                    .from('attendance_records')
                    .update({ is_device_pending: false })
                    .eq('employee_id', employeeId)
                    .gte('created_at', `${todayStr}T00:00:00`)
                    .lte('created_at', `${todayStr}T23:59:59`);

                toast.success("تم تسجيل بصمة الوجه واقتران الجهاز المعتمد بنجاح!");
                onSuccess();
                onClose();
            }

        } catch (err: any) {
            isRunning = false;
            if (timerId) window.clearTimeout(timerId);
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

            if (err?.message === 'TIMEOUT_EXCEEDED') {
                setTimeoutWarning('استغرقت معالجة الوجه وقتاً طويلاً نظراً لمحدودية موارد هذا الجهاز — يُرجى المحاولة في مكان ذي إضاءة ممتازة، أو إتمام تعريف الوجه من خلال هاتف المشرف المعتمد.');
                toast.error('انتهت مهلة التشفير (8 ثوانٍ) — تعذر المعالجة على هذا الجهاز');
            } else {
                console.error("Enrollment error:", err);
                toast.error("حدث خطأ أثناء التسجيل: " + (err?.message || "خطأ غير معروف"));
            }
            setStep('camera');
        }
    };

    return (
        <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 pb-28 md:pb-32 overflow-y-auto font-tajawal">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden relative max-h-[calc(100vh-9rem)] flex flex-col">
                {/* Header */}
                <div className="bg-brand-green p-4 flex justify-between items-center text-white shrink-0">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5" />
                        تسجيل بصمة الوجه (بحضور المسؤول)
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {step === 'password' && (
                        <form onSubmit={handlePasswordSubmit} className="space-y-4">
                            <div className="text-center mb-6">
                                <ShieldCheck className="w-16 h-16 text-yellow-500 mx-auto mb-2" />
                                <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">تسجيل بصمة الوجه (بحضور المسؤول)</h2>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    هذه الميزة تتطلب حضور المسؤول شخصياً لإدخال الرقم السري الخاص بتسجيل البصمة لمنع التلاعب.
                                </p>
                            </div>
                            <div>
                                <input 
                                    type="password" 
                                    value={password}
                                    onChange={(e) => { setPassword(e.target.value); setErrorMsg(''); }}
                                    placeholder="أدخل الرقم السري للمسؤول"
                                    className="w-full text-center text-lg p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                                    autoFocus
                                />
                                {errorMsg && <p className="text-red-500 text-sm mt-2 text-center">{errorMsg}</p>}
                            </div>
                            <button type="submit" className="w-full bg-brand-green text-white font-bold py-3 rounded-xl hover:bg-emerald-600 transition-colors">
                                تحقق من الصلاحية
                            </button>
                        </form>
                    )}

                    {step === 'loading_models' && (
                        <div className="flex flex-col items-center py-10">
                            <Loader2 className="w-12 h-12 text-brand-green animate-spin mb-4" />
                            <p className="text-slate-600 dark:text-slate-300 font-bold">جاري تحميل نماذج الذكاء الاصطناعي...</p>
                        </div>
                    )}

                    {(step === 'camera' || step === 'processing') && (
                        <div className="flex flex-col items-center">
                            <div className="relative w-full max-w-sm aspect-square bg-black rounded-2xl overflow-hidden shadow-inner mb-6">
                                <video 
                                    ref={videoRef} 
                                    autoPlay 
                                    playsInline 
                                    muted 
                                    className="w-full h-full object-cover -scale-x-100"
                                />
                                {/* Face Guide Overlay */}
                                <div className="absolute inset-0 border-[4px] border-dashed border-white/50 rounded-full m-8 pointer-events-none" />
                                
                                {step === 'processing' && (
                                    <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center text-white p-5 z-20">
                                        <div className="relative mb-3 flex items-center justify-center">
                                            <div className="w-14 h-14 rounded-full border-4 border-emerald-500/30 border-t-emerald-400 animate-spin" />
                                            <Sparkles className="w-6 h-6 text-emerald-400 absolute" />
                                        </div>
                                        <p className="font-extrabold text-sm mb-1 text-white">جاري تشفير ملامح الوجه...</p>
                                        <p className="text-[11px] text-slate-300 mb-3 text-center">
                                            يُرجى البقاء ثابتاً أمام الكاميرا
                                        </p>

                                        {/* شريط العد التنازلي التفاعلي المباشر (8 ثوانٍ) */}
                                        <div className="w-full max-w-[200px] space-y-1">
                                            <div className="flex justify-between items-center text-[10px] font-bold text-slate-300">
                                                <span className="flex items-center gap-1 text-emerald-400">
                                                    <Clock3 className="w-3 h-3" />
                                                    مهلة الأمان
                                                </span>
                                                <span className="font-mono text-emerald-400 font-extrabold">{countdownSeconds} ث</span>
                                            </div>
                                            <div className="w-full bg-slate-800 rounded-full h-2 p-0.5 overflow-hidden border border-slate-700/60 shadow-inner">
                                                <div 
                                                    className="bg-gradient-to-l from-emerald-400 to-teal-500 h-full rounded-full transition-all duration-300 ease-out"
                                                    style={{ width: `${(countdownSeconds / 8) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            {timeoutWarning && (
                                <div className="w-full mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2 leading-relaxed">
                                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                    <span>{timeoutWarning}</span>
                                </div>
                            )}

                            <p className="text-center font-bold text-lg text-emerald-600 mb-2">
                                الخطوة {capturedCount + 1} من 3
                            </p>
                            <p className="text-center text-sm text-slate-600 dark:text-slate-400 mb-6 px-4">
                                {captureMessages[capturedCount] || "جاري الحفظ..."} <br/> يرجى توجيه الوجه ليكون واضحاً وفي إضاءة جيدة.
                            </p>

                            <button 
                                onClick={handleCapture}
                                disabled={step === 'processing'}
                                className="w-full bg-brand-green text-white font-bold py-4 rounded-xl hover:bg-emerald-600 active:scale-[0.95] transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                            >
                                <Camera className="w-6 h-6" />
                                التقاط وحفظ البصمة
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
