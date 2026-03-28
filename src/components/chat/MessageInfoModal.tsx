import { X, CheckCircle2, Check } from 'lucide-react';
import type { Message } from '../../hooks/useChatState';
import type { ParticipantProfile } from '../../hooks/useConversationDetails';

// Simple Avatar Inline
function SimpleAvatar({ src, fallback, size = 10 }: { src?: string, fallback: string, size?: number }) {
    if (src) {
        return <img src={src} alt="Avatar" className={`w-${size} h-${size} rounded-full object-cover`} />;
    }
    return (
        <div className={`w-${size} h-${size} rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs`}>
            {fallback.substring(0, 2).toUpperCase()}
        </div>
    );
}

interface MessageInfoModalProps {
    isOpen: boolean;
    onClose: () => void;
    message: Message | null;
    currentUserId: string | undefined;
    members: ParticipantProfile[] | undefined;
}

export function MessageInfoModal({ isOpen, onClose, message, currentUserId, members }: MessageInfoModalProps) {
    if (!isOpen || !message || !members) return null;

    // We only care about members other than the active user to calculate read/delivered
    const otherMembers = members.filter(m => m.id !== currentUserId);

    // List of user IDs who have read the message
    const readByIds = message.read_by || [];

    // Profiles of users who read it
    const readByProfiles = otherMembers.filter(m => readByIds.includes(m.id));

    // Profiles of users who received it but haven't read it yet
    const deliveredProfiles = otherMembers.filter(m => !readByIds.includes(m.id));

    return (
        <>
            <div 
                className="fixed inset-0 z-[100] bg-black/20 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />
            
            <div className="fixed inset-x-0 bottom-0 z-[110] bg-white rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom-full duration-300 md:max-w-md md:mx-auto md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:rounded-3xl md:slide-in-from-bottom-10 md:fade-in">
                {/* Header */}
                <div className="sticky top-0 bg-white/80 backdrop-blur-md z-10 p-4 border-b flex items-center justify-between rounded-t-3xl">
                    <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                        تفاصيل الرسالة
                    </h3>
                    <button 
                        onClick={onClose}
                        className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 max-h-[60vh] overflow-y-auto scrollbar-hide space-y-6">
                    
                    {/* Read By Section */}
                    <div>
                        <h4 className="flex items-center gap-2 text-emerald-600 font-bold text-sm mb-3">
                            <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                            <span>قرأ بواسطة</span>
                            <span className="bg-emerald-100 text-emerald-700 px-2 rounded-full text-xs mr-auto">
                                {readByProfiles.length}
                            </span>
                        </h4>
                        
                        {readByProfiles.length > 0 ? (
                            <div className="space-y-3 bg-emerald-50/50 p-3 rounded-2xl border border-emerald-50">
                                {readByProfiles.map(profile => (
                                    <div key={profile.id} className="flex items-center gap-3">
                                        <SimpleAvatar src={profile.avatar} fallback={profile.full_name} size={10} />
                                        <span className="font-bold text-gray-700 text-sm">{profile.full_name}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-sm text-gray-400 p-3 text-center border border-dashed rounded-2xl bg-gray-50/50">
                                لم تُقرأ بعد
                            </div>
                        )}
                    </div>

                    <div className="h-px bg-gray-100 my-4" />

                    {/* Delivered (Not Read) Section */}
                    <div>
                        <h4 className="flex items-center gap-2 text-gray-500 font-bold text-sm mb-3">
                            <Check size={18} className="shrink-0" />
                            <span>تم الاستلام (لم تُقرأ)</span>
                            <span className="bg-gray-100 text-gray-600 px-2 rounded-full text-xs mr-auto">
                                {deliveredProfiles.length}
                            </span>
                        </h4>

                        {deliveredProfiles.length > 0 ? (
                            <div className="space-y-3 bg-gray-50/50 p-3 rounded-2xl border border-gray-100">
                                {deliveredProfiles.map(profile => (
                                    <div key={profile.id} className="flex items-center gap-3 opacity-70">
                                        <SimpleAvatar src={profile.avatar} fallback={profile.full_name} size={10} />
                                        <span className="font-medium text-gray-600 text-sm">{profile.full_name}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-sm text-gray-400 p-3 text-center border border-dashed rounded-2xl bg-gray-50/50">
                                لا يوجد
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </>
    );
}
