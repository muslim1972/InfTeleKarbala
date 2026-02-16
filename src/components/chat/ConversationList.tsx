import { useNavigate, useParams } from 'react-router-dom';
import { useConversations } from '../../hooks/useConversations';
import { cn } from '../../lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Plus } from 'lucide-react';

export function ConversationList() {
    const { conversations, loading } = useConversations();
    const navigate = useNavigate();
    const { conversationId } = useParams();

    // Temporary: Create new chat handler (placeholder)
    const handleCreateChat = () => {
        // Logic to select user and create chat
        alert('سيتم إضافة ميزة بدء محادثة جديدة قريباً');
    };

    return (
        <div className="w-full md:w-80 border-l bg-white flex flex-col h-full">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50/50">
                <h2 className="font-bold text-lg text-gray-800">المحادثات</h2>
                <button onClick={handleCreateChat} className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-full transition-colors">
                    <Plus className="w-5 h-5" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="p-4 text-center text-gray-400">جاري التحميل...</div>
                ) : conversations.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-sm">
                        لا توجد محادثات.<br />ابدأ تواصل جديد!
                    </div>
                ) : (
                    conversations.map((conv: any) => (
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
                                    <div className="w-full h-full flex items-center justify-center text-gray-500 font-bold text-lg">
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
    );
}
