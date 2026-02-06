import { useState, useEffect } from 'react';
import { Save, Loader2, CheckCircle, AlertCircle, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';

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
        <div className="bg-card p-4 rounded-xl border border-border space-y-4 shadow-sm">
            <div className="flex justify-between items-center">
                <h3 className="text-foreground/70 font-bold text-sm">{title}</h3>
                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={isActive}
                            onChange={e => setIsActive(e.target.checked)}
                            className="w-4 h-4 rounded border-input bg-background text-brand-green focus:ring-brand-green"
                        />
                        <span className="text-muted-foreground text-xs">تفعيل الظهور</span>
                    </label>
                </div>
            </div>

            <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={placeholder}
                className="w-full h-32 p-4 bg-muted/50 border border-input rounded-xl 
                         text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 
                         focus:ring-ring focus:border-ring transition-all
                         text-base leading-relaxed"
                dir="rtl"
            />

            <div className="flex justify-between items-center">
                <Button
                    variant="ghost"
                    onClick={handleClear}
                    className="text-destructive hover:text-destructive/90 hover:bg-destructive/10 text-xs flex items-center gap-1 h-8 px-2"
                    title="مسح المحتوى وإلغاء التفعيل"
                >
                    <Trash2 size={14} />
                    <span>مسح</span>
                </Button>

                <div className="flex items-center gap-3">
                    {saveStatus === 'success' && <span className="text-brand-green text-xs flex items-center gap-1"><CheckCircle size={14} /> تم الحفظ</span>}
                    {saveStatus === 'error' && <span className="text-destructive text-xs flex items-center gap-1"><AlertCircle size={14} /> خطأ</span>}

                    <Button
                        onClick={handleSave}
                        disabled={saving || (content === originalContent && isActive)}
                        className={cn(
                            "flex items-center justify-center gap-2 px-6 h-9 rounded-lg font-bold text-sm transition-all",
                            (content !== originalContent || !isActive)
                                ? "bg-brand-green hover:bg-brand-green/90 text-white shadow-lg shadow-brand-green/20"
                                : "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
                        )}
                    >
                        {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                        {saving ? 'جاري الحفظ...' : 'حفظ'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
