import React from 'react';
import { Send, X, FileText } from 'lucide-react';

interface FilePreviewInputProps {
    selectedFile: File;
    disabled?: boolean;
    onCancel: () => void;
    onSendFile: () => void;
}

export const FilePreviewInput: React.FC<FilePreviewInputProps> = ({
    selectedFile,
    disabled = false,
    onCancel,
    onSendFile,
}) => {
    // Format file size
    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="p-3 bg-white border-t">
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex flex-col gap-4">
                
                {/* File Preview Card */}
                <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                    <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-lg flex items-center justify-center shrink-0">
                        <FileText className="w-6 h-6" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate" dir="auto">
                            {selectedFile.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                            {formatFileSize(selectedFile.size)}
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={onCancel}
                        disabled={disabled}
                        className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                    >
                        <X className="w-4 h-4" />
                        <span>إلغاء</span>
                    </button>
                    
                    <button
                        onClick={onSendFile}
                        disabled={disabled}
                        className="flex-1 px-4 py-2.5 bg-rose-600 text-white rounded-xl font-medium hover:bg-rose-700 transition-colors shadow-sm shadow-rose-600/20 flex items-center justify-center gap-2"
                    >
                        <span>إرسال الملف</span>
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};
