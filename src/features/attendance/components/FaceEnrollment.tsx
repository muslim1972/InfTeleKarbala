import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Camera, ShieldCheck, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCamera } from '../hooks/useCamera';
import { useFaceDetection } from '../hooks/useFaceDetection';

interface FaceEnrollmentProps {
    employeeId: string;
    onClose: () => void;
    onSuccess: () => void;
}

export const FaceEnrollment = ({ employeeId, onClose, onSuccess }: FaceEnrollmentProps) => {
    const [step, setStep] = useState<'password' | 'loading_models' | 'camera' | 'processing'>('password');
    const [password, setPassword] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    
    const { videoRef, startCamera, stopCamera } = useCamera();
    const { loadModels, extractFaceDescriptor } = useFaceDetection();

    // 1. Check Admin Password
    const handlePasswordSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const secret = import.meta.env.VITE_FACE_ENROLL_SECRET || 'admin1234'; // Default fallback
        if (password === secret) {
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
            await startCamera();
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
        
        // Pause the video immediately so the user can see what was captured
        // and doesn't need to hold still during processing
        videoRef.current.pause();
        
        setStep('processing');
        
        try {
            // Detect single face and compute descriptor using our hook
            const descriptorArray = await extractFaceDescriptor(videoRef.current);

            if (!descriptorArray) {
                toast.error("لم يتم العثور على وجه واضح، يرجى المحاولة مرة أخرى.");
                videoRef.current.play(); // Resume video on failure
                setStep('camera');
                return;
            }

            // Save to database
            const { error } = await supabase
                .from('profiles')
                .update({ face_descriptor: descriptorArray })
                .eq('id', employeeId);

            if (error) throw error;

            toast.success("تم تسجيل بصمة الوجه بنجاح!");
            onSuccess();
            onClose();

        } catch (err) {
            console.error("Enrollment error:", err);
            toast.error("حدث خطأ أثناء حفظ البصمة");
            if (videoRef.current) videoRef.current.play();
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
                            
                            <p className="text-center text-sm text-slate-600 dark:text-slate-400 mb-6 px-4">
                                يرجى توجيه وجه الموظف داخل الإطار الدائري ليكون واضحاً وفي إضاءة جيدة.
                            </p>

                            <button 
                                onClick={handleCapture}
                                disabled={step === 'processing'}
                                className="w-full bg-brand-green text-white font-bold py-4 rounded-xl hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
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
