import { useState, useEffect, useRef } from 'react';
import { Search, User, X, ShieldCheck } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useEmployeeSearch } from '../../../hooks/useEmployeeSearch';
import { governorateName } from '../../../constants/governorates';

interface Profile {
    id: string;
    full_name: string;
    job_number: string;
    avatar_url?: string | null;
}

interface UP_ItSupervisorFieldProps {
    onSelect: (supervisorId: string | null) => void;
    selectedSupervisorId: string | null;
    governorate?: string;
}

/**
 * حقل «تحديد مشرف IT» (معزول - المحدث العام)
 * حقل اختياري: بحث محصور بمحافظة الهدف لرفع صلاحيات موظف إلى مشرف IT بعد الحقن.
 */
export const UP_ItSupervisorField = ({ onSelect, selectedSupervisorId, governorate }: UP_ItSupervisorFieldProps) => {
    // البحث المحصور بمحافظة الهدف فقط
    const { query, setQuery, results: rawResults } = useEmployeeSearch({
        selectFields: 'id, full_name, job_number, avatar_url',
        limit: 10,
        debounceMs: 300,
        governorate: governorate,
        usePublicView: false
    });
    const results: Profile[] = rawResults.map((d: any) => ({
        id: d.id,
        full_name: d.full_name || 'مستخدم',
        job_number: d.job_number,
        avatar_url: d.avatar_url
    }));
    const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
    const [isExistingSupervisor, setIsExistingSupervisor] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [dropdownPlacement, setDropdownPlacement] = useState<'up' | 'down'>('up');
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputContainerRef = useRef<HTMLDivElement>(null);
    const userClearedGovRef = useRef<string | null>(null);

    // تحسس مساحة الشاشة لتوجيه القائمة للأعلى أو للأسفل بذكاء
    useEffect(() => {
        if (isOpen && inputContainerRef.current) {
            const rect = inputContainerRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            if (spaceBelow < 280) {
                setDropdownPlacement('up');
            } else {
                setDropdownPlacement('down');
            }
        }
    }, [isOpen]);

    // إغلاق القائمة عند النقر خارجه
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    // 🧠 فحص واكتشاف مشرف IT المثبت مسبقاً لهذه المحافظة تلقائياً
    useEffect(() => {
        if (!governorate) return;
        // إذا قام المطور بإلغاء التثبيت يدوياً لهذه المحافظة، لا نعيد اختياره تلقائياً
        if (userClearedGovRef.current === governorate) return;

        let isMounted = true;
        const checkExistingSupervisor = async () => {
            try {
                // 1. البحث عن مشرف IT مثبت مسبقاً في هذه المحافظة
                let { data, error } = await supabase
                    .from('profiles')
                    .select('id, full_name, job_number, avatar_url, admin_role, role')
                    .eq('governorate', governorate)
                    .eq('admin_role', 'it_supervisor')
                    .limit(1)
                    .maybeSingle();

                // 2. كخيار بديل: مسؤول المحافظة
                if (!data && !error) {
                    const { data: adminData } = await supabase
                        .from('profiles')
                        .select('id, full_name, job_number, avatar_url, admin_role, role')
                        .eq('governorate', governorate)
                        .eq('role', 'admin')
                        .limit(1)
                        .maybeSingle();
                    data = adminData;
                }

                if (!isMounted || !data) return;

                const prof: Profile = {
                    id: data.id,
                    full_name: data.full_name || 'مشرف IT',
                    job_number: data.job_number,
                    avatar_url: data.avatar_url
                };
                setSelectedProfile(prof);
                setIsExistingSupervisor(true);
                onSelect(data.id);
            } catch (err) {
                console.error('Error finding existing IT supervisor:', err);
            }
        };

        checkExistingSupervisor();

        return () => {
            isMounted = false;
        };
    }, [governorate]);

    // تحميل الملف المختار عند توفر المعرف
    useEffect(() => {
        const fetchSelectedProfile = async () => {
            if (selectedSupervisorId && (!selectedProfile || selectedProfile.id !== selectedSupervisorId)) {
                const { data } = await supabase
                    .from('profiles')
                    .select('id, full_name, job_number, avatar_url')
                    .eq('id', selectedSupervisorId)
                    .single();
                if (data) setSelectedProfile({
                    id: data.id,
                    full_name: data.full_name || 'مستخدم غير معروف',
                    job_number: data.job_number,
                    avatar_url: data.avatar_url
                });
            } else if (!selectedSupervisorId) {
                setSelectedProfile(null);
                setIsExistingSupervisor(false);
            }
        };
        fetchSelectedProfile();
    }, [selectedSupervisorId]);

    const handleSelect = (profile: Profile) => {
        setSelectedProfile(profile);
        setIsExistingSupervisor(false);
        onSelect(profile.id);
        setIsOpen(false);
        setQuery('');
    };

    const clearSelection = () => {
        userClearedGovRef.current = governorate || null;
        setSelectedProfile(null);
        setIsExistingSupervisor(false);
        onSelect(null);
        setQuery('');
    };

    return (
        <div className="relative" ref={wrapperRef}>
            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 font-tajawal">
                <ShieldCheck size={16} className="text-blue-600 dark:text-blue-400" />
                <span>تحديد مشرف IT لمحافظة ({governorateName(governorate)})</span>
                <span className="text-xs text-gray-400 font-normal">(اختياري)</span>
            </label>

            {selectedProfile ? (
                <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center overflow-hidden">
                            {selectedProfile.avatar_url ? (
                                <img src={selectedProfile.avatar_url} alt={selectedProfile.full_name} className="w-full h-full object-cover" />
                            ) : (
                                <User className="text-blue-600 dark:text-blue-300" size={20} />
                            )}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <p className="font-bold text-gray-900 dark:text-gray-100">{selectedProfile.full_name}</p>
                                {isExistingSupervisor && (
                                    <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                        ✓ مثبت حالياً
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{selectedProfile.job_number}</p>
                            <p className="text-xs text-blue-600 dark:text-blue-400">
                                {isExistingSupervisor 
                                    ? `مشرف IT الحالي لمحافظة ${governorateName(governorate)} — سيتم الإبقاء على صلاحياته`
                                    : `سيتم رفع صلاحياته إلى مشرف IT لمحافظة ${governorateName(governorate)}`}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={clearSelection}
                        className="p-2 text-gray-500 hover:text-red-500 transition-colors"
                        title="إلغاء الاختيار"
                    >
                        <X size={18} />
                    </button>
                </div>
            ) : (
                <div className="relative" ref={inputContainerRef}>
                    <input
                        type="text"
                        className="w-full px-4 py-3 pl-10 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition font-tajawal text-sm"
                        placeholder={`ابحث عن موظف في ${governorateName(governorate)} لرفع صلاحياته إلى مشرف IT...`}
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setIsOpen(true);
                        }}
                        onFocus={() => setIsOpen(true)}
                    />
                    <Search className="absolute left-3 top-3.5 text-gray-400 pointer-events-none" size={18} />

                    {isOpen && (query.trim() || results.length > 0) && (
                        <div className={`absolute z-50 w-full bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 max-h-60 overflow-y-auto ${
                            dropdownPlacement === 'up'
                                ? 'bottom-full mb-2 shadow-[0_-8px_25px_rgba(0,0,0,0.18)]'
                                : 'top-full mt-2 shadow-[0_8px_25px_rgba(0,0,0,0.18)]'
                        }`}>
                            {results.length > 0 ? (
                                results.map(profile => (
                                    <button
                                        key={profile.id}
                                        onClick={() => handleSelect(profile)}
                                        className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-right border-b border-gray-50 dark:border-slate-700 last:border-0"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-600 flex items-center justify-center flex-shrink-0">
                                            {profile.avatar_url ? (
                                                <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover rounded-full" />
                                            ) : (
                                                <User size={14} className="text-gray-500 dark:text-gray-300" />
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">{profile.full_name}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">{profile.job_number}</p>
                                        </div>
                                    </button>
                                ))
                            ) : (
                                query.trim() && (
                                    <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-xs font-tajawal">
                                        لا يوجد موظف بهذا الاسم في {governorateName(governorate)}
                                    </div>
                                )
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
