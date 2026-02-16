import React from 'react';
import { X, Trash2 } from 'lucide-react';

interface SelectionHeaderProps {
    selectedCount: number;
    onCancel: () => void;
    onDelete: () => void;
}

export const SelectionHeader: React.FC<SelectionHeaderProps> = ({
    selectedCount,
    onCancel,
    onDelete,
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
