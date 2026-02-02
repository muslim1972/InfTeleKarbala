import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export interface AppUser {
  id: string;
  username: string;
  full_name: string;
  job_number?: string;
  role: string;
  avatar_url?: string | null;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateProfile: (updates: Partial<AppUser>) => Promise<{ success: boolean; error?: string }>;
  changePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  uploadAvatar: (file: File) => Promise<{ success: boolean; url?: string; error?: string }>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => ({ success: false }),
  logout: () => { },
  updateProfile: async () => ({ success: false }),
  changePassword: async () => ({ success: false }),
  uploadAvatar: async () => ({ success: false }),
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check local storage for persistent session
    const storedUser = localStorage.getItem("app_user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error("Failed to parse stored user", e);
        localStorage.removeItem("app_user");
      }
    }
    setLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .single();

      if (error || !data) {
        return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
      }

      const appUser: AppUser = {
        id: data.id,
        username: data.username,
        full_name: data.full_name,
        job_number: data.job_number,
        role: data.role,
        avatar_url: data.avatar_url
      };

      setUser(appUser);
      localStorage.setItem("app_user", JSON.stringify(appUser));
      return { success: true };

    } catch (err) {
      return { success: false, error: 'حدث خطأ في الاتصال' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("app_user");
  };

  const updateProfile = async (updates: Partial<AppUser>) => {
    if (!user) return { success: false, error: "No user logged in" };

    try {
      const { error } = await supabase
        .from('app_users')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;

      const newUser = { ...user, ...updates };
      setUser(newUser);
      localStorage.setItem("app_user", JSON.stringify(newUser));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update profile' };
    }
  };

  const changePassword = async (newPassword: string) => {
    if (!user) return { success: false, error: "No user logged in" };

    // Note: In a real app with Supabase Auth, you'd use supabase.auth.updateUser().
    // Since we use a custom table, we update the column directly.
    try {
      const { error } = await supabase
        .from('app_users')
        .update({ password: newPassword })
        .eq('id', user.id);

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update password' };
    }
  };

  const uploadAvatar = async (file: File) => {
    if (!user) return { success: false, error: "No user logged in" };

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

      // Update user profile with new URL
      const updateResult = await updateProfile({ avatar_url: data.publicUrl });
      if (!updateResult.success) throw new Error(updateResult.error);

      return { success: true, url: data.publicUrl };
    } catch (err: any) {
      console.error("Avatar upload error:", err);
      return { success: false, error: err.message || 'Failed to upload avatar' };
    }
  };


  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateProfile, changePassword, uploadAvatar }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
