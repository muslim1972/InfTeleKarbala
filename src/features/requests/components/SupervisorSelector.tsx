import { useState, useEffect, useRef } from 'react';
import { Search, User, X } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

interface Profile {
    id: string;
    full_name: string;
    job_number: string;
    avatar_url?: string | null;
}

interface SupervisorSelectorProps {
    onSelect: (supervisorId: string | null) => void;
    selectedSupervisorId: string | null;
}

export const SupervisorSelector = ({ onSelect, selectedSupervisorId }: SupervisorSelectorProps) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    // Load selected profile if ID provided (e.g. from saved state or initial)
    useEffect(() => {
        const fetchSelectedProfile = async () => {
            if (selectedSupervisorId && !selectedProfile) {
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
            }
        };
        fetchSelectedProfile();
    }, [selectedSupervisorId]);

    // Search logic
    useEffect(() => {
        const searchUsers = async () => {
            const trimmedQuery = query.trim();
            if (!trimmedQuery) {
                setResults([]);
                return;
            }
            setLoading(true);
            try {
                // Search by job number OR full name (starts with) - matching CustomAudit behavior
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, full_name, job_number, avatar_url')
                    .or(`job_number.ilike.${trimmedQuery}%,full_name.ilike.${trimmedQuery}%`)
                    .limit(10); // Increased limit slightly

                if (!error && data) {
                    // Map to Profile interface ensuring fields exist
                    const profiles: Profile[] = data.map(d => ({
                        id: d.id,
                        full_name: d.full_name || 'مستخدم',
                        job_number: d.job_number,
                        avatar_url: d.avatar_url
                    }));
                    setResults(profiles);
                }
            } catch (error) {
                console.error('Error searching users:', error);
            } finally {
                setLoading(false);
            }
        };

        const timeoutId = setTimeout(() => {
            if (isOpen) searchUsers();
        }, 300); // Debounce

        return () => clearTimeout(timeoutId);
    }, [query, isOpen]);

    const handleSelect = (profile: Profile) => {
        setSelectedProfile(profile);
        onSelect(profile.id);
        setIsOpen(false);
        setQuery('');
    };

    const clearSelection = () => {
        setSelectedProfile(null);
        onSelect(null);
        setQuery('');
    };

    return (
        <div className="relative" ref={wrapperRef}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                المسؤول المباشر
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
                            <p className="font-bold text-gray-900 dark:text-gray-100">{selectedProfile.full_name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{selectedProfile.job_number}</p>
                        </div>
                    </div>
                    <button
                        onClick={clearSelection}
                        className="p-2 text-gray-500 hover:text-red-500 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>
            ) : (
                <div className="relative">
                    <input
                        type="text"
                        className="w-full px-4 py-3 pl-10 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                        placeholder="ابحث عن اسم المسؤول..."
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setIsOpen(true);
                        }}
                        onFocus={() => setIsOpen(true)}
                    />
                    <Search className="absolute left-3 top-3.5 text-gray-400 pointer-events-none" size={18} />

                    {isOpen && (query || results.length > 0) && (
                        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 max-h-60 overflow-y-auto">
                            {loading ? (
                                <div className="p-4 text-center text-gray-500 text-sm">جاري البحث...</div>
                            ) : results.length > 0 ? (
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
                                query && <div className="p-4 text-center text-gray-500 text-sm">لا توجد نتائج</div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
