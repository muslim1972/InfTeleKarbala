import { useState, useRef, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DateInputProps {
    value: string;         // yyyy-mm-dd format (DB)
    onChange: (value: string) => void;
    className?: string;
    placeholder?: string;
}

/**
 * حقل تاريخ مخصص يعرض dd/mm/yyyy
 * يخزّن القيمة داخلياً كـ yyyy-mm-dd للتوافق مع قاعدة البيانات
 * نقرة أيقونة التقويم تفتح خيار التاريخ الأصلي
 */
export function DateInput({ value, onChange, className, placeholder = 'dd/mm/yyyy' }: DateInputProps) {
    const hiddenDateRef = useRef<HTMLInputElement>(null);

    // تحويل yyyy-mm-dd → dd/mm/yyyy للعرض
    const toDisplay = (isoVal: string): string => {
        if (!isoVal) return '';
        const match = isoVal.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (match) return `${match[3]}/${match[2]}/${match[1]}`;
        return isoVal;
    };

    // تحويل dd/mm/yyyy → yyyy-mm-dd للتخزين
    const toISO = (displayVal: string): string => {
        const match = displayVal.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (match) return `${match[3]}-${match[2]}-${match[1]}`;
        return displayVal;
    };

    const [displayValue, setDisplayValue] = useState(toDisplay(value));

    useEffect(() => {
        setDisplayValue(toDisplay(value));
    }, [value]);

    // تنسيق تلقائي أثناء الكتابة
    const handleTextChange = (raw: string) => {
        // السماح بالأرقام و / فقط
        let cleaned = raw.replace(/[^\d/]/g, '');

        // إضافة / تلقائياً
        const digits = cleaned.replace(/\//g, '');
        if (digits.length >= 5) {
            cleaned = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
        } else if (digits.length >= 3) {
            cleaned = `${digits.slice(0, 2)}/${digits.slice(2)}`;
        }

        setDisplayValue(cleaned);

        // إذا اكتمل التنسيق dd/mm/yyyy → أرسل للأب
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(cleaned)) {
            const iso = toISO(cleaned);
            // تحقق من صحة التاريخ
            const d = new Date(iso);
            if (!isNaN(d.getTime())) {
                onChange(iso);
            }
        }
    };

    // عند اختيار من التقويم الأصلي
    const handleNativePick = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value; // yyyy-mm-dd
        if (val) {
            setDisplayValue(toDisplay(val));
            onChange(val);
        }
    };

    return (
        <div className="relative flex items-center">
            <input
                type="text"
                inputMode="numeric"
                value={displayValue}
                onChange={e => handleTextChange(e.target.value)}
                placeholder={placeholder}
                maxLength={10}
                dir="ltr"
                className={cn(
                    "w-full bg-background border border-input rounded-lg px-3 py-2 text-sm text-foreground font-mono tracking-wider text-center focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green/50 transition-colors",
                    className
                )}
            />
            {/* أيقونة التقويم - تفتح التقويم الأصلي */}
            <button
                type="button"
                onClick={() => {
                    const el = hiddenDateRef.current;
                    if (el) {
                        el.style.pointerEvents = 'auto';
                        el.showPicker?.();
                        el.focus();
                        el.click();
                    }
                }}
                className="absolute left-2 text-muted-foreground hover:text-foreground transition-colors z-10"
                tabIndex={-1}
            >
                <Calendar className="w-4 h-4" />
            </button>
            {/* تقويم مخفي - يصبح تفاعلي فقط عند النقر على الأيقونة */}
            <input
                ref={hiddenDateRef}
                type="date"
                value={value || ''}
                onChange={(e) => { handleNativePick(e); e.currentTarget.style.pointerEvents = 'none'; }}
                onBlur={(e) => { e.currentTarget.style.pointerEvents = 'none'; }}
                className="absolute left-0 top-0 w-8 h-full opacity-0"
                style={{ pointerEvents: 'none' }}
                tabIndex={-1}
            />
        </div>
    );
}
