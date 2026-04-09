import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Loader2, LogIn, User, Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react";
import { AppFooter } from "../components/layout/AppFooter";
import { useTheme } from "../context/ThemeContext";
import { ThemeToggleFloating } from "../components/ui/ThemeToggleFloating";

export const Login = ({ onBack }: { onBack?: () => void } = {}) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotUsername, setForgotUsername] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotResult, setForgotResult] = useState<{ 
    success: boolean; 
    supervisor_name?: string; 
    action_required?: string; 
    action_completed?: string; 
    error?: string 
  } | null>(null);

  const { login, loginAsVisitor, forgotPassword } = useAuth();
  const { theme } = useTheme();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await login(username, password);

    if (!result.success) {
      setError(result.error || "خطأ في الدخول");
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent, confirm: boolean = false) => {
    e?.preventDefault();
    if (!forgotUsername.trim()) return;

    setForgotLoading(true);
    if (!confirm) setForgotResult(null);

    const result = await forgotPassword(forgotUsername, confirm);
    setForgotResult(result);
    setForgotLoading(false);
  };

  return (
    <div className={`h-screen w-full flex items-start justify-center relative overflow-y-auto overflow-x-hidden font-tao scroll-smooth pb-12 transition-colors duration-500 ${
      theme === 'light' ? 'bg-slate-50' : 'bg-gray-900'
    }`}>
      <ThemeToggleFloating />
      {/* Smart Background Layer - Fixed to stay during scroll */}
      <div
        className={`fixed inset-0 z-0 bg-cover bg-center transition-all duration-1000 ease-in-out scale-105 ${
          theme === 'light' ? 'opacity-20' : 'opacity-100'
        }`}
        style={{ backgroundImage: `url('/sign-in.jpg')` }}
      >
        {/* Overlay for readability */}
        <div className={`absolute inset-0 backdrop-blur-[2px] transition-colors duration-700 ${
          theme === 'light' ? 'bg-white/60' : 'bg-black/40'
        }`}></div>

        {/* Gradient overlay */}
        <div className={`absolute inset-0 transition-colors duration-700 ${
          theme === 'light' 
            ? 'bg-gradient-to-t from-white/90 via-white/40 to-white/60' 
            : 'bg-gradient-to-t from-black/80 via-black/20 to-black/30'
        }`}></div>
      </div>

      {/* Main Content Container */}
      <div className="relative z-10 w-full max-w-md p-6 flex flex-col items-center pt-[calc(1rem+env(safe-area-inset-top))] pb-40">

        {/* Back to Launcher Button */}
        {onBack && (
          <button
            onClick={onBack}
            className="self-start mb-4 flex items-center gap-2 text-white/70 hover:text-white transition-colors text-xs font-bold bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl backdrop-blur-sm border border-white/10 animate-in fade-in slide-in-from-right-4 duration-500"
          >
            <span>→</span>
            <span>العودة للبوابة</span>
          </button>
        )}

        {/* Header / Logo Section */}
        <div className="text-center mb-4 space-y-2 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <h1 className={`text-lg md:text-3xl font-bold font-tajawal drop-shadow-lg tracking-wide px-4 leading-relaxed transition-colors duration-500 ${
            theme === 'light' ? 'text-slate-900' : 'text-white'
          }`}>
            مديرية الاتصالات ومعلوماتية كربلاء المقدسة
          </h1>
          <div className="h-1.5 w-16 bg-brand-green mx-auto rounded-full shadow-lg" />
          <h2 className={`text-sm font-medium drop-shadow-md tracking-wider italic transition-colors duration-500 ${
            theme === 'light' ? 'text-slate-600' : 'text-white/80'
          }`}>
            نظام الادارة الموحد
          </h2>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className={`w-full space-y-4 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-100 p-6 md:p-8 rounded-3xl border backdrop-blur-md transition-all duration-500 ${
          theme === 'light' 
            ? 'bg-white/80 border-gray-200 shadow-xl shadow-gray-200/50' 
            : 'bg-white/5 border-white/10 shadow-2xl ring-1 ring-white/5'
        }`}>

          <div className="space-y-2">
            <label className={`block text-sm font-bold text-right px-1 drop-shadow-sm transition-colors ${
              theme === 'light' ? 'text-slate-700' : 'text-white/90'
            }`}>اسم المستخدم</label>
            <input
              type="text"
              required
              autoComplete="username"
              className={`w-full border rounded-xl px-4 py-4 transition-all text-right backdrop-blur-sm shadow-inner text-lg ${
                theme === 'light'
                  ? 'bg-white border-gray-200 text-slate-900 placeholder:text-slate-400 focus:border-brand-green'
                  : 'bg-black/40 border-white/10 text-white placeholder:text-white/30 focus:border-brand-green focus:bg-black/60'
              }`}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="space-y-2 relative">
            <label className={`block text-sm font-bold text-right px-1 drop-shadow-sm transition-colors ${
              theme === 'light' ? 'text-slate-700' : 'text-white/90'
            }`}>كلمة المرور</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                maxLength={6}
                autoComplete="current-password"
                className={`w-full border rounded-xl pr-4 pl-12 py-3 transition-all font-mono tracking-[0.5em] text-center backdrop-blur-sm shadow-inner text-lg ${
                  theme === 'light'
                    ? 'bg-white border-gray-200 text-slate-900 placeholder:text-slate-400 focus:border-brand-green'
                    : 'bg-black/40 border-white/10 text-white placeholder:text-white/30 focus:border-brand-green focus:bg-black/60'
                }`}
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors p-1 z-10 ${
                  theme === 'light' ? 'text-slate-400 hover:text-slate-600' : 'text-white/50 hover:text-white'
                }`}
                title={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <div className="text-right px-1 mt-1">
              <button
                type="button"
                onClick={() => {
                  setForgotUsername(username);
                  setForgotResult(null);
                  setShowForgotModal(true);
                }}
                className={`text-xs font-bold transition-colors underline underline-offset-4 ${
                  theme === 'light' ? 'text-slate-500 hover:text-brand-green decoration-slate-200' : 'text-white/60 hover:text-brand-green decoration-white/20'
                }`}
              >
                نسيت كلمة المرور؟
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/20 text-red-100 border border-red-500/30 text-sm text-center font-bold backdrop-blur-md animate-in zoom-in duration-300">
              {error}
            </div>
          )}

          <div className="pt-4 space-y-3">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-green-600 to-brand-green hover:from-brand-green hover:to-green-400 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-[0_0_30px_rgba(34,197,94,0.5)] active:scale-[0.98] border border-white/10"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>
                <span>تسجيل الدخول</span>
                <LogIn className="w-5 h-5" />
              </>}
            </button>

            {/* Visitor Login Button */}
            <button
              type="button"
              onClick={loginAsVisitor}
              className="w-full bg-blue-600/80 hover:bg-blue-600 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] active:scale-[0.98] backdrop-blur-sm border border-white/10"
            >
              <span>الدخول كزائر</span>
              <User className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-300 text-right">
            {!forgotResult ? (
              <>
                <h3 className="text-2xl font-bold text-white mb-4 font-tajawal">نسيت كلمة المرور؟</h3>
                <p className="text-white/60 text-sm mb-6 leading-relaxed">
                  أدخل اسم المستخدم الخاص بك للتحقق من هويتك وإرسال كلمة مرور مؤقتة للمسؤول المباشر.
                </p>
                <form onSubmit={(e) => handleForgotPassword(e)} className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-white/90 text-xs font-bold px-1">اسم المستخدم</label>
                    <input
                      type="text"
                      required
                      autoFocus
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white placeholder:text-white/20 focus:outline-none focus:border-brand-green focus:bg-white/10 transition-all text-right text-lg"
                      value={forgotUsername}
                      onChange={(e) => setForgotUsername(e.target.value)}
                      placeholder="أدخل اسم المستخدم"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={forgotLoading || !forgotUsername.trim()}
                      className="flex-1 bg-brand-green hover:bg-green-600 text-white font-bold py-4 rounded-2xl transition-all disabled:opacity-50 active:scale-[0.98] shadow-lg shadow-brand-green/20"
                    >
                      {forgotLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "تحقق من الحساب"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(false)}
                      className="px-6 bg-white/5 hover:bg-white/10 text-white font-bold py-4 rounded-2xl transition-all active:scale-[0.98] border border-white/5"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              </>
            ) : forgotResult.success && forgotResult.action_required === 'confirm' ? (
              <div className="space-y-6">
                <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto ring-4 ring-blue-500/10 mb-4">
                  <User className="text-blue-400 w-8 h-8" />
                </div>
                <div className="bg-white/5 rounded-3xl p-6 border border-white/10 space-y-4">
                   <p className="text-white/90 text-lg leading-relaxed text-center font-tajawal">
                    سيتم إرسال كلمة سر مؤقتة إلى المسوؤل المباشر:
                    <br />
                    <span className="text-blue-400 font-extrabold text-2xl block mt-3 drop-shadow-[0_0_10px_rgba(59,130,246,0.3)]">
                      {forgotResult.supervisor_name}
                    </span>
                  </p>
                  <p className="text-white/60 text-sm text-center">
                    هل ترغب في متابعة العملية؟
                  </p>
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={(e) => handleForgotPassword(e as any, true)}
                    disabled={forgotLoading}
                    className="flex-1 bg-brand-green hover:bg-green-600 text-white font-bold py-4 rounded-2xl transition-all active:scale-[0.98] shadow-lg shadow-brand-green/20 flex items-center justify-center"
                  >
                    {forgotLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "نعم، أرسل الكلمة"}
                  </button>
                  <button
                    onClick={() => setForgotResult(null)}
                    disabled={forgotLoading}
                    className="px-6 bg-white/5 hover:bg-white/10 text-white font-bold py-4 rounded-2xl transition-all active:scale-[0.98] border border-white/5"
                  >
                    رجوع
                  </button>
                </div>
              </div>
            ) : forgotResult.success && forgotResult.action_completed === 'generated' ? (
              <div className="space-y-6">
                <div className="w-20 h-20 bg-brand-green/20 rounded-full flex items-center justify-center mx-auto ring-4 ring-brand-green/10">
                  <CheckCircle className="text-brand-green w-10 h-10" />
                </div>
                <div className="text-center space-y-4">
                  <h3 className="text-2xl font-bold text-white font-tajawal">تم الإرسال بنجاح</h3>
                  <div className="bg-white/5 rounded-3xl p-6 border border-white/10 space-y-3">
                    <p className="text-white/90 text-lg leading-relaxed">
                      تم إرسال كلمة السر المؤقتة للمسؤول:
                      <br />
                      <span className="text-brand-green font-extrabold text-xl block mt-2">
                        {forgotResult.supervisor_name}
                      </span>
                    </p>
                    <div className="h-px bg-white/10 w-1/2 mx-auto my-3" />
                    <p className="text-white/60 text-sm">
                      يرجى التواصل معه لاستلامها.
                    </p>
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mt-4">
                      <p className="text-amber-200 text-xs font-bold leading-relaxed">
                        ملاحة: يجب تغيير كلمة المرور فور دخولك للتطبيق.
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowForgotModal(false)}
                  className="w-full bg-white hover:bg-gray-100 text-slate-900 font-extrabold py-4 rounded-2xl transition-all active:scale-[0.98] shadow-xl text-lg"
                >
                  موافق
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto ring-4 ring-red-500/10">
                  <AlertCircle className="text-red-500 w-10 h-10" />
                </div>
                <div className="text-center space-y-3">
                  <h3 className="text-2xl font-bold text-white font-tajawal">عذراً، تعذر التحقق</h3>
                  <div className="bg-white/5 rounded-[2rem] p-6 border border-white/10">
                    <p className="text-red-200 text-lg font-bold">
                      {forgotResult?.error === 'user_not_found' ? "اسم المستخدم غير موجود" : "حدث خطأ غير متوقع"}
                    </p>
                    <p className="text-white/40 text-sm mt-3">
                      يرجى المحاولة مجدداً.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setForgotResult(null)}
                  className="w-full bg-white hover:bg-gray-100 text-slate-900 font-extrabold py-4 rounded-2xl transition-all active:scale-[0.98] shadow-xl text-lg"
                >
                  حاول مرة أخرى
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 z-20">
        <AppFooter />
      </div>
    </div>
  );
};
