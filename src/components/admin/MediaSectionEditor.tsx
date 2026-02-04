import { useState, useEffect } from 'react';
import { Save, Loader2, CheckCircle, AlertCircle, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface MediaSectionEditorProps {
    type: 'directive' | 'conference';
    title: string;
    placeholder: string;
}

export function MediaSectionEditor({ type, title, placeholder }: MediaSectionEditorProps) {
    const { user } = useAuth();
    const [content, setContent] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [originalContent, setOriginalContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [contentId, setContentId] = useState<string | null>(null);

    useEffect(() => {
        fetchContent();
    }, [type]);

    const fetchContent = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('media_content')
                .select('*')
                .eq('type', type)
                .limit(1)
                .maybeSingle();

            if (error) {
                console.error(`Error fetching ${type}:`, error);
            } else if (data) {
                setContent(data.content || '');
                setOriginalContent(data.content || '');
                setIsActive(data.is_active ?? true);
                setContentId(data.id);
            }
        } catch (err) {
            console.error(`Exception fetching ${type}:`, err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!user?.id) return;

        setSaving(true);
        setSaveStatus('idle');

        try {
            const payload = {
                type,
                content,
                is_active: isActive,
                updated_at: new Date().toISOString(),
                updated_by: user.id
            };

            if (contentId) {
                const { error } = await supabase
                    .from('media_content')
                    .update(payload)
                    .eq('id', contentId);

                if (error) throw error;
            } else {
                const { data, error } = await supabase
                    .from('media_content')
                    .insert(payload)
                    .select()
                    .single();

                if (error) throw error;
                if (data) setContentId(data.id);
            }

            setOriginalContent(content);
            setSaveStatus('success');
            setTimeout(() => setSaveStatus('idle'), 3000);
        } catch (err) {
            console.error(`Error saving ${type}:`, err);
            setSaveStatus('error');
            setTimeout(() => setSaveStatus('idle'), 3000);
        } finally {
            setSaving(false);
        }
    };

    const handleClear = async () => {
        if (!confirm('هل أنت متأكد من مسح المحتوى؟ سيتم إخفاء الزر لدى المستخدمين.')) return;
        setContent('');
        setIsActive(false);
        // We trigger save immediately to reflect "emptied" state
        setTimeout(() => handleSave(), 100);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin text-brand-green" size={24} />
            </div>
        );
    }

    return (
        <div className="bg-black/20 p-4 rounded-xl border border-white/5 space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-white/70 font-bold text-sm">{title}</h3>
                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={isActive}
                            onChange={e => setIsActive(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-brand-green focus:ring-brand-green"
                        />
                        <span className="text-white/60 text-xs">تفعيل الظهور</span>
                    </label>
                </div>
            </div>

            <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={placeholder}
                className="w-full h-32 p-4 bg-slate-900/50 border border-white/10 rounded-xl 
                         text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-1 
                         focus:ring-brand-green/50 focus:border-brand-green/50 transition-all
                         text-base leading-relaxed"
                dir="rtl"
            />

            <div className="flex justify-between items-center">
                <button
                    onClick={handleClear}
                    className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1 transition-colors"
                    title="مسح المحتوى وإلغاء التفعيل"
                >
                    <Trash2 size={14} />
                    <span>مسح</span>
                </button>

                <div className="flex items-center gap-3">
                    {saveStatus === 'success' && <span className="text-brand-green text-xs flex items-center gap-1"><CheckCircle size={14} /> تم الحفظ</span>}
                    {saveStatus === 'error' && <span className="text-red-400 text-xs flex items-center gap-1"><AlertCircle size={14} /> خطأ</span>}

                    <button
                        onClick={handleSave}
                        disabled={saving || (content === originalContent && isActive)}
                        className={`
                            flex items-center justify-center gap-2 px-6 py-2 rounded-lg font-bold text-sm transition-all
                            ${(content !== originalContent || !isActive)
                                ? 'bg-brand-green hover:bg-brand-green-hover text-white shadow-lg shadow-brand-green/20'
                                : 'bg-white/5 text-gray-500 cursor-not-allowed'
                            }
                        `}
                    >
                        {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                        {saving ? 'جاري الحفظ...' : 'حفظ'}
                    </button>
                </div>
            </div>
        </div>
    );
}
