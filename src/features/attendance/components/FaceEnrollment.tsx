import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Camera, ShieldCheck, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCamera } from '../hooks/useCamera';
import { useFaceDetection } from '../hooks/useFaceDetection';
import { getDeviceFingerprint } from '../../../utils/deviceFingerprint';

const FACE_ENROLL_SECRET = import.meta.env.VITE_FACE_ENROLL_SECRET || 'Muslim2791';

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
        if (password === FACE_ENROLL_SECRET) {
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

    // Cleanup camera on unmount
    useEffect(() => {
        return () => {
            stopCamera();
        };
    }, [stopCamera]);

    // 4. Capture and Save Descriptor
    const handleCapture = async () => {
        if (!videoRef.current) return;
        
        setStep('processing');
        
        try {
            // Detect single face and compute descriptor using our hook (using SSD MobileNet for better accuracy)
            const descriptorArray = await extractFaceDescriptor(videoRef.current);

            if (!descriptorArray) {
                toast.error("لم يتم العثور على وجه واضح أو الإضاءة غير كافية، يرجى المحاولة مرة أخرى.");
                setStep('camera');
                return;
            }

            const newDescriptors = [...descriptors, descriptorArray];
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
            console.error("Enrollment error:", err);
            toast.error("حدث خطأ أثناء التسجيل: " + (err?.message || "خطأ غير معروف"));
            setStep('camera');
        }
    };

    return (
        <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 font-tajawal">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden relative">
                {/* Header */}
                <div className="bg-brand-green p-4 flex justify-between items-center text-white">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5" />
                        تسجيل بصمة الوجه (بحضور المسؤول)
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6">
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
                                    className="w-full h-full object-cover"
                                />
                                {/* Face Guide Overlay */}
                                <div className="absolute inset-0 border-[4px] border-dashed border-white/50 rounded-full m-8 pointer-events-none" />
                                
                                {step === 'processing' && (
                                    <div className="absolute inset-0 bg-brand-green/80 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                                        <Loader2 className="w-12 h-12 animate-spin mb-2" />
                                        <p className="font-bold">جاري تشفير الوجه...</p>
                                    </div>
                                )}
                            </div>
                            
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
