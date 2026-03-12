import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useChatState } from '../../hooks/useChatState';
import { useConversationDetails } from '../../hooks/useConversationDetails';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ArrowRight, MoreVertical, Trash2, Palette, Check, RotateCcw } from 'lucide-react';
import { SelectionHeader } from './SelectionHeader';
import { supabase } from '../../lib/supabase';
import { useChatSettings, type FontSize } from '../../hooks/useChatSettings';
import { cn } from '../../lib/utils';

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
    const [showSettings, setShowSettings] = useState(false);
    const { settings, updateSettings, resetSettings } = useChatSettings();

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
        sendVoiceMessage,
        selectedMessages,
        toggleSelection,
        clearSelection,
        deleteMessages
    } = useChatState(conversationId || '');

    const { details, loading: detailsLoading } = useConversationDetails(conversationId || '');

    const fontSizes: { label: string, value: FontSize }[] = [
        { label: 'صغير', value: 'sm' },
        { label: 'متوسط', value: 'md' },
        { label: 'كبير', value: 'lg' },
        { label: 'ضخم', value: 'xl' },
    ];

    const messageColors = [
        { name: 'أخضر (افتراضي)', me: '#059669', other: '#ffffff', textMe: '#ffffff', textOther: '#1f2937' },
        { name: 'أزرق ملكي', me: '#2563eb', other: '#f8fafc', textMe: '#ffffff', textOther: '#1e3a8a' },
        { name: 'بنفسجي هادئ', me: '#7c3aed', other: '#f5f3ff', textMe: '#ffffff', textOther: '#4c1d95' },
        { name: 'وردي لطيف', me: '#db2777', other: '#fff1f2', textMe: '#ffffff', textOther: '#831843' },
        { name: 'رمادي ليلي', me: '#4b5563', other: '#f9fafb', textMe: '#ffffff', textOther: '#111827' },
    ];

    if (!conversationId) {
        return <div className="p-4 text-right">اختر محادثة للبدء</div>;
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

                    <div className="flex items-center gap-1 relative">
                        {/* Appearance Settings Button */}
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className={cn(
                                "p-2 hover:bg-gray-100 rounded-full transition-all",
                                showSettings ? "bg-emerald-50 text-emerald-600" : "text-gray-600"
                            )}
                            title="تنسيق المحادثة"
                        >
                            <Palette className="w-5 h-5" />
                        </button>

                        <button
                            onClick={() => setShowMenu(!showMenu)}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <MoreVertical className="w-5 h-5 text-gray-600" />
                        </button>

                        {/* Settings Popover */}
                        {showSettings && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowSettings(false)}></div>
                                <div className="absolute left-0 top-full mt-2 w-80 bg-white rounded-[2rem] shadow-2xl border border-gray-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                    <div className="p-5 border-b bg-gray-50/50 flex items-center justify-between">
                                        <h3 className="font-bold text-gray-800 text-base flex items-center gap-2">
                                            <Palette className="w-5 h-5 text-emerald-600" />
                                            تنسيق الدردشة
                                        </h3>
                                        <button 
                                            onClick={resetSettings}
                                            className="text-xs font-bold text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors"
                                        >
                                            <RotateCcw className="w-4 h-4" />
                                            إعادة تعيين
                                        </button>
                                    </div>
                                    
                                    <div className="p-5 space-y-6 text-right">
                                        {/* Font Size */}
                                        <div className="space-y-3">
                                            <label className="text-xs font-bold text-gray-400 block px-1">حجم الخط</label>
                                            <div className="grid grid-cols-4 gap-1.5">
                                                {fontSizes.map((fs) => (
                                                    <button
                                                        key={fs.value}
                                                        onClick={() => updateSettings({ fontSize: fs.value })}
                                                        className={cn(
                                                            "py-3 px-1 text-xs font-bold rounded-xl border transition-all",
                                                            settings.fontSize === fs.value 
                                                                ? "bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-200" 
                                                                : "bg-white border-gray-100 text-gray-600 hover:border-emerald-200 hover:bg-emerald-50"
                                                        )}
                                                    >
                                                        {fs.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Colors */}
                                        <div className="space-y-3">
                                            <label className="text-xs font-bold text-gray-400 block px-1">نمط الألوان</label>
                                            <div className="space-y-2">
                                                {messageColors.map((color) => (
                                                    <button
                                                        key={color.name}
                                                        onClick={() => updateSettings({ 
                                                            bubbleColorMe: color.me,
                                                            bubbleColorOther: color.other,
                                                            textColorMe: color.textMe,
                                                            textColorOther: color.textOther
                                                        })}
                                                        className={cn(
                                                            "w-full p-3 rounded-2xl border flex items-center justify-between transition-all",
                                                            settings.bubbleColorMe === color.me 
                                                                ? "border-emerald-500 bg-emerald-50/30 ring-1 ring-emerald-500" 
                                                                : "border-gray-100 hover:border-emerald-100 bg-gray-50/30"
                                                        )}
                                                    >
                                                        {settings.bubbleColorMe === color.me ? (
                                                            <Check className="w-4 h-4 text-emerald-600" />
                                                        ) : (
                                                            <div className="w-4" />
                                                        )}
                                                        <span className="text-xs font-bold text-gray-700">{color.name}</span>
                                                        <div className="flex -space-x-2 px-1">
                                                            <div className="w-5 h-5 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: color.me }} />
                                                            <div className="w-5 h-5 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: color.other }} />
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Options */}
                                        <div className="flex items-center justify-between pt-2">
                                            <button
                                                onClick={() => updateSettings({ isBold: !settings.isBold })}
                                                className={cn(
                                                    "w-full py-3.5 rounded-2xl border text-xs font-extrabold transition-all flex items-center justify-center gap-2",
                                                    settings.isBold 
                                                        ? "bg-gray-800 text-white border-gray-800 shadow-md" 
                                                        : "bg-white text-gray-600 border-gray-100 hover:bg-gray-50"
                                                )}
                                            >
                                                <span>نص عريض (B)</span>
                                            </button>
                                        </div>

                                        {/* Save and Close Button */}
                                        <div className="pt-2 border-t border-gray-100/50">
                                            <button
                                                onClick={() => setShowSettings(false)}
                                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 rounded-2xl transition-all shadow-lg shadow-emerald-200 active:scale-[0.98] text-sm flex items-center justify-center gap-2"
                                            >
                                                <Check className="w-4 h-4" />
                                                <span>حفظ وإغلاق</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

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
                isGroup={details?.is_group}
                selectedMessages={selectedMessages}
                onToggleSelection={toggleSelection}
            />

            {/* Input */}
            <MessageInput
                key={conversationId}
                value={newMessage}
                onChange={setNewMessage}
                onSend={sendMessage}
                onSendVoice={sendVoiceMessage}
                disabled={selectedMessages.length > 0}
            />
        </div>
    );
}
