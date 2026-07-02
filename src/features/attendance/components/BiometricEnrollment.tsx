import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { webauthnService, WebAuthnCredential } from '../services/webauthnService';
import { Fingerprint, Loader2, Trash2, ShieldCheck, ShieldAlert } from 'lucide-react';
import { toast } from 'react-hot-toast';

export const BiometricEnrollment = () => {
    const { currentUser } = useAuth();
    const [credentials, setCredentials] = useState<WebAuthnCredential[]>([]);
    const [loading, setLoading] = useState(true);
    const [enrolling, setEnrolling] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [supported, setSupported] = useState<boolean | null>(null);

    useEffect(() => {
        checkSupportAndLoad();
    }, [currentUser]);

    const checkSupportAndLoad = async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            const isSupported = await webauthnService.isSupported();
            setSupported(isSupported);
            
            if (isSupported) {
                await loadCredentials();
            }
        } catch (e) {
            console.error("Error loading biometric data", e);
        } finally {
            setLoading(false);
        }
    };

    const loadCredentials = async () => {
        if (!currentUser) return;
        const creds = await webauthnService.getCredentials(currentUser.id);
        setCredentials(creds);
    };

    const handleEnroll = async () => {
        if (!currentUser) return;
        
        // حد أقصى 2 بصمة
        if (credentials.length >= 2) {
            toast.error("لقد وصلت للحد الأقصى (بصمتين). يرجى حذف واحدة لتسجيل أخرى.");
            return;
        }

        setEnrolling(true);
        // الحصول على اسم مبسط للجهاز والمتصفح
        const userAgent = navigator.userAgent;
        let deviceType = "هاتف غير معروف";
        if (/android/i.test(userAgent)) deviceType = "جهاز أندرويد";
        else if (/iphone|ipad|ipod/i.test(userAgent)) deviceType = "جهاز آيفون/آيباد";
        else if (/windows/i.test(userAgent)) deviceType = "جهاز ويندوز";
        else if (/mac/i.test(userAgent)) deviceType = "جهاز ماك";

        const label = `إصبع ${credentials.length + 1}`;

        try {
            const result = await webauthnService.register(
                currentUser.id,
                currentUser.email || currentUser.id,
                label,
                deviceType
            );

            if (result.success) {
                toast.success(result.message);
                await loadCredentials();
            } else {
                toast.error(result.message);
            }
        } catch (error: any) {
            toast.error(error.message || "حدث خطأ غير متوقع");
        } finally {
            setEnrolling(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("هل أنت متأكد من حذف هذه البصمة؟ لن تتمكن من تسجيل الحضور من هذا الجهاز بهذه البصمة بعد الآن.")) {
            return;
        }

        setDeleting(id);
        try {
            const success = await webauthnService.removeCredential(id);
            if (success) {
                toast.success("تم حذف البصمة بنجاح");
                setCredentials(credentials.filter(c => c.id !== id));
            } else {
                toast.error("فشل حذف البصمة");
            }
        } catch (error) {
            toast.error("حدث خطأ أثناء الحذف");
        } finally {
            setDeleting(null);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-brand-green" />
            </div>
        );
    }

    if (supported === false) {
        return (
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg flex flex-col items-center text-center space-y-3">
                <ShieldAlert className="w-12 h-12 text-orange-500" />
                <h3 className="font-bold text-orange-700">جهازك لا يدعم البصمة المشفرة</h3>
                <p className="text-sm text-orange-600">
                    هذا الجهاز لا يحتوي على مستشعر بصمة، أو أن المتصفح لا يدعم تقنية WebAuthn الآمنة.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-brand-green/5 px-4 py-3 border-b border-brand-green/10 flex items-center space-x-2 space-x-reverse">
                <ShieldCheck className="w-5 h-5 text-brand-green" />
                <h3 className="font-bold text-gray-800">الأمان المتقدم (البصمة المشفرة)</h3>
            </div>
            
            <div className="p-4 space-y-4">
                <p className="text-sm text-gray-600">
                    لحماية حسابك، يجب ربط بصمتك بهذا الجهاز. لا يمكن لأي شخص تسجيل الحضور نيابة عنك من جهاز آخر حتى لو كان يعرف كلمة المرور الخاصة بك.
                </p>

                <div className="space-y-3">
                    {credentials.map((cred, index) => (
                        <div key={cred.id} className="flex items-center justify-between p-3 bg-gray-50 border rounded-lg">
                            <div className="flex items-center space-x-3 space-x-reverse">
                                <div className="p-2 bg-brand-green/10 rounded-full text-brand-green">
                                    <Fingerprint className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-bold text-sm text-gray-800">{cred.finger_label}</p>
                                    <p className="text-xs text-gray-500">{cred.device_name} - {new Date(cred.created_at).toLocaleDateString('ar-IQ')}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => handleDelete(cred.id)}
                                disabled={deleting === cred.id}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                title="حذف البصمة"
                            >
                                {deleting === cred.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Trash2 className="w-4 h-4" />
                                )}
                            </button>
                        </div>
                    ))}

                    {credentials.length === 0 && (
                        <div className="text-center py-6 px-4 bg-gray-50 border border-dashed rounded-lg">
                            <Fingerprint className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                            <p className="text-sm text-gray-500 font-medium">لا توجد أي بصمة مسجلة بعد</p>
                        </div>
                    )}
                </div>

                <div className="pt-2">
                    <button
                        onClick={handleEnroll}
                        disabled={enrolling || credentials.length >= 2}
                        className={`w-full py-2.5 rounded-lg font-bold text-sm flex items-center justify-center space-x-2 space-x-reverse transition-all ${
                            credentials.length >= 2
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-brand-green text-white shadow-md hover:bg-brand-green/90 active:scale-[0.98]'
                        }`}
                    >
                        {enrolling ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>جاري طلب البصمة...</span>
                            </>
                        ) : (
                            <>
                                <Fingerprint className="w-4 h-4" />
                                <span>{credentials.length > 0 ? 'تسجيل إصبع بديل (حد أقصى 2)' : 'تسجيل بصمتي على هذا الجهاز'}</span>
                            </>
                        )}
                    </button>
                    {credentials.length >= 2 && (
                        <p className="text-xs text-center text-gray-500 mt-2">
                            لقد وصلت للحد الأقصى المسموح به (بصمتين).
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};
