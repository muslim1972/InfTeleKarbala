import { useState, useEffect } from 'react';
import { Save, Loader2, CheckCircle, AlertCircle, Trash2, Search, UserCheck, X } from 'lucide-react';
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

    // Search & Check State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [checkResult, setCheckResult] = useState<{ status: 'acknowledged' | 'pending', date?: string, userName: string } | null>(null);

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

    const handleSearch = async (query: string) => {
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }

        const { data } = await supabase
            .from('profiles')
            .select('id, full_name, username, job_number')
            .or(`full_name.ilike.%${query}%,username.ilike.%${query}%,job_number.ilike.%${query}%`)
            .limit(5);

        if (data) setSearchResults(data);
    };

    const checkAcknowledgment = async (profile: any) => {
        setSearchQuery('');
        setSearchResults([]);
        if (!contentId) return;

        try {
            const { data, error } = await supabase
                .from('user_acknowledgments')
                .select('acknowledged_at')
                .eq('user_id', profile.id)
                .eq('content_id', contentId)
                .maybeSingle();

            if (error && error.code !== 'PGRST116') throw error;

            setCheckResult({
                status: data ? 'acknowledged' : 'pending',
                date: data?.acknowledged_at,
                userName: profile.full_name || profile.username
            });
        } catch (err) {
            console.error("Error checking acknowledgment:", err);
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
        <div className="bg-card p-4 rounded-xl border border-border space-y-4 shadow-sm relative">
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

            {/* Acknowledgment Check Section - Only for Directives */}
            {type === 'directive' && contentId && (
                <div className="pt-4 mt-4 border-t border-border/50">
                    <h4 className="text-xs font-bold text-muted-foreground mb-3 flex items-center gap-2">
                        <UserCheck size={14} />
                        فحص سجل التبليغ للموظفين
                    </h4>

                    <div className="relative">
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute right-3 top-2.5 text-muted-foreground w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="بحث عن موظف (الاسم، الرقم الوظيفي)..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        handleSearch(e.target.value);
                                    }}
                                    className="w-full pl-3 pr-9 py-2 bg-muted/30 border border-input rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-green"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => {
                                            setSearchQuery('');
                                            setSearchResults([]);
                                            setCheckResult(null);
                                        }}
                                        className="absolute left-2 top-2.5 text-muted-foreground hover:text-foreground"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Search Results Dropdown - Now appearing upwards */}
                        {searchResults.length > 0 && (
                            <div className="absolute bottom-full mb-1 right-0 left-0 bg-popover border border-border rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                                {searchResults.map(profile => (
                                    <button
                                        key={profile.id}
                                        onClick={() => checkAcknowledgment(profile)}
                                        className="w-full text-right px-3 py-2 hover:bg-muted/50 text-sm flex items-center justify-between group border-b border-border/50 last:border-none"
                                    >
                                        <span className="font-bold text-foreground/80 group-hover:text-brand-green transition-colors">
                                            {profile.full_name || profile.username}
                                        </span>
                                        <span className="text-xs text-muted-foreground font-mono">
                                            {profile.job_number}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Check Result */}
                    {checkResult && (
                        <div className={cn(
                            "mt-3 p-3 rounded-lg border flex items-start gap-3 animate-in fade-in slide-in-from-top-1",
                            checkResult.status === 'acknowledged'
                                ? "bg-green-500/10 border-green-500/20"
                                : "bg-red-500/10 border-red-500/20"
                        )}>
                            <div className={cn(
                                "p-1.5 rounded-full mt-0.5",
                                checkResult.status === 'acknowledged' ? "bg-green-500/20 text-green-600" : "bg-red-500/20 text-red-600"
                            )}>
                                {checkResult.status === 'acknowledged' ? <CheckCircle size={16} /> : <X size={16} />}
                            </div>
                            <div>
                                <p className={cn(
                                    "font-bold text-sm",
                                    checkResult.status === 'acknowledged' ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"
                                )}>
                                    {checkResult.userName}
                                </p>
                                <p className="text-muted-foreground text-xs mt-1">
                                    {checkResult.status === 'acknowledged'
                                        ? `تم التبليغ بتاريخ: ${new Date(checkResult.date!).toLocaleString('ar-IQ')}`
                                        : "لم يتم التبليغ حتى الآن"}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
