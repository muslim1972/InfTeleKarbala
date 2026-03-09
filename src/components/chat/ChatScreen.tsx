import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useChatState } from '../../hooks/useChatState';
import { useConversationDetails } from '../../hooks/useConversationDetails';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ArrowRight, MoreVertical, Trash2 } from 'lucide-react';
import { SelectionHeader } from './SelectionHeader';
import { supabase } from '../../lib/supabase';

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
    const [showMenu, setShowMenu] = useState(false);

    const handleDeleteConversation = async () => {
        if (!conversationId) return;
        if (!window.confirm("هل أنت متأكد من حذف هذه المحادثة بشكل نهائي؟ لا يمكن التراجع عن هذا الإجراء.")) return;

        try {
            const { error } = await supabase.rpc('delete_chat_conversation', { p_conversation_id: conversationId });
            if (error) throw error;

            // Dispatch event to force refresh the chat list
            window.dispatchEvent(new CustomEvent('chat_deleted'));

            navigate('/chat');
        } catch (error) {
            console.error('Error deleting conversation:', error);
            alert("حدث خطأ أثناء محاولة الحذف");
        }
    };

    const {
        messages,
        loading: msgsLoading,
        newMessage,
        setNewMessage,
        sendMessage,
        selectedMessages,      // New
        toggleSelection,       // New
        clearSelection,        // New
        deleteMessages         // New
    } = useChatState(conversationId || '');

    const { details, loading: detailsLoading } = useConversationDetails(conversationId || '');

    if (!conversationId) {
        return <div className="p-4">اختر محادثة للبدء</div>;
    }

    return (
        <div className="flex flex-col h-screen bg-gray-50 relative">
            {/* Header - Conditionally Rendered */}
            {selectedMessages.length > 0 ? (
                <SelectionHeader
                    selectedCount={selectedMessages.length}
                    onCancel={clearSelection}
                    onDelete={deleteMessages}
                />
            ) : (
                <div className="bg-white px-4 py-3 border-b flex items-center justify-between shadow-sm z-10 transition-all">
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

                    <div className="relative">
                        <button
                            onClick={() => setShowMenu(!showMenu)}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <MoreVertical className="w-5 h-5 text-gray-600" />
                        </button>

                        {showMenu && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)}></div>
                                <div className="absolute left-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden transform origin-top-left transition-all">
                                    <button
                                        onClick={handleDeleteConversation}
                                        className="w-full text-right px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        حذف المحادثة
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Messages */}
            <MessageList
                messages={messages}
                loading={msgsLoading}
                selectedMessages={selectedMessages}
                onToggleSelection={toggleSelection}
            />

            {/* Input */}
            <MessageInput
                key={conversationId} // Forces remount and triggers autoFocus on conversation change
                value={newMessage}
                onChange={setNewMessage}
                onSend={sendMessage}
                disabled={selectedMessages.length > 0} // Only disable if selecting messages
            />
        </div>
    );
}
