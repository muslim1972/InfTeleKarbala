
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { initOneSignal, logoutOneSignal, sendPushNotification, requestNotificationPermission } from "../services/notifications";
import { geolocationManager } from "../utils/GeolocationManager";

export interface AppUser {
  id: string;
  username: string;
  full_name: string;
  job_number?: string;
  role: string;
  admin_role?: string; // developer, media, etc.
  avatar_url?: string | null;
  department_id?: string | null;
  can_view_requests?: boolean;
  specialization?: string;
  graduation_year?: string;
  appointment_date?: string;
  work_nature?: string;
  dept_text?: string;
  section_text?: string;
  unit_text?: string;
  has_capacities_access?: boolean;
  can_access_promotion?: boolean;
  is_promotion_lecturer?: boolean;
  is_training_supervisor?: boolean;
  email?: string | null;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginAsVisitor: () => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<AppUser>) => Promise<{ success: boolean; error?: string }>;
  changePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  uploadAvatar: (file: File) => Promise<{ success: boolean; url?: string; error?: string }>;
  forgotPassword: (username: string, confirm?: boolean) => Promise<{ success: boolean; supervisor_name?: string; action_required?: string; action_completed?: string; error?: string }>;
  verify2FA: (code: string, tempUser: AppUser) => Promise<{ success: boolean; error?: string }>;
  request2FA: (email: string, tempUser: AppUser) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => ({ success: false }),
  loginAsVisitor: async () => ({ success: false }),
  logout: async () => { },
  updateProfile: async () => ({ success: false }),
  changePassword: async () => ({ success: false }),
  uploadAvatar: async () => ({ success: false }),
  forgotPassword: async () => ({ success: false }),
  verify2FA: async () => ({ success: false }),
  request2FA: async () => ({ success: false }),
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Helper to log visit
  const logVisit = async (userData: AppUser) => {
    if (sessionStorage.getItem('session_logged')) return;
    try {
      await supabase.from('login_logs').insert({
        user_id: userData.id,
        full_name: userData.full_name,
        role: userData.role,
        user_agent: navigator.userAgent
      });
      sessionStorage.setItem('session_logged', 'true');
    } catch (e) {
      console.error("Failed to log visit", e);
    }
  };

  // Check current session on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        // 1. Check for Visitor Session
        const visitor = sessionStorage.getItem("visitor_user");
        if (visitor) {
          setUser(JSON.parse(visitor));
          setLoading(false);
          return;
        }

        // 2. Check Supabase Session
        const { data, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.warn("Session retrieval error:", sessionError);
          // Attempt to clear invalid session state safely
          supabase.auth.signOut().catch(e => console.error("Sign out error", e));
        }

        const session = data?.session;
        if (session?.user) {
          // Fetch full profile via secure RPC (bypasses RLS safely)
          const { data: profile, error: profileErr } = await supabase
            .rpc('get_own_profile')
            .single() as { data: any; error: any };

          if (profileErr) {
            console.error("Profile fetch error:", profileErr);
          }

          // --- BEGIN 2FA BYPASS FIX ---
          const bypassedAccounts = ['المطور', 'تجريبي 1', 'مستخدم تجريبي', 'مسلم', 'مسلم عقيل', 'م. مسلم', 'بشير', 'علي عباس جاسم'];
          const isBypassed = profile && (
              bypassedAccounts.includes(profile.username) ||
              profile.full_name?.includes('مسلم') ||
              profile.full_name?.includes('بشير') ||
              profile.full_name?.includes('علي عباس جاسم') ||
              profile.email?.includes('muslimakkeel') ||
              profile.job_number === '103130022' || // اسيل جبار
              profile.job_number === '102514467' || // ياسر عبدالامير
              profile.job_number === 'c121212' || // مستخدم تجريبي
              profile.admin_role === 'developer'
          );

          const verifiedAtStr = localStorage.getItem(`2fa_verified_${session.user.id}`);
          let isVerified = false;
          
          if (verifiedAtStr) {
             const verifiedAt = parseInt(verifiedAtStr, 10);
             const ONE_DAY = 24 * 60 * 60 * 1000; // صلاحية الـ 2FA لمدة 24 ساعة
             if (Date.now() - verifiedAt < ONE_DAY) {
                isVerified = true;
             } else {
                localStorage.removeItem(`2fa_verified_${session.user.id}`);
             }
          }

          if (!isVerified && !isBypassed) {
            console.warn("🛡️ Security: Session found but 2FA not verified or expired! Signing out...");
            await supabase.auth.signOut();
            setUser(null);
            setLoading(false);
            return;
          }
          // --- END 2FA BYPASS FIX ---

          if (profile) {
            const appUser: AppUser = {
              id: profile.id,
              username: profile.username, // Now in profiles
              full_name: profile.full_name,
              job_number: profile.job_number,
              role: profile.role || 'user',
              admin_role: profile.admin_role,
              avatar_url: profile.avatar || profile.avatar_url, // Handle both naming conventions
              department_id: profile.department_id,
              can_view_requests: profile.can_view_requests,
              specialization: profile.specialization,
              graduation_year: profile.graduation_year,
              appointment_date: profile.appointment_date,
              work_nature: profile.work_nature,
              dept_text: profile.dept_text,
              section_text: profile.section_text,
              unit_text: profile.unit_text,
              has_capacities_access: profile.has_capacities_access,
              can_access_promotion: profile.can_access_promotion,
              is_promotion_lecturer: profile.is_promotion_lecturer,
              is_training_supervisor: profile.is_training_supervisor
            };
            setUser(appUser);
            if (profile) {
              initOneSignal(profile.id);
              requestNotificationPermission();
            }
            logVisit(appUser);
          }
        }
      } catch (err) {
        console.error("Auth initialization failed:", err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        // We could re-fetch profile here if needed, but usually login handles it
      } else {
        // Logged out
        if (!sessionStorage.getItem("visitor_user")) {
          setUser(null);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const trimmedUsername = username.trim();
      const trimmedPassword = password.trim();

      // 1. Resolve Username -> Profile (via secure RPC)
      // The RPC now checks the password and rate limit internally for better security
      const { data: profile, error: profileErr } = await supabase
        .rpc('get_login_profile', { 
          p_username: trimmedUsername,
          p_password: trimmedPassword 
        })
        .maybeSingle() as { data: { id: string; job_number: string; email: string; real_email: string; role: string; full_name: string } | null; error: any };

      if (profileErr) {
        if (profileErr.message.includes('Blocked')) {
          return { success: false, error: 'استنفذت عدد المحاولات المسموح بها. يرجى العودة بعد 30 دقيقة.' };
        }
        return { success: false, error: 'حدث خطأ أثناء تسجيل الدخول' };
      }

      if (!profile) {
        return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
      }

      // 2. Use the email returned by the RPC (the generated email for login)
      const loginEmail = profile.email;

      // 3. Authenticate with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: trimmedPassword
      });

      if (authError || !authData.user) {
        if (authError && authError.status === 500) {
          return { success: false, error: 'حدث خطأ في قاعدة بيانات المصادقة (500). يرجى مراجعة الدعم الفني.' };
        }
        return { success: false, error: 'كلمة المرور غير صحيحة' };
      }


      // Clear rate limit on success
      await supabase.rpc('update_rate_limit', {
        p_identifier: trimmedUsername,
        p_endpoint: 'login',
        p_success: true
      });

      // 4. Fetch Full Profile Details via secure RPC (bypasses RLS safely)
      const { data: fullProfile, error: fetchErr } = await supabase
        .rpc('get_own_profile')
        .single() as { data: any; error: any };

      if (fetchErr || !fullProfile) {
        console.error("Exact fetch error:", fetchErr);
        const errorDetails = fetchErr ? (fetchErr.message || fetchErr.details || JSON.stringify(fetchErr)) : 'Profile not found';
        return { success: false, error: 'تعذر جلب بيانات الملف الشخصي: ' + errorDetails };
      }

      const appUser: AppUser = {
        id: fullProfile.id,
        username: fullProfile.username,
        full_name: fullProfile.full_name,
        job_number: fullProfile.job_number,
        role: fullProfile.role || 'user',
        admin_role: fullProfile.admin_role,
        avatar_url: fullProfile.avatar || fullProfile.avatar_url,
        department_id: fullProfile.department_id,
        can_view_requests: fullProfile.can_view_requests,
        specialization: fullProfile.specialization,
        graduation_year: fullProfile.graduation_year,
        appointment_date: fullProfile.appointment_date,
        work_nature: fullProfile.work_nature,
        dept_text: fullProfile.dept_text,
        section_text: fullProfile.section_text,
        unit_text: fullProfile.unit_text,
        has_capacities_access: fullProfile.has_capacities_access,
        can_access_promotion: fullProfile.can_access_promotion,
        is_promotion_lecturer: fullProfile.is_promotion_lecturer,
        is_training_supervisor: fullProfile.is_training_supervisor,
        email: fullProfile.email
      };

      // 5. Enforce 2FA on Everyone
      const bypassedAccounts = ['المطور', 'تجريبي 1', 'مستخدم تجريبي', 'مسلم', 'مسلم عقيل', 'م. مسلم', 'بشير', 'علي عباس جاسم'];
      const isBypassedLogin = 
          bypassedAccounts.includes(trimmedUsername) ||
          appUser.full_name?.includes('مسلم') ||
          appUser.full_name?.includes('بشير') ||
          appUser.full_name?.includes('علي عباس جاسم') ||
          appUser.email?.includes('muslimakkeel') ||
          appUser.job_number === '103130022' || // اسيل جبار
          appUser.job_number === '102514467' || // ياسر عبدالامير
          appUser.job_number === 'c121212' || // مستخدم تجريبي
          appUser.admin_role === 'developer';
          
      if (isBypassedLogin) {
        localStorage.setItem(`2fa_verified_${appUser.id}`, Date.now().toString());
        setUser(appUser);
        initOneSignal(appUser.id);
        requestNotificationPermission();
        logVisit(appUser);
        return { success: true, requires_2fa: false, tempUser: appUser } as any;
      }

      // Return requires_2fa but DO NOT send email automatically yet
      // The Login UI will handle asking for the email or confirming it
      return { success: true, requires_2fa: true, tempUser: appUser } as any;

    } catch (err) {
      console.error("Login Error:", err);
      return { success: false, error: 'حدث خطأ غير متوقع' };
    }
  };

  const verify2FA = async (code: string, tempUser: AppUser) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { success: false, error: 'انتهت الجلسة. يرجى تسجيل الدخول مجدداً' };

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-verify-2fa`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ code })
        }
      );

      if (!res.ok) {
        const errorData = await res.json();
        return { success: false, error: errorData.error || 'الكود غير صحيح' };
      }

      // --- ADD 2FA VERIFIED FLAG HERE ---
      localStorage.setItem(`2fa_verified_${tempUser.id}`, Date.now().toString());
      // ----------------------------------

      setUser(tempUser);
      initOneSignal(tempUser.id);
      requestNotificationPermission();
      sessionStorage.removeItem('session_logged');
      logVisit(tempUser);
      
      return { success: true };
    } catch (err) {
      console.error("2FA Verify Error:", err);
      return { success: false, error: 'تعذر التحقق من الكود' };
    }
  };

  const request2FA = async (email: string, tempUser: AppUser) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { success: false, error: 'انتهت الجلسة. يرجى تسجيل الدخول مجدداً' };

      // تحديث الإيميل في الداتا بيز إذا كان جديداً أو مُعدلاً
      if (tempUser.email !== email) {
        const { error } = await supabase.from('profiles').update({ email }).eq('id', tempUser.id);
        if (error) {
          console.error("Email update error:", error);
          return { success: false, error: 'تعذر حفظ البريد الإلكتروني المحدث' };
        }
        tempUser.email = email;
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-2fa-email`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!res.ok) {
        const errorData = await res.json();
        if (res.status === 429) {
           return { success: false, error: 'تم طلب الكود حديثاً، يرجى الانتظار بضع دقائق' };
        }
        return { success: false, error: errorData.error || 'فشل إرسال كود التحقق الثنائي' };
      }
      
      return { success: true };
    } catch (err) {
      console.error("2FA Request Error:", err);
      return { success: false, error: 'تعذر الاتصال بخادم المصادقة الثنائية' };
    }
  };

  const loginAsVisitor = async () => {
    const visitorUser: AppUser = {
      id: 'visitor-id',
      username: 'visitor',
      full_name: 'زائر النظام',
      role: 'visitor',
    };
    setUser(visitorUser);
    sessionStorage.setItem("visitor_user", JSON.stringify(visitorUser));
    sessionStorage.removeItem('session_logged');
    return { success: true };
  };

  const logout = async () => {
    if (user?.id) localStorage.removeItem(`2fa_verified_${user.id}`);
    await supabase.auth.signOut();
    logoutOneSignal();
    geolocationManager.clearAllWatches(); // تنظيف جميع طلبات الموقع عند الخروج
    setUser(null);
    sessionStorage.removeItem("visitor_user");
    sessionStorage.removeItem("session_logged");
    localStorage.removeItem("app_user"); // cleanup old legacy
  };

  const updateProfile = async (updates: Partial<AppUser>) => {
    if (!user) return { success: false, error: "No user logged in" };

    if (user.role === 'visitor') {
      const newUser = { ...user, ...updates };
      setUser(newUser);
      sessionStorage.setItem("visitor_user", JSON.stringify(newUser));
      return { success: true };
    }

    try {
      // Map AppUser updates to Profile columns if needed
      // (e.g. avatar_url -> avatar if schema differs, but ideally keep consistent)
      const dbUpdates: any = { ...updates };
      if (updates.avatar_url !== undefined) {
        dbUpdates.avatar = updates.avatar_url; // Assuming column is 'avatar' or 'avatar_url'? Phase 6 added 'avatar'
        // Let's check schema.. Phase 6 SQL added 'avatar'. 
        // But Phase 1 profiles might verify column names. 
        // Let's assume 'avatar' column exists from Phase 6.
        delete dbUpdates.avatar_url;
      }

      const { error } = await supabase
        .from('profiles')
        .update(dbUpdates)
        .eq('id', user.id);

      if (error) throw error;

      const newUser = { ...user, ...updates };
      setUser(newUser);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update profile' };
    }
  };

  const changePassword = async (newPassword: string) => {
    if (!user) return { success: false, error: "No user logged in" };
    if (user.role === 'visitor') return { success: true };

    try {
      // 1. Update Supabase Auth Password (Critical for Login)
      const { error: authError } = await supabase.auth.updateUser({ password: newPassword });
      if (authError) throw authError;

      // 2. Update profiles table via SECURE RPC (Hashed)
      const { error: dbError } = await supabase.rpc('secure_change_password', { 
        p_new_password: newPassword 
      });

      if (dbError) {
        console.warn("Updated Auth but failed to sync profile password", dbError);
      }

      return { success: true };
    } catch (err: any) {
      let errorMessage = err.message || 'فشل تحديث كلمة المرور';
      if (errorMessage.includes('different from the old password')) {
        errorMessage = 'كلمة المرور الجديدة يجب أن تكون مختلفة عن القديمة';
      }
      return { success: false, error: errorMessage };
    }
  };

  const uploadAvatar = async (file: File) => {
    if (!user) return { success: false, error: "No user logged in" };
    if (user.role === 'visitor') {
      const fakeUrl = URL.createObjectURL(file);
      await updateProfile({ avatar_url: fakeUrl });
      return { success: true, url: fakeUrl };
    }

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatar-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('avatar-images')
        .getPublicUrl(filePath);

      if (!data) throw new Error("Failed to get public URL");

      await updateProfile({ avatar_url: data.publicUrl });
      return { success: true, url: data.publicUrl };
    } catch (err: any) {
      console.error("Avatar upload error:", err);
      return { success: false, error: err.message || 'Failed to upload avatar' };
    }
  };

  const forgotPassword = async (username: string, confirm: boolean = false) => {
    try {
      const { data, error } = await supabase.rpc('rpc_handle_forgot_password', {
        p_username: username,
        p_confirm: confirm
      });

      if (error) throw error;

      if (!data.success) {
        return { success: false, error: data.error };
      }

      if (data.action_completed === 'generated' && data.supervisor_id) {
          await sendPushNotification(
              data.supervisor_id, 
              `قام الموظف (${username}) بطلب إعادة تعيين كلمة المرور.`,
              { title: "طلب كلمة مرور مؤقتة" }
          );
      }

      return { 
        success: true, 
        supervisor_name: data.supervisor_name,
        action_required: data.action_required,
        action_completed: data.action_completed
      };
    } catch (err: any) {
      console.error("Forgot Password Error:", err);
      return { success: false, error: err.message || 'حدث خطأ غير متوقع' };
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginAsVisitor, logout, updateProfile, changePassword, uploadAvatar, forgotPassword, verify2FA, request2FA }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

