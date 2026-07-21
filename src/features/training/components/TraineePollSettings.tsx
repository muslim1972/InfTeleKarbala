import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { toast } from 'react-hot-toast';
import { Link as LinkIcon, Save, Loader2, Eye, EyeOff } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useTheme } from '../../../context/ThemeContext';
import { useQueryClient } from '@tanstack/react-query';

export const TraineePollSettings = () => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const queryClient = useQueryClient();
    
    const [pollLink, setPollLink] = useState('');
    const [pollLinkTitle, setPollLinkTitle] = useState('');
    const [pollLinkActive, setPollLinkActive] = useState(true);
    const [pollLinkExists, setPollLinkExists] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadPollData();
    }, []);

    const loadPollData = async () => {
        try {
            const { data, error } = await supabase
                .from('media_content')
                .select('*')
                .eq('type', 'poll_link_training')
                .limit(1)
                .maybeSingle();

            if (error) throw error;

            if (data) {
                setPollLink(data.content || '');
                setPollLinkTitle(data.title || '');
                setPollLinkActive(data.is_active ?? true);
                setPollLinkExists(true);
            }
        } catch (error) {
            console.error('Error loading trainee poll:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSavePoll = async () => {
        if (!pollLink.trim() && !pollLinkTitle.trim()) {
            toast.error('يرجى ملء الحقول أولاً');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                type: 'poll_link_training',
                content: pollLink.trim(),
                title: pollLinkTitle.trim() || null,
                is_active: true, // دائماً فعّال عند الحفظ
                updated_at: new Date().toISOString()
            };

            if (pollLinkExists) {
                const { error } = await supabase
                    .from('media_content')
                    .update(payload)
                    .eq('type', 'poll_link_training');

                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('media_content')
                    .insert(payload);

                if (error) throw error;
                setPollLinkExists(true);
            }

            setPollLinkActive(true);
            queryClient.invalidateQueries({ queryKey: ['trainee_poll_link'] });
            queryClient.invalidateQueries({ queryKey: ['mediaContent'] });

            toast.success('تم حفظ وتفعيل الرابط بنجاح');
        } catch (error: any) {
            console.error('Error saving trainee poll:', error);
            toast.error('حدث خطأ أثناء حفظ الرابط');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleActive = async () => {
        if (!pollLinkExists) return;
        
        const newValue = !pollLinkActive;
        setPollLinkActive(newValue);
        
        try {
            const { error } = await supabase
                .from('media_content')
                .update({ is_active: newValue })
                .eq('type', 'poll_link_training');

            if (error) throw error;

            queryClient.invalidateQueries({ queryKey: ['trainee_poll_link'] });
            queryClient.invalidateQueries({ queryKey: ['mediaContent'] });
                
            toast.success(newValue ? 'تم إظهار الرابط للمتدربين' : 'تم إخفاء الرابط عن المتدربين');
        } catch (error) {
            setPollLinkActive(!newValue);
            toast.error('حدث خطأ أثناء تحديث حالة الرابط');
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center p-4">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
            </div>
        );
    }

    return (
        <div className={cn(
            "p-4 rounded-2xl border shadow-sm space-y-3 animate-in fade-in slide-in-from-top-2",
            pollLinkActive
                ? isDark ? "bg-black/20 border-white/5" : "bg-white/50 border-gray-200"
                : isDark ? "bg-red-900/10 border-red-500/20" : "bg-red-50/50 border-red-200/50"
        )}>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-emerald-500 font-bold text-sm">
                    <LinkIcon className="w-4 h-4" />
                    <span>رابط استطلاع المتدربين (يظهر في واجهة المتدرب)</span>
                </div>
                {pollLinkExists && (
                    <button
                        onClick={handleToggleActive}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                            pollLinkActive
                                ? isDark ? "bg-red-900/30 text-red-400 hover:bg-red-900/50" : "bg-red-100 text-red-600 hover:bg-red-200"
                                : isDark ? "bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50" : "bg-emerald-100 text-emerald-600 hover:bg-emerald-200"
                        )}
                        title={pollLinkActive ? 'إخفاء الرابط عن المتدربين' : 'إظهار الرابط للمتدربين'}
                    >
                        {pollLinkActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        {pollLinkActive ? 'إخفاء' : 'إظهار'}
                    </button>
                )}
            </div>
            
            {!pollLinkActive && pollLinkExists && (
                <div className={cn(
                    "text-xs px-3 py-1.5 rounded-lg mb-2",
                    isDark ? "text-red-400 bg-red-900/20" : "text-red-500 bg-red-100/50"
                )}>
                    ⚠️ الرابط مخفي حالياً عن المتدربين. اضغط "إظهار" لتفعيله.
                </div>
            )}
            
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <label className={cn("text-sm font-bold shrink-0 sm:w-24", isDark ? "text-white/80" : "text-gray-700")}>
                    عنوان الرابط
                </label>
                <input
                    type="text"
                    value={pollLinkTitle}
                    onChange={e => setPollLinkTitle(e.target.value)}
                    placeholder="مثلاً: استطلاع تقييم التدريب الصيفي"
                    className={cn(
                        "flex-1 border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500/50",
                        isDark ? "bg-black/40 border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"
                    )}
                />
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <label className={cn("text-sm font-bold shrink-0 sm:w-24", isDark ? "text-white/80" : "text-gray-700")}>
                    رابط الاستطلاع
                </label>
                <input
                    type="text"
                    value={pollLink}
                    onChange={e => setPollLink(e.target.value)}
                    placeholder="مثلاً: https://forms.gle/..."
                    className={cn(
                        "flex-1 border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500/50",
                        isDark ? "bg-black/40 border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"
                    )}
                    dir="ltr"
                />
            </div>
            
            <button
                onClick={handleSavePoll}
                disabled={saving}
                className="w-full mt-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
            >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                حفظ الرابط
            </button>
        </div>
    );
};
