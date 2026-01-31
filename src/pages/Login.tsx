import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { GlassCard } from "../components/ui/GlassCard";
import { Loader2, LogIn } from "lucide-react";
import { Layout } from "../components/layout/Layout";

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
    // If success, App.tsx will automatically redirect due to user state change
  };

  return (
    <Layout className="flex items-center justify-center min-h-[80vh]">
      <GlassCard className="w-full max-w-md p-8 bg-black/50 border-white/10 shadow-2xl">
        <div className="text-center mb-10">
          <h1 className="text-2xl md:text-3xl font-bold text-white font-tajawal mb-3 leading-relaxed">
            مديرية الاتصالات ومعلوماتية كربلاء
          </h1>
          <div className="h-1 w-20 bg-brand-green mx-auto rounded-full mb-3" />
          <h2 className="text-white/80 text-lg font-medium">نظام ادارة الموظفين</h2>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-white/90 text-sm font-bold mb-2 text-right px-1">اسم المستخدم</label>
            <input
              type="text"
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-brand-green/50 focus:bg-white/10 transition-all text-right"
              placeholder=""
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-white/90 text-sm font-bold mb-2 text-right px-1">كلمة المرور</label>
            <input
              type="password"
              required
              maxLength={6} // As requested, typically 6 digits
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-brand-green/50 focus:bg-white/10 transition-all text-right font-mono tracking-widest text-center"
              placeholder="******"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/20 text-red-200 border border-red-500/30 text-sm text-center font-bold">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-brand-green-dark to-brand-green hover:from-brand-green hover:to-brand-green-light text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-green/20 mt-4 active:scale-[0.98]"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>
              <span>تسجيل الدخول</span>
              <LogIn className="w-5 h-5" />
            </>}
          </button>
        </form>
      </GlassCard>
    </Layout>
  );
};
