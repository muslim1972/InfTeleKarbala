import { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTheme } from '../../context/ThemeContext';
import { useEmployeeSearch } from '../../hooks/useEmployeeSearch';

interface EmployeeSearchProps {
    onSelect: (employee: any) => void;
    placeholder?: string;
    className?: string;
    inputClassName?: string;
    includeFinancialRecords?: boolean;
    includeRole?: boolean;
    limit?: number;
    searchUsername?: boolean;
    disabled?: boolean;
    value?: string; // For controlled input (displaying selected name)
    onChange?: (val: string) => void; // When user types
}

export function EmployeeSearch({
    onSelect,
    placeholder = "البحث عن موظف (الاسم، الرقم الوظيفي)...",
    className,
    inputClassName,
    includeFinancialRecords = false,
    includeRole = false,
    searchUsername = false,
    limit = 10,
    disabled = false,
    value,
    onChange
}: EmployeeSearchProps) {
    const { theme } = useTheme();
    const searchRef = useRef<HTMLDivElement>(null);
    const showRef = useRef(false);

    const {
        query: internalQuery,
        setQuery: setInternalQuery,
        results: suggestions,
        isSearching
    } = useEmployeeSearch({
        includeFinancialRecords,
        includeRole,
        searchUsername,
        limit,
        enabled: !disabled
    });

    // Controlled vs uncontrolled query
    const query = value !== undefined ? value : internalQuery;
    const handleQueryChange = (val: string) => {
        if (onChange) onChange(val);
        else setInternalQuery(val);
        showRef.current = true;
    };

    // Sync controlled value into the hook for search
    useEffect(() => {
        if (value !== undefined) {
            setInternalQuery(value);
        }
    }, [value, setInternalQuery]);

    const showSuggestions = showRef.current && suggestions.length > 0 && query.trim().length > 0;

    // Close suggestions on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                showRef.current = false;
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (user: any) => {
        if (onChange) onChange(user.full_name);
        else setInternalQuery(user.full_name);

        showRef.current = false;
        onSelect(user);
    };

    const labelClr = theme === 'light' ? 'text-gray-600' : 'text-white/60';
    const textClr = theme === 'light' ? 'text-gray-900' : 'text-white';
    const inputBg = theme === 'light' ? 'bg-gray-50 border-gray-200 text-gray-900' : 'bg-black/40 border-white/10 text-white';

    return (
        <div className={cn("relative w-full", className)} ref={searchRef}>
            <div className="relative">
                <input
                    type="text"
                    placeholder={placeholder}
                    value={query}
                    onChange={e => handleQueryChange(e.target.value)}
                    onFocus={() => {
                        if (query.trim() && suggestions.length > 0) showRef.current = true;
                    }}
                    disabled={disabled}
                    className={cn(
                        "w-full rounded-lg px-3 py-2.5 text-sm border focus:outline-none focus:border-brand-green/50 pr-9 transition-colors",
                        inputBg,
                        disabled && "opacity-50 cursor-not-allowed",
                        inputClassName
                    )}
                />
                <Search className={cn("absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4", labelClr)} />
                {isSearching && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="w-4 h-4 animate-spin text-brand-green/50" />
                    </div>
                )}
            </div>

            {/* Suggestions Portal to avoid clipping issues */}
            {showSuggestions && searchRef.current && createPortal(
                <div
                    className={cn(
                        "fixed backdrop-blur-xl border rounded-lg shadow-2xl overflow-hidden z-[9999] max-h-[220px] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200",
                        theme === 'light' ? 'bg-white border-gray-200' : 'bg-slate-900/95 border-white/10'
                    )}
                    style={{
                        top: `${searchRef.current.getBoundingClientRect().bottom + 4}px`,
                        left: `${searchRef.current.getBoundingClientRect().left}px`,
                        width: `${searchRef.current.getBoundingClientRect().width}px`
                    }}
                >
                    {suggestions.map((user, idx) => (
                        <button
                            key={user.id || idx}
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => handleSelect(user)}
                            className={cn(
                                "w-full text-right px-4 py-3 border-b last:border-0 flex flex-col transition-colors",
                                theme === 'light' ? 'hover:bg-gray-50 border-gray-100' : 'hover:bg-white/10 border-white/5'
                            )}
                        >
                            <div className="flex items-center justify-between w-full mb-1">
                                <span className={cn("text-sm font-bold", textClr)}>{user.full_name}</span>
                                <span className={cn("text-xs font-mono", labelClr)}>{user.job_number || 'بدون رقم'}</span>
                            </div>
                            {user.username && (
                                <span className={cn("text-[10px]", labelClr)}>@{user.username}</span>
                            )}
                        </button>
                    ))}
                </div>,
                document.body
            )}
        </div>
    );
}
