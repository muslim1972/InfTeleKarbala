/**
 * SnapshotNamePicker.tsx — مُحدد الشهر والسنة لتسمية النسخة الشهرية
 * يبني الاسم تلقائياً بصيغة «شهر آب الثامن 2026» ويتيح التحرير اليدوي أيضاً.
 */
import { useMemo } from 'react';
import { CalendarDays } from 'lucide-react';
import {
    IRAQI_MONTHS,
    snapshotNameFromMonth,
    parseSnapshotName
} from '../../utils/snapshots';

interface SnapshotNamePickerProps {
    value: string;
    onChange: (name: string) => void;
    disabled?: boolean;
    /** لون الإطار المميز حسب الشاشة المضيفة */
    accent?: 'green' | 'teal';
}

export function SnapshotNamePicker({ value, onChange, disabled, accent = 'green' }: SnapshotNamePickerProps) {
    const now = new Date();
    const parsed = parseSnapshotName(value);
    const month = parsed?.month ?? now.getMonth();
    const year = parsed?.year ?? now.getFullYear();

    const years = useMemo(() => {
        const y = now.getFullYear();
        const list: number[] = [];
        for (let i = y + 1; i >= y - 6; i--) list.push(i);
        return list;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const selectCls = accent === 'teal'
        ? 'bg-white dark:bg-slate-900 border border-teal-300 dark:border-teal-700 text-slate-800 dark:text-slate-100'
        : 'bg-white dark:bg-slate-900 border border-green-300 dark:border-green-700 text-slate-800 dark:text-slate-100';

    return (
        <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                    <CalendarDays className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <select
                        value={month}
                        disabled={disabled}
                        onChange={e => onChange(snapshotNameFromMonth(parseInt(e.target.value, 10), year))}
                        className={`w-full appearance-none pr-9 pl-3 py-2 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-green-500/50 disabled:opacity-60 ${selectCls}`}
                    >
                        {IRAQI_MONTHS.map((mName, idx) => (
                            <option key={idx} value={idx}>شهر {mName}</option>
                        ))}
                    </select>
                </div>
                <select
                    value={year}
                    disabled={disabled}
                    onChange={e => onChange(snapshotNameFromMonth(month, parseInt(e.target.value, 10)))}
                    className={`w-full py-2 px-3 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-green-500/50 disabled:opacity-60 ${selectCls}`}
                >
                    {years.map(y => (
                        <option key={y} value={y}>{y}</option>
                    ))}
                </select>
            </div>
            <input
                type="text"
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder="مثال: شهر آب الثامن 2026"
                disabled={disabled}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/50 font-tajawal"
            />
        </div>
    );
}
