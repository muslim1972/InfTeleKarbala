import { useLocation } from 'react-router-dom';
import { ConversationList } from './ConversationList';
import { cn } from '../../lib/utils';
import { ChatScreen } from './ChatScreen';

export function ChatLayout() {
    const location = useLocation();
    const isChatOpen = location.pathname.includes('/chat/') && location.pathname !== '/chat';

    return (
        <div className="flex h-screen bg-gray-100 overflow-hidden" dir="rtl">
            {/* List Panel - Hidden on Mobile if Chat is Open */}
            <div className={cn(
                "flex-shrink-0 w-full md:w-80 bg-white shadow-xl z-20 transition-transform duration-300 pointer-events-auto",
                isChatOpen ? "hidden md:flex" : "flex"
            )}>
                <ConversationList />
            </div>

            {/* Chat Panel - Full width on mobile when open */}
            <div className="flex-1 flex flex-col h-full bg-gray-50 relative">
                {/* If we are at root /chat, show placeholder */}
                {!isChatOpen ? (
                    <div className="hidden md:flex flex-1 items-center justify-center text-gray-400 flex-col gap-4">
                        <div className="w-32 h-32 bg-gray-200 rounded-full flex items-center justify-center text-6xl opacity-50">
                            💬
                        </div>
                        <p className="text-lg font-medium">اختر محادثة لبدء التواصل</p>
                    </div>
                ) : (
                    <ChatScreen />
                )}
            </div>
        </div>
    );
}
