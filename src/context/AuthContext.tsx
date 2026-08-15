
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { sendPushNotification, initOneSignal, logoutOneSignal } from "../services/notifications";
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
  face_descriptor?: number[] | null;
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
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  // تهيئة فورية للمستخدم من الكاش المحلي لمنع الشاشة البيضاء والتحميل الطويل نهائياً
  const [user, setUser] = useState<AppUser | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const visitor = sessionStorage.getItem("visitor_user");
      if (visitor) return JSON.parse(visitor);

      const cached = localStorage.getItem("cached_app_user");
      if (cached) return JSON.parse(cached);
    } catch (e) {
      console.warn("Error reading cached user", e);
    }
    return null;
  });

  const [loading, setLoading] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      if (sessionStorage.getItem("visitor_user")) return false;
      if (localStorage.getItem("cached_app_user")) return false;
    } catch (e) {}
    return true;
  });

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
      setUser(userData);
      localStorage.setItem("cached_app_user", JSON.stringify(userData));
      sessionStorage.setItem('session_logged', 'true');
    } catch (e) {
      console.error("Failed to log visit", e);
    }
  };

  // Check current session on mount
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      try {
        // 1. Check for Visitor Session
        const visitor = sessionStorage.getItem("visitor_user");
        if (visitor) {
          if (isMounted) {
            setUser(JSON.parse(visitor));
            setLoading(false);
          }
          return;
        }

        // 2. Check Supabase Session مع مهلة زمنية سريعة (2.5 ثانية كحد أقصى) لتفادي تعليق الـ Refresh Token
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<{ data: { session: null }; error: any }>((resolve) =>
          setTimeout(() => resolve({ data: { session: null }, error: { message: 'auth_timeout' } }), 2500)
        );

        const { data, error: sessionError } = await Promise.race([sessionPromise, timeoutPromise]);

        if (sessionError) {
          const errStr = String((sessionError as any)?.message || sessionError || '');
          if (errStr.includes('auth_timeout') || errStr.includes('Invalid Refresh Token') || errStr.includes('Refresh Token Not Found')) {
            console.warn("⚠️ Invalid or timed out auth token detected. Cleaning local storage...");
            try {
              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
                  localStorage.removeItem(key);
                }
              }
              supabase.auth.signOut().catch(() => {});
            } catch (e) {}
          }
        }

        const session = data?.session;
        if (session?.user) {
          // Fetch full profile via secure RPC مع مهلة أمان سريعة (2.5 ثانية)
          const profilePromise = supabase.rpc('get_own_profile').single();
          const profileTimeout = new Promise<{ data: any; error: any }>((resolve) =>
            setTimeout(() => resolve({ data: null, error: 'profile_timeout' }), 2500)
          );
          const { data: profile, error: profileErr }: any = await Promise.race([profilePromise, profileTimeout]);

          if (profile && isMounted) {
            const appUser: AppUser = {
              id: profile.id,
              username: profile.username,
              full_name: profile.full_name,
              job_number: profile.job_number,
              role: profile.role || 'user',
              admin_role: profile.admin_role,
              avatar_url: profile.avatar || profile.avatar_url,
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
              is_training_supervisor: profile.is_training_supervisor,
              face_descriptor: profile.face_descriptor
            };
            setUser(appUser);
            localStorage.setItem("cached_app_user", JSON.stringify(appUser));

            // تشغيل الإشعارات وسجل الدخول في الخلفية دون حجب التطبيق
            setTimeout(() => {
              initOneSignal(appUser.id).catch(() => {});
              logVisit(appUser).catch(() => {});
            }, 1000);
          }
        } else if (!session && (sessionError as any)?.message !== 'auth_timeout') {
          localStorage.removeItem("cached_app_user");
          if (isMounted && !sessionStorage.getItem("visitor_user")) {
            setUser(null);
          }
        }
      } catch (err) {
        console.error("Auth initialization failed:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        if (!sessionStorage.getItem("visitor_user")) {
          localStorage.removeItem("cached_app_user");
          if (isMounted) setUser(null);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
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
        email: fullProfile.email,
        face_descriptor: fullProfile.face_descriptor
      };

      setUser(appUser);
      initOneSignal(appUser.id);
      logVisit(appUser);
      return { success: true };

    } catch (err) {
      console.error("Login Error:", err);
      return { success: false, error: 'حدث خطأ غير متوقع' };
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
    await supabase.auth.signOut();
    geolocationManager.clearAllWatches(); // تنظيف جميع طلبات الموقع عند الخروج
    logoutOneSignal();
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
    <AuthContext.Provider value={{ user, loading, login, loginAsVisitor, logout, updateProfile, changePassword, uploadAvatar, forgotPassword }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

