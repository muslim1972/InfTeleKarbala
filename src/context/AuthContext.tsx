
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export interface AppUser {
  id: string;
  username: string;
  full_name: string;
  job_number?: string;
  role: string;
  admin_role?: string; // developer, media, etc.
  avatar_url?: string | null;
  iban?: string;
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
          // Fetch full profile
          const { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (profileErr) {
            console.error("Profile fetch error:", profileErr);
          } else if (profile) {
            const appUser: AppUser = {
              id: profile.id,
              username: profile.username, // Now in profiles
              full_name: profile.full_name,
              job_number: profile.job_number,
              role: profile.role || 'user',
              admin_role: profile.admin_role,
              avatar_url: profile.avatar || profile.avatar_url, // Handle both naming conventions
              iban: profile.iban
            };
            setUser(appUser);
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
      // 1. Resolve Username -> Email (via Profiles)
      // Since we don't know the email directly, we look up the profile by username first.
      // This requires the 'profiles' table to be readable (publicly or via service role if RLS is strict).
      // Assuming 'profiles' is readable by authenticated users OR anon (for login lookup).
      // A better way for security: Use an Edge Function. But here we query directly.

      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('job_number, id')
        .eq('username', username)
        .maybeSingle();

      if (profileErr || !profile || !profile.job_number) {
        // Security: Don't reveal if user exists vs wrong password, but here we know user validation failed
        return { success: false, error: 'اسم المستخدم غير صحيح' };
      }

      // 2. Construct Email
      const email = `${profile.job_number}@inftele.com`;

      // 3. Authenticate with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError || !authData.user) {
        console.error("Auth Failed:", authError?.message);
        return { success: false, error: 'كلمة المرور غير صحيحة' };
      }

      // 4. Fetch Full Profile Details (including newly added columns)
      const { data: fullProfile, error: fetchErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (fetchErr || !fullProfile) {
        return { success: false, error: 'تعذر جلب بيانات الملف الشخصي' };
      }

      const appUser: AppUser = {
        id: fullProfile.id,
        username: fullProfile.username,
        full_name: fullProfile.full_name,
        job_number: fullProfile.job_number,
        role: fullProfile.role || 'user',
        admin_role: fullProfile.admin_role,
        avatar_url: fullProfile.avatar || fullProfile.avatar_url,
        iban: fullProfile.iban
      };

      setUser(appUser);
      sessionStorage.removeItem('session_logged');
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

      // 2. Update 'password' column in profiles (Sync for reference/legacy/custom auth)
      const { error: dbError } = await supabase
        .from('profiles')
        .update({ password: newPassword })
        .eq('id', user.id);

      if (dbError) {
        console.warn("Updated Auth but failed to sync profile password column", dbError);
        // Non-blocking, as Auth is primary now
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update password' };
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

  return (
    <AuthContext.Provider value={{ user, loading, login, loginAsVisitor, logout, updateProfile, changePassword, uploadAvatar }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

