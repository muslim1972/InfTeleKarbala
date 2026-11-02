import { useRef, useState, useEffect, useMemo, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, MapPin } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { WorkLocation } from '../types';

interface LocationSearchProps {
    locations: WorkLocation[];
    onSelect: (loc: WorkLocation) => void;
    placeholder?: string;
    className?: string;
    /** إعادة العنصر المختار إلى أعلى قائمة البطاقات */
    scrollTargetId?: string;
}

/**
 * حقل بحث حي عن موقع عمل.
 * - يستجيب لكل حرف يكتبه المستخدم (تصفية محلية فورية بلا استعلام شبكة).
 * - القائمة المنسدلة تظهر النتائج المطابقة وتختفي عند الاختيار.
 * - عند الاختيار: يُفرَّغ الحقل وتُستدعى onSelect ليُجلَب الموقع إلى الأعلى.
 */
export function LocationSearch({
    locations,
    onSelect,
    placeholder = 'ابحث عن موقع عمل...',
    className,
    scrollTargetId
}: LocationSearchProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [portalInfo, setPortalInfo] = useState<{ style: CSSProperties; openUp: boolean } | null>(null);

    // تصفية محلية: احتواء الكلمة في أي موضع من الاسم (قرار المستخدم)
    const matches = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        return locations.filter((l) => l.name.toLowerCase().includes(q)).slice(0, 12);
    }, [locations, query]);

    const showList = open && query.trim().length > 0;

    // حساب موضع القائمة المنسدلة (تتجاوز الحافة — نفس نمط EmployeeSearch)
    useEffect(() => {
        if (!showList || !containerRef.current) {
            setPortalInfo(null);
            return;
        }
        const rect = containerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const openUp = spaceBelow < 260 && spaceAbove > spaceBelow;
        const maxHeight = Math.max(140, Math.min(320, (openUp ? spaceAbove : spaceBelow) - 12));
        setPortalInfo({
            openUp,
            style: {
                left: `${rect.left}px`,
                width: `${rect.width}px`,
                maxHeight: `${maxHeight}px`,
                ...(openUp
                    ? { bottom: `${window.innerHeight - rect.top + 4}px` }
                    : { top: `${rect.bottom + 4}px` })
            }
        });
    }, [showList, matches.length, query]);

    // إغلاق القائمة عند النقر خارجها
    useEffect(() => {
        if (!showList) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (e.target instanceof Element && e.target.closest('.location-search-portal')) return;
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showList]);

    const handleSelect = (loc: WorkLocation) => {
        setQuery('');
        setOpen(false);
        onSelect(loc);
        // جلب البطاقة إلى أعلى قائمة البطاقات
        requestAnimationFrame(() => {
            const target = scrollTargetId
                ? document.getElementById(scrollTargetId)
                : document.getElementById(`loc-card-${loc.id}`);
            target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    };

    return (
        <div className={cn('relative w-full', className)} ref={containerRef}>
            <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    placeholder={placeholder}
                    aria-label="بحث عن موقع عمل"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pr-9 pl-8 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-400 transition-all"
                />
                {query && (
                    <button
                        type="button"
                        onClick={() => {
                            setQuery('');
                            setOpen(false);
                        }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        aria-label="مسح البحث"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            {showList && portalInfo && createPortal(
                <div
                    className={cn(
                        "location-search-portal fixed bg-white dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden z-[9999] overflow-y-auto",
                        portalInfo.openUp ? 'slide-in-from-bottom-2' : 'slide-in-from-top-2'
                    )}
                    style={portalInfo.style}
                >
                    {matches.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                            لا يوجد موقع مطابق لـ «{query.trim()}»
                        </div>
                    ) : (
                        matches.map((loc) => (
                            <button
                                key={loc.id}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => handleSelect(loc)}
                                className="w-full text-right px-3.5 py-2.5 border-b last:border-0 border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors flex items-center gap-3"
                            >
                                <MapPin className="w-4 h-4 text-blue-500 shrink-0" />
                                <span className="flex-1 min-w-0">
                                    <span className="block text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{loc.name}</span>
                                    <span className="block text-[11px] text-slate-400 font-mono truncate" dir="ltr">
                                        {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)} · r {loc.radius_meters}m
                                    </span>
                                </span>
                                {!loc.is_active && (
                                    <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
                                        معطل
                                    </span>
                                )}
                            </button>
                        ))
                    )}
                </div>,
                document.body
            )}
        </div>
    );
}
