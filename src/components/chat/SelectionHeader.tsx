import React from 'react';
import { X, Trash2, AlertCircle } from 'lucide-react';

interface SelectionHeaderProps {
    selectedCount: number;
    onCancel: () => void;
    onDelete: () => void;
    onShowDetails?: () => void;
}

export const SelectionHeader: React.FC<SelectionHeaderProps> = ({
    selectedCount,
    onCancel,
    onDelete,
    onShowDetails,
}) => {
    return (
        <div className="bg-emerald-600 text-white px-4 py-3 flex items-center justify-between shadow-sm z-10 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-3">
                <button
                    onClick={onCancel}
                    className="p-2 rounded-full hover:bg-emerald-700 transition-colors"
                >
                    <X size={20} />
                </button>
                <span className="font-bold text-lg">{selectedCount}</span>
            </div>

            <div className="flex gap-2">
                {onShowDetails && (
                    <button
                        onClick={onShowDetails}
                        disabled={selectedCount !== 1}
                        className={`p-2 rounded-full transition-colors ${
                            selectedCount === 1 
                                ? 'hover:bg-emerald-700 text-white' 
                                : 'opacity-40 cursor-not-allowed bg-transparent text-emerald-100'
                        }`}
                        title="تفاصيل الرسالة"
                    >
                        <AlertCircle size={20} />
                    </button>
                )}
                <button
                    onClick={onDelete}
                    className="p-2 rounded-full hover:bg-emerald-700 transition-colors"
                    title="حذف المحدد"
                >
                    <Trash2 size={20} />
                </button>
            </div>
        </div>
    );
};
