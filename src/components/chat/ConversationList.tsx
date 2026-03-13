import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useConversations } from '../../hooks/useConversations';
import { cn } from '../../lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Plus, ArrowRight } from 'lucide-react';
import { NewChatModal } from './NewChatModal';

export const ConversationList = () => {
    const { conversations, loading, createConversation, createGroupConversation } = useConversations();
    const { conversationId } = useParams();
    const navigate = useNavigate();

    // Modal State
    const [showNewChatModal, setShowNewChatModal] = useState(false);

    const handleCreateChat = () => {
        setShowNewChatModal(true);
    };

    const startConversation = async (partnerId: string) => {
        try {
            // The check for existing conversations is now handled centrally
            // inside the createConversation function in useConversations.ts
            const newConv = await createConversation(partnerId);
            if (!newConv) return;

            setShowNewChatModal(false);
            navigate(`/chat/${newConv.id}`);
            window.location.reload();
        } catch (error) {
            console.error('Error in startConversation:', error);
        }
    };

    const startGroupConversation = async (name: string, userIds: string[]) => {
        try {
            const newConv = await createGroupConversation(name, userIds);
            if (!newConv) return;

            setShowNewChatModal(false);
            navigate(`/chat/${newConv.id}`);
            window.location.reload();
        } catch (error) {
            console.error('Error creating group chat:', error);
        }
    };

    // Unified View: Show all conversations EXCEPT Supervisors Group
    // User requested to remove Supervisors Group from this list
    const filteredConversations = conversations.filter((c: any) =>
        c.name !== 'مجموعة المشرفين' &&
        c.name !== 'Supervisors Group'
    );

    return (
        <div className="w-full md:w-80 border-l bg-white flex flex-col h-full relative">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50/50">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/')}
                        className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                        title="العودة للخلف"
                    >
                        <ArrowRight className="w-5 h-5 text-gray-600" />
                    </button>
                    <h2 className="font-bold text-lg text-gray-800">المحادثات</h2>
                </div>
                {/* New Chat Button - Available to everyone */}
                <button onClick={handleCreateChat} className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-full transition-colors" title="محادثة جديدة">
                    <Plus className="w-5 h-5" />
                </button>
            </div>

            <div
                className="flex-1 overflow-y-auto relative"
                style={{
                    backgroundImage: 'url(/icon-512.png)',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                    backgroundSize: '420px',
                }}
            >
                <div className="absolute inset-0 bg-white/90 pointer-events-none" />
                <div className="relative z-[1]">
                {loading ? (
                    <div className="p-4 text-center text-gray-400">جاري التحميل...</div>
                ) : filteredConversations.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-sm">
                        لا توجد محادثات.
                        <br />
                        ابدأ تواصل جديد!
                    </div>
                ) : (
                    filteredConversations.map((conv: any) => (
                        <div
                            key={conv.id}
                            onClick={() => navigate(`/chat/${conv.id}`)}
                            className={cn(
                                "p-3 border-b cursor-pointer hover:bg-emerald-50/50 transition-colors flex items-center gap-3",
                                conversationId === conv.id ? "bg-emerald-50 border-r-4 border-r-emerald-600" : ""
                            )}
                        >
                            <div className="w-12 h-12 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden">
                                {conv.avatar_url ? (
                                    <img src={conv.avatar_url} alt={conv.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-500 font-bold text-lg bg-gray-100">
                                        {conv.name?.[0]}
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0 text-right">
                                <div className="flex justify-between items-baseline mb-1">
                                    <h3 className="font-semibold text-gray-900 truncate">{conv.name}</h3>
                                    {conv.last_message_at && (
                                        <span className="text-[10px] text-gray-400 flex-shrink-0">
                                            {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true, locale: ar })}
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-gray-500 truncate font-light">
                                    {conv.last_message || 'مرفق'}
                                </p>
                            </div>
                        </div>
                    ))
                )}
                </div>
            </div>

            {/* New Chat Modal Overlay */}
            {showNewChatModal && (
                <NewChatModal
                    onClose={() => setShowNewChatModal(false)}
                    onStartDirectChat={startConversation}
                    onStartGroupChat={startGroupConversation}
                />
            )}
        </div>
    );
};
