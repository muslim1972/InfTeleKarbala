import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Network, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Label } from '../ui/Label';

interface Department {
    id: string;
    name: string;
    level: number;
    parent_id: string | null;
}

interface DepartmentSelectorProps {
    value: string | null;
    onChange: (val: string | null) => void;
    theme?: string;
    disabled?: boolean;
    label?: string;
    className?: string;
}

export const DepartmentSelector: React.FC<DepartmentSelectorProps> = ({
    value,
    onChange,
    theme = 'light',
    disabled = false,
    label = "المرجع / التشكيل الإداري",
    className
}) => {
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDepartments = async () => {
            try {
                const { data, error } = await supabase
                    .from('departments')
                    .select('*')
                    .order('level', { ascending: true })
                    .order('name', { ascending: true });

                if (error) throw error;
                setDepartments(data || []);
            } catch (error) {
                console.error("Error fetching departments:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDepartments();
    }, []);

    return (
        <div className={cn("grid gap-2", className)}>
            <Label className="flex items-center gap-2">
                <Network className="w-4 h-4 text-brand-green" />
                {label}
            </Label>
            <div className="relative">
                <select
                    value={value || ""}
                    onChange={(e) => onChange(e.target.value || null)}
                    disabled={disabled || loading}
                    className={cn(
                        "w-full h-10 px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 transition-colors appearance-none",
                        theme === 'light'
                            ? "bg-white border-gray-300 text-gray-900 focus:border-brand-green hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
                            : "bg-slate-800 border-white/10 text-white focus:border-brand-green hover:bg-white/5 disabled:bg-slate-800 disabled:text-gray-500"
                    )}
                    dir="rtl"
                >
                    <option value="">-- غير محدد --</option>
                    {departments.map(dept => (
                        <option key={dept.id} value={dept.id}>
                            {dept.name} (مستوى {dept.level})
                        </option>
                    ))}
                </select>
                {loading && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="w-4 h-4 animate-spin text-brand-green" />
                    </div>
                )}
            </div>
        </div>
    );
};
