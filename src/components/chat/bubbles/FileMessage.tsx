import React from 'react';
import { FileText, Download } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { Message } from '../../../hooks/useChatState';

interface FileMessageProps {
    message: Message;
    isMe: boolean;
}

export const FileMessage: React.FC<FileMessageProps> = ({ message, isMe }) => {
    // Format file size
    const formatFileSize = (bytes?: number) => {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const handleDownload = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (message.file_url && !message.is_sending) {
            window.open(message.file_url, '_blank');
        }
    };

    return (
        <div 
            onClick={handleDownload}
            className={cn(
                "flex items-center gap-3 p-3 rounded-xl min-w-[200px] border shadow-sm transition-all cursor-pointer hover:opacity-90",
                isMe 
                    ? "bg-white/10 border-white/20 text-white" 
                    : "bg-white border-gray-100 text-gray-900",
                message.is_sending && "opacity-60 cursor-not-allowed"
            )}
            title="تحميل الملف"
        >
            <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                isMe ? "bg-white/20" : "bg-rose-50 text-rose-500"
            )}>
                {message.is_sending ? (
                    <div className={cn(
                        "w-5 h-5 border-2 border-t-transparent rounded-full animate-spin",
                        isMe ? "border-white" : "border-rose-500"
                    )} />
                ) : (
                    <FileText className="w-5 h-5" />
                )}
            </div>

            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" dir="auto">
                    {message.file_name || 'ملف مرفق'}
                </p>
                <div className="flex items-center gap-2 mt-0.5 opacity-80">
                    <span className="text-xs">
                        {formatFileSize(message.file_size)}
                    </span>
                    {!message.is_sending && (
                        <Download className="w-3 h-3" />
                    )}
                </div>
            </div>
        </div>
    );
};
