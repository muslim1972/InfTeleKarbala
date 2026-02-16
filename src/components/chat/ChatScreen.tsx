import { useParams, useNavigate } from 'react-router-dom';
import { useChatState } from '../../hooks/useChatState';
import { useConversationDetails } from '../../hooks/useConversationDetails';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ArrowRight, MoreVertical } from 'lucide-react';
// useAuth removed as it was unused

// Simple Avatar Component if not exists
function SimpleAvatar({ src, fallback }: { src?: string, fallback: string }) {
    if (src) {
        return <img src={src} alt="Avatar" className="w-10 h-10 rounded-full object-cover" />;
    }
    return (
        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-semibold">
            {fallback.substring(0, 2).toUpperCase()}
        </div>
    );
}

export function ChatScreen() {
    const { conversationId } = useParams<{ conversationId: string }>();
    const navigate = useNavigate();

    // If no conversationId, we might want to show a list or redirect.
    // For now, let's assume valid ID is passed.

    const { messages, loading: msgsLoading, newMessage, setNewMessage, isSending, sendMessage } = useChatState(conversationId || '');
    const { details, loading: detailsLoading } = useConversationDetails(conversationId || '');

    if (!conversationId) {
        return <div className="p-4">اختر محادثة للبدء</div>;
    }

    return (
        <div className="flex flex-col h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white px-4 py-3 border-b flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full">
                        <ArrowRight className="w-5 h-5 text-gray-600" />
                    </button>

                    <div className="flex items-center gap-3">
                        <SimpleAvatar src={details?.avatar_url} fallback={details?.name || 'User'} />
                        <div>
                            <h2 className="font-semibold text-gray-800 text-sm">
                                {detailsLoading ? 'جاري التحميل...' : details?.name}
                            </h2>
                            {details?.is_group && <span className="text-xs text-gray-500">مجموعة</span>}
                        </div>
                    </div>
                </div>

                <div className="relative group">
                    <button
                        onClick={() => alert("خيارات المحادثة ستتوفر قريباً: \n- معلومات الاتصال\n- حذف المحادثة\n- حظر المستخدم")}
                        className="p-2 hover:bg-gray-100 rounded-full"
                    >
                        <MoreVertical className="w-5 h-5 text-gray-600" />
                    </button>
                    {/* Tooltip */}
                    <div className="absolute left-0 top-full mt-1 hidden group-hover:block px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap">
                        خيارات
                    </div>
                </div>
            </div>

            {/* Messages */}
            <MessageList messages={messages} loading={msgsLoading} />

            {/* Input */}
            <MessageInput
                value={newMessage}
                onChange={setNewMessage}
                onSend={sendMessage}
                disabled={isSending}
            />
        </div>
    );
}
