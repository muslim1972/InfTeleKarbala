import { useState, useEffect, useRef } from 'react';
import { Save, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import TipsMarquee from '../ui/TipsMarquee';
import { useAuth } from '../../context/AuthContext';

interface TipsEditorProps {
    appName: string;
}

const TipsEditor = ({ appName }: TipsEditorProps) => {
    const { user } = useAuth();
    const [content, setContent] = useState('');
    const [originalContent, setOriginalContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [tipId, setTipId] = useState<string | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        const fetchTip = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('admin_tips')
                    .select('*')
                    .eq('app_name', appName)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (error) {
                    console.error('Error fetching tip:', error);
                } else if (data) {
                    setContent(data.content);
                    setOriginalContent(data.content);
                    setTipId(data.id);
                }
            } catch (err) {
                console.error('Exception fetching tip:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchTip();
    }, [appName]);

    const handleSave = async () => {
        if (!user?.id || content === originalContent) return;

        setSaving(true);
        setSaveStatus('idle');

        try {
            if (tipId) {
                const { error } = await supabase
                    .from('admin_tips')
                    .update({
                        content,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', tipId);

                if (error) throw error;
            } else {
                const { data, error } = await supabase
                    .from('admin_tips')
                    .insert({
                        app_name: appName,
                        content,
                        created_by: user.id
                    })
                    .select()
                    .single();

                if (error) throw error;
                if (data) setTipId(data.id);
            }

            setOriginalContent(content);
            setSaveStatus('success');
            setTimeout(() => setSaveStatus('idle'), 3000);
        } catch (err) {
            console.error('Error saving tip:', err);
            setSaveStatus('error');
            setTimeout(() => setSaveStatus('idle'), 3000);
        } finally {
            setSaving(false);
        }
    };

    const charCount = content.length;
    const maxChars = 5000;
    const hasChanges = content !== originalContent;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-brand-green" size={32} />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                <h3 className="text-white/70 font-bold mb-2 text-sm">محتوى شريط الاخبار</h3>
                <div className="relative">
                    <textarea
                        ref={textareaRef}
                        value={content}
                        onChange={(e) => {
                            if (e.target.value.length <= maxChars) {
                                setContent(e.target.value);
                            }
                        }}
                        placeholder="اكتب الاخبار هنا...\nمثال: اعلان هام للموظفين\nتحديث جديد للنظام"
                        className="w-full h-40 p-4 bg-slate-900/50 border border-white/10 rounded-xl 
                         text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-1 
                         focus:ring-brand-green/50 focus:border-brand-green/50 transition-all
                         text-base leading-relaxed"
                        dir="rtl"
                    />
                    <div className="absolute bottom-3 left-3 text-xs text-white/30">
                        {charCount} / {maxChars}
                    </div>
                </div>

                <div className="flex justify-between items-center mt-3">
                    <div className="flex items-center gap-2">
                        {saveStatus === 'success' && <span className="text-brand-green text-xs flex items-center gap-1"><CheckCircle size={14} /> تم الحفظ</span>}
                        {saveStatus === 'error' && <span className="text-red-400 text-xs flex items-center gap-1"><AlertCircle size={14} /> خطأ في الحفظ</span>}
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={saving || !hasChanges}
                        className={`
                            flex items-center justify-center gap-2 px-6 py-2 rounded-lg font-bold text-sm transition-all
                            ${hasChanges
                                ? 'bg-brand-green hover:bg-brand-green-hover text-white shadow-lg shadow-brand-green/20'
                                : 'bg-white/5 text-gray-500 cursor-not-allowed'
                            }
                        `}
                    >
                        {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                        {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                    </button>
                </div>
            </div>

            <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                <h3 className="text-white/70 font-bold mb-2 text-sm">معاينة الشريط</h3>
                <div className="relative h-12 rounded-lg overflow-hidden border border-white/10">
                    <TipsMarquee
                        appName={appName}
                        className="!bg-slate-900 border-none h-full"
                        manualTips={content.split('\n').filter(Boolean)}
                    />
                </div>
            </div>
        </div>
    );
};

export default TipsEditor;
