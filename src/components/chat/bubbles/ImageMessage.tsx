import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { Message } from '../../../hooks/useChatState';

interface ImageMessageProps {
    message: Message;
    onImageLoad?: () => void;
}

export const ImageMessage: React.FC<ImageMessageProps> = ({ message, onImageLoad }) => {
    const [showLightbox, setShowLightbox] = useState(false);

    if (!message.image_url) return null;

    return (
        <>
            <div 
                className={cn(
                    "relative rounded-xl overflow-hidden bg-gray-100 border border-gray-100/10 shadow-sm",
                    !message.is_sending && "min-h-[200px] min-w-[200px]"
                )}
                onClick={(e) => {
                    if (!message.is_sending) {
                        e.stopPropagation();
                        setShowLightbox(true);
                    }
                }}
            >
                <img
                    src={message.image_url}
                    alt="صورة مرفقة"
                    loading="lazy"
                    onLoad={onImageLoad}
                    className={cn(
                        "max-w-full md:max-w-[300px] max-h-[350px] object-cover cursor-pointer transition-all hover:opacity-90",
                        message.is_sending && "opacity-50"
                    )}
                />
                {message.is_sending && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                )}
            </div>

            {/* Fullscreen Image Lightbox - Using Portal */}
            {showLightbox && createPortal(
                <div
                    className="fixed inset-0 z-[99999] bg-black flex items-center justify-center animate-in fade-in duration-300"
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowLightbox(false);
                    }}
                >
                    {/* Close Button */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowLightbox(false);
                        }}
                        className="absolute top-8 right-8 w-14 h-14 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition-all z-[100000] backdrop-blur-md border border-white/40 shadow-2xl active:scale-90"
                        title="إغلاق"
                    >
                        <X className="w-10 h-10" />
                    </button>

                    <img
                        src={message.image_url}
                        alt="عرض الصورة"
                        className="max-w-full max-h-full object-contain shadow-[0_0_100px_rgba(0,0,0,0.5)] select-none pointer-events-auto"
                        onClick={(e) => e.stopPropagation()}
                    />
                    
                    {/* Bottom hint to close */}
                    <div className="absolute bottom-10 left-0 right-0 text-center pointer-events-none">
                        <span className="bg-white/10 text-white/90 px-6 py-2.5 rounded-full text-sm font-medium backdrop-blur-md border border-white/20 shadow-lg">
                            اضغط في أي مكان للخروج من العارض
                        </span>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};
