import { useRef } from 'react';
import { Upload } from 'lucide-react';
import type { UseDataPatcherReturn } from '../../../hooks/useDataPatcher';

interface UploadStepProps {
    patcher: UseDataPatcherReturn;
}

export function UploadStep({ patcher }: UploadStepProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="h-full flex flex-col items-center justify-center p-6 animate-in slide-in-from-bottom-5 duration-300">
            <div
                className="w-full max-w-sm border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-8 flex flex-col items-center text-center cursor-pointer hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all group"
                onClick={() => fileInputRef.current?.click()}
            >
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Upload className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">
                    اضغط لرفع ملف Excel
                </h3>
                <p className="text-zinc-500 dark:text-zinc-400 text-xs max-w-xs">
                    يجب أن يحتوي الملف على عمود لاسم الموظف وعمود للقيمة المراد تحديثها (.xlsx, .xls)
                </p>
            </div>
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".xlsx,.xls"
                onChange={patcher.handleFileSelect}
            />
        </div>
    );
}
