import { useState, useRef } from 'react';
import { X, Camera, Lock, User, UserPen, Eye, EyeOff, Save, KeyRound, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SettingsModal = ({ isOpen, onClose }: SettingsModalProps) => {
    const { user, updateProfile, changePassword, uploadAvatar } = useAuth();
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');

    // Profile State
    const [fullName, setFullName] = useState(user?.full_name || '');

    // Security State
    const [username, setUsername] = useState(user?.username || '');
    const [confirmUsername, setConfirmUsername] = useState('');

    // Password State
    const [currentPassword, setCurrentPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);

    const [newPassword, setNewPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);

    const [confirmPassword, setConfirmPassword] = useState('');
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        const toastId = toast.loading('جاري تحديث الصورة...');
        try {
            const result = await uploadAvatar(file);
            if (result.success) {
                toast.success('تم تحديث الصورة بنجاح', { id: toastId });
            } else {
                toast.error('فشل تحديث الصورة: ' + result.error, { id: toastId });
            }
        } catch (err) {
            toast.error('حدث خطأ غير متوقع', { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateProfile = async () => {
        if (!fullName.trim()) return toast.error('الاسم الكامل مطلوب');

        setLoading(true);
        const result = await updateProfile({ full_name: fullName });
        setLoading(false);

        if (result.success) {
            toast.success('تم تحديث البيانات الشخصية');
        } else {
            toast.error(result.error || 'فشل التحديث');
        }
    };

    const handleUpdateUsername = async () => {
        if (username !== confirmUsername) return toast.error('اسم المستخدم وتأكيده غير متطابقين');
        if (!username.trim()) return toast.error('اسم المستخدم مطلوب');

        setLoading(true);
        const result = await updateProfile({ username });
        setLoading(false);

        if (result.success) {
            toast.success('تم تحديث اسم المستخدم');
            setConfirmUsername('');
        } else {
            toast.error(result.error || 'فشل التحديث');
        }
    };

    const handleChangePassword = async () => {
        if (newPassword !== confirmPassword) return toast.error('كلمة المرور وتأكيدها غير متطابقين');
        if (newPassword.length < 6) return toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
        if (newPassword === currentPassword) return toast.error('كلمة المرور الجديدة يجب أن تكون مختلفة عن الحالية');

        setLoading(true);
        const result = await changePassword(newPassword);
        setLoading(false);

        if (result.success) {
            toast.success('تم تغيير كلمة المرور بنجاح');
            setNewPassword('');
            setConfirmPassword('');
            setCurrentPassword('');
            setShowCurrentPassword(false);
            setShowNewPassword(false);
            setShowConfirmPassword(false);
        } else {
            toast.error(result.error || 'فشل تغيير كلمة المرور');
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
            {/* Main Modal Container */}
            <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col rounded-3xl bg-zinc-950/80 border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] ring-1 ring-white/5 backdrop-blur-xl relative">

                {/* Decorative Background Elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-green/10 rounded-full blur-[100px] pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none"></div>

                {/* Header */}
                <div className="p-6 border-b border-white/5 flex justify-between items-center relative z-10 w-full pl-6 pr-6 bg-black/20">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-brand-green/20 to-brand-green/5 border border-brand-green/20 shadow-inner">
                            <UserPen className="w-6 h-6 text-brand-green drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white font-tajawal drop-shadow-md">
                                الإعدادات الشخصية
                            </h2>
                            <p className="text-white/40 text-sm mt-0.5 font-medium">تخصيص ملفك الشخصي وحماية حسابك</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 rounded-full bg-white/5 hover:bg-red-500/20 text-white/50 hover:text-red-400 border border-transparent hover:border-red-500/30 transition-all group"
                    >
                        <X className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    </button>
                </div>

                {/* Top Tabs */}
                <div className="flex border-b border-white/10 relative z-10 bg-black/40 px-6 pt-4 gap-4">
                    <button
                        onClick={() => setActiveTab('profile')}
                        className={`flex items-center gap-2 pb-4 font-bold transition-all relative ${activeTab === 'profile'
                            ? 'text-brand-green'
                            : 'text-white/50 hover:text-white/80'
                            }`}
                    >
                        <User className="w-5 h-5" />
                        الملف الشخصي
                        {activeTab === 'profile' && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-green rounded-t-full shadow-[0_0_10px_rgba(34,197,94,0.8)]"></div>
                        )}
                    </button>

                    <button
                        onClick={() => setActiveTab('security')}
                        className={`flex items-center gap-2 pb-4 font-bold transition-all relative ${activeTab === 'security'
                            ? 'text-blue-400'
                            : 'text-white/50 hover:text-white/80'
                            }`}
                    >
                        <Lock className="w-5 h-5" />
                        بوابة الأمان
                        {activeTab === 'security' && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400 rounded-t-full shadow-[0_0_10px_rgba(96,165,250,0.8)]"></div>
                        )}
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 p-6 md:p-8 overflow-y-auto bg-gradient-to-br from-black/0 via-black/10 to-black/30 relative z-10 custom-scrollbar min-h-[400px]">
                    <div className="max-w-xl mx-auto pb-8">

                        {/* Section 1: Profile */}
                        {activeTab === 'profile' && (
                            <div className="space-y-8 animate-in slide-in-from-left-4 fade-in duration-500">

                                {/* Avatar Section - BOOM */}
                                <div className="flex flex-col items-center gap-5 pt-2">
                                    <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
                                        <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-brand-green to-blue-500 opacity-20 group-hover:opacity-60 blur-md transition-opacity duration-500"></div>

                                        <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-white/10 bg-zinc-900 shadow-2xl group-hover:border-brand-green/50 transition-all duration-300 group-hover:scale-[1.02]">
                                            {user?.avatar_url ? (
                                                <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                            ) : (
                                                <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center">
                                                    <User className="w-12 h-12 text-white/20" />
                                                </div>
                                            )}
                                        </div>

                                        <div className="absolute inset-0 rounded-full bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-sm border-2 border-brand-green border-dashed">
                                            <Camera className="w-8 h-8 text-white mb-1 drop-shadow-lg" />
                                            <span className="text-white text-[10px] font-bold">تغيير الصورة</span>
                                        </div>

                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            className="hidden"
                                            accept="image/*"
                                            onChange={handleFileChange}
                                        />
                                    </div>
                                </div>

                                {/* Full Name Section */}
                                <div className="space-y-6 bg-white/5 border border-white/5 rounded-3xl p-6 md:p-8 backdrop-blur-sm shadow-inner relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-brand-green/5 rounded-full blur-[50px] pointer-events-none group-hover:bg-brand-green/10 transition-colors"></div>

                                    <div className="space-y-2 relative z-10">
                                        <label className="text-white/80 text-sm font-bold flex items-center gap-2 mb-3">
                                            <User className="w-4 h-4 text-brand-green" />
                                            الاسم الكامل
                                        </label>
                                        <input
                                            type="text"
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                            className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-white/20 focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green/50 transition-all shadow-inner text-lg font-tajawal"
                                            placeholder="أدخل اسمك الكامل..."
                                        />
                                    </div>

                                    <button
                                        onClick={handleUpdateProfile}
                                        disabled={loading || fullName === user?.full_name}
                                        className="w-full bg-gradient-to-r from-brand-green to-brand-green-dark hover:from-emerald-400 hover:to-brand-green text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_10px_20px_rgba(34,197,94,0.2)] hover:shadow-[0_15px_30px_rgba(34,197,94,0.3)] active:scale-[0.98] mt-4 border border-white/10 relative z-10"
                                    >
                                        <Save className="w-5 h-5" />
                                        حفظ التعديلات
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Section 2: Security */}
                        {activeTab === 'security' && (
                            <div className="space-y-8 animate-in slide-in-from-left-4 fade-in duration-500">

                                {/* Change Username */}
                                <div className="space-y-6 bg-white/5 border border-white/5 rounded-3xl p-6 md:p-8 backdrop-blur-sm shadow-inner relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-[50px] pointer-events-none group-hover:bg-blue-500/10 transition-colors"></div>

                                    <h3 className="text-xl font-bold text-white flex items-center gap-2 border-b border-white/10 pb-4 relative z-10">
                                        <UserPen className="w-5 h-5 text-blue-400" />
                                        تعديل اسم المستخدم
                                    </h3>

                                    <div className="space-y-5 relative z-10">
                                        <div className="space-y-2">
                                            <label className="text-white/60 text-xs font-bold px-1">اسم المستخدم الجديد</label>
                                            <input
                                                type="text"
                                                value={username}
                                                onChange={(e) => setUsername(e.target.value)}
                                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all shadow-inner"
                                                dir="ltr"
                                                placeholder="أدخل اسم المستخدم الجديد"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-white/60 text-xs font-bold px-1">تأكيد اسم المستخدم</label>
                                            <input
                                                type="text"
                                                value={confirmUsername}
                                                onChange={(e) => setConfirmUsername(e.target.value)}
                                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all shadow-inner"
                                                dir="ltr"
                                                placeholder="أعد كتابة اسم المستخدم"
                                            />
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleUpdateUsername}
                                        disabled={loading || !confirmUsername || username === user?.username}
                                        className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 border border-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg active:scale-[0.98] relative z-10"
                                    >
                                        <CheckCircle2 className="w-5 h-5" />
                                        اعتماد اسم المستخدم
                                    </button>
                                </div>

                                {/* Change Password */}
                                <div className="space-y-6 bg-white/5 border border-red-500/10 rounded-3xl p-6 md:p-8 backdrop-blur-sm shadow-inner relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5  rounded-full blur-[50px] pointer-events-none group-hover:bg-red-500/10 transition-colors"></div>

                                    <h3 className="text-xl font-bold text-white flex items-center gap-2 border-b border-white/10 pb-4 relative z-10">
                                        <KeyRound className="w-5 h-5 text-red-400" />
                                        تعديل كلمة المرور
                                    </h3>

                                    <div className="space-y-5 relative z-10">
                                        {/* Current Password */}
                                        <div className="space-y-2">
                                            <label className="text-white/60 text-xs font-bold px-1">كلمة المرور الحالية</label>
                                            <div className="relative">
                                                <input
                                                    type={showCurrentPassword ? "text" : "password"}
                                                    maxLength={6}
                                                    value={currentPassword}
                                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                                    className="w-full bg-black/40 border border-white/10 rounded-xl pr-4 pl-12 py-3 text-white font-mono tracking-widest text-center focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/50 transition-all shadow-inner placeholder:tracking-normal"
                                                    dir="ltr"
                                                    placeholder="كلمة المرور الحالية"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2 text-white/40 hover:text-white transition-colors rounded-lg hover:bg-white/5"
                                                >
                                                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>

                                        {/* New Password */}
                                        <div className="space-y-2">
                                            <label className="text-white/60 text-xs font-bold px-1">كلمة المرور الجديدة</label>
                                            <div className="relative">
                                                <input
                                                    type={showNewPassword ? "text" : "password"}
                                                    maxLength={6}
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    className="w-full bg-black/40 border border-white/10 rounded-xl pr-4 pl-12 py-3 text-white font-mono tracking-widest text-center focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/50 transition-all shadow-inner placeholder:tracking-normal"
                                                    dir="ltr"
                                                    placeholder="أدخل الرمز الجديد"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2 text-white/40 hover:text-white transition-colors rounded-lg hover:bg-white/5"
                                                >
                                                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Confirm Password */}
                                        <div className="space-y-2">
                                            <label className="text-white/60 text-xs font-bold px-1">تأكيد كلمة المرور</label>
                                            <div className="relative">
                                                <input
                                                    type={showConfirmPassword ? "text" : "password"}
                                                    maxLength={6}
                                                    value={confirmPassword}
                                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                                    className="w-full bg-black/40 border border-white/10 rounded-xl pr-4 pl-12 py-3 text-white font-mono tracking-widest text-center focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/50 transition-all shadow-inner placeholder:tracking-normal"
                                                    dir="ltr"
                                                    placeholder="أعد كتابة الرمز الجديد"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2 text-white/40 hover:text-white transition-colors rounded-lg hover:bg-white/5"
                                                >
                                                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleChangePassword}
                                        disabled={loading || !newPassword || !confirmPassword || !currentPassword}
                                        className="w-full bg-gradient-to-r from-red-600/80 to-red-500/80 hover:from-red-500 hover:to-red-400 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 border border-red-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[0_0_20px_rgba(239,68,68,0.3)] active:scale-[0.98] relative z-10"
                                    >
                                        <Lock className="w-5 h-5" />
                                        تحديث كلمة السـر
                                    </button>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
};
