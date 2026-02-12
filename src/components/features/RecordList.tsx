import { Pencil, Trash2 } from "lucide-react";
// cn removed

interface RecordListProps {
    data: any[];
    fields: { key: string; label?: string }[];
    type?: string;
    onEdit?: (item: any) => void;
    onDelete?: (type: string, id: any) => void;
    readOnly?: boolean;
    hideEmpty?: boolean;
}

export function RecordList({ data, fields, type, onEdit, onDelete, readOnly = false, hideEmpty = false }: RecordListProps) {
    return (
        <div className="space-y-2">
            {data.map((item: any, idx: number) => (
                <div key={item.id || idx} className="flex items-center justify-between p-3 bg-white/50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/5 group hover:bg-white/80 dark:hover:bg-white/10 transition-colors shadow-sm">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-gray-900 dark:text-white text-sm">{item[fields[0].key]}</span>
                            {/* Generic Badges based on specific field checks - mimicking Admin functionality */}
                            {item.book_date && <span className="text-xs text-gray-500 dark:text-white/40 bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded">{item.book_date}</span>}
                            {item.start_date && <span className="text-xs text-gray-500 dark:text-white/40 bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded">{item.start_date}</span>}
                            {item.penalty_date && <span className="text-xs text-gray-500 dark:text-white/40 bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded">{item.penalty_date}</span>}
                        </div>
                        {fields[1] && <p className="text-gray-500 dark:text-white/60 text-xs">{item[fields[1].key]}</p>}
                        {item.duration && <p className="text-brand-green text-xs font-bold">المدة: {item.duration} يوم</p>}

                        {/* Penalty Specifics */}
                        {item.reason && fields[0].key === 'penalty_type' && <p className="text-gray-500 dark:text-white/60 text-xs">{item.reason}</p>}
                    </div>

                    {!readOnly && onEdit && onDelete && type && (
                        <div className="flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={() => onEdit(item)}
                                className="p-2 text-gray-400 dark:text-white/20 hover:text-brand-green hover:bg-brand-green/10 rounded-lg transition-colors"
                                title="تعديل"
                            >
                                <Pencil className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => onDelete(type, item.id)}
                                className="p-2 text-gray-400 dark:text-white/20 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                title="حذف"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            ))}
            {data.length === 0 && !hideEmpty && (
                <p className="text-center text-gray-400 dark:text-white/20 text-sm py-4">لا توجد سجلات</p>
            )}
        </div>
    );
}
