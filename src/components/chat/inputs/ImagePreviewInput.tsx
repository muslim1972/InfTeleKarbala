import React from 'react';
import { Send, X } from 'lucide-react';

interface ImagePreviewInputProps {
    selectedImage: File;
    imagePreview: string;
    disabled?: boolean;
    onCancel: () => void;
    onSendImage: () => void;
}

export const ImagePreviewInput: React.FC<ImagePreviewInputProps> = ({
    selectedImage,
    imagePreview,
    disabled = false,
    onCancel,
    onSendImage,
}) => {
    return (
        <div className="p-3 bg-white border-t">
            {/* Preview */}
            <div className="relative mb-2 rounded-2xl overflow-hidden bg-gray-100 border border-gray-200 inline-block max-w-[200px]">
                <img
                    src={imagePreview}
                    alt="معاينة الصورة"
                    className="max-h-[200px] max-w-[200px] object-contain rounded-2xl"
                />
                <button
                    onClick={onCancel}
                    className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-all active:scale-90"
                >
                    <X className="w-4 h-4" />
                </button>
                {/* File size badge */}
                <div className="absolute bottom-1.5 left-1.5 bg-black/50 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {(selectedImage.size / 1024 / 1024).toFixed(1)} MB
                </div>
            </div>
            
            <div className="flex items-center gap-2">
                <div className="flex-1 text-sm text-gray-500 text-right font-medium px-2">
                    إرسال صورة
                </div>
                <button
                    onClick={onSendImage}
                    disabled={disabled}
                    className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 transition-all active:scale-90 shadow-lg shadow-emerald-200"
                >
                    <Send className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};
