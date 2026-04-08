import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useChat } from '../../context/ChatContext';
import { Plus, ArrowRight, Trash2, X } from 'lucide-react';
import { NewChatModal } from './NewChatModal';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { ConversationItem } from './ConversationItem';

export const ConversationList = () => {
    const { conversations, loading, createConversation, createGroupConversation } = useChat();
    const { conversationId } = useParams();
    const navigate = useNavigate();

    // Selection State
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    
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

    const toggleSelection = (id: string) => {
        setSelectedIds(prev => 
            prev.includes(id) 
                ? [] 
                : [id]
        );
    };

    const clearSelection = () => setSelectedIds([]);

    const handleDeleteSelected = async () => {
        if (selectedIds.length === 0) return;
        
        const selectedConv = filteredConversations.find(c => selectedIds.includes(c.id));
        const isGroup = selectedConv?.is_group;
        
        const confirmMsg = isGroup 
            ? "هل أنت متأكد من مغادرة هذه المجموعة؟" 
            : "هل أنت متأكد من حذف هذه المحادثة؟";
            
        if (!window.confirm(confirmMsg)) return;

        const loadingToast = toast.loading('جاري الحذف...');
        try {
            for (const id of selectedIds) {
                const { error } = await supabase.rpc('delete_chat_conversation', { p_conversation_id: id });
                if (error) throw error;
            }
            
            toast.success('تم حذف المحادثات بنجاح', { id: loadingToast });
            clearSelection();
            
            // If the currently open chat was deleted, navigate back to /chat
            if (conversationId && selectedIds.includes(conversationId)) {
                navigate('/chat');
            }
            
            // Dispatch event to refresh the list
            window.dispatchEvent(new CustomEvent('chat_deleted'));
            
        } catch (error) {
            console.error('Error deleting conversations:', error);
            toast.error('حدث خطأ أثناء الحذف', { id: loadingToast });
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
            <div className="p-4 pt-[calc(1rem+env(safe-area-inset-top))] border-b flex justify-between items-center bg-gray-50/50 min-h-[calc(64px+env(safe-area-inset-top))]">
                {selectedIds.length > 0 ? (
                    <>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={clearSelection}
                                className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-600"
                                title="إلغاء التحديد"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            <span className="font-bold text-gray-800">
                                {filteredConversations.find(c => selectedIds.includes(c.id))?.is_group 
                                    ? "مغادرة المجموعة؟" 
                                    : "حذف المحادثة؟"}
                            </span>
                        </div>
                        <button 
                            onClick={handleDeleteSelected}
                            className="p-2 hover:bg-red-50 text-red-600 rounded-full transition-colors" 
                            title="حذف المحدد"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </>
                ) : (
                    <>
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
                        <button onClick={handleCreateChat} className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-full transition-colors" title="محادثة جديدة">
                            <Plus className="w-5 h-5" />
                        </button>
                    </>
                )}
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
                        <ConversationItem
                            key={conv.id}
                            conv={conv}
                            isSelected={selectedIds.includes(conv.id)}
                            hasSelection={selectedIds.length > 0}
                            onToggle={toggleSelection}
                        />
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
