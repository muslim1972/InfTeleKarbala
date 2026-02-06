import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Loader2, LogIn, User } from "lucide-react";
import { AppFooter } from "../components/layout/AppFooter";

export const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { login } = useAuth();

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

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-gray-900 font-tao">
      {/* Smart Background Layer - Ready for dynamic rotation */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center transition-all duration-1000 ease-in-out scale-105"
        style={{ backgroundImage: `url('/sign-in.jpg')` }}
      >
        {/* Overlay for readability - slight dark tint & blur */}
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"></div>

        {/* Optional: Gradient overlay from bottom to ensuring footer/bottom readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30"></div>
      </div>

      {/* Main Content Content */}
      <div className="relative z-10 w-full max-w-md p-6 flex flex-col items-center">

        {/* Header / Logo Section */}
        <div className="text-center mb-10 space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <h1 className="text-3xl md:text-4xl font-bold text-white font-tajawal drop-shadow-lg tracking-wide">
            مديرية الاتصالات ومعلوماتية كربلاء
          </h1>
          <div className="h-1.5 w-24 bg-brand-green mx-auto rounded-full shadow-[0_0_20px_rgba(34,197,94,0.8)]" />
          <h2 className="text-white/90 text-xl font-medium drop-shadow-md tracking-wider">
            نظام ادارة الموظفين
          </h2>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="w-full space-y-5 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-100 p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md shadow-2xl ring-1 ring-white/5">

          <div className="space-y-2">
            <label className="block text-white/90 text-sm font-bold text-right px-1 drop-shadow-md">اسم المستخدم</label>
            <input
              type="text"
              required
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-4 text-white placeholder:text-white/30 focus:outline-none focus:border-brand-green focus:bg-black/60 transition-all text-right backdrop-blur-sm shadow-inner"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-white/90 text-sm font-bold text-right px-1 drop-shadow-md">كلمة المرور</label>
            <input
              type="password"
              required
              maxLength={6}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-4 text-white placeholder:text-white/30 focus:outline-none focus:border-brand-green focus:bg-black/60 transition-all text-right font-mono tracking-[0.5em] text-center backdrop-blur-sm shadow-inner"
              placeholder="••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
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
              className="w-full bg-gradient-to-r from-brand-green-dark to-brand-green hover:from-brand-green hover:to-brand-green-light text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-[0_0_30px_rgba(34,197,94,0.5)] active:scale-[0.98] border border-white/10"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>
                <span>تسجيل الدخول</span>
                <LogIn className="w-5 h-5" />
              </>}
            </button>

            {/* Visitor Login Button */}
            <button
              type="button"
              className="w-full bg-blue-600/80 hover:bg-blue-600 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] active:scale-[0.98] backdrop-blur-sm border border-white/10"
            >
              <span>الدخول كزائر</span>
              <User className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>

      {/* Footer / Copyright */}
      <div className="absolute bottom-0 left-0 right-0 z-20">
        <AppFooter />
      </div>
    </div>
  );
};
