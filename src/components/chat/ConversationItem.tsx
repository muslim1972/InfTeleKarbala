import { useNavigate, useParams } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { CheckCircle2 } from 'lucide-react';
import useLongPress from '../../hooks/useLongPress';

interface ConversationItemProps {
    conv: any;
    isSelected: boolean;
    hasSelection: boolean;
    onToggle: (id: string) => void;
}

export const ConversationItem = ({ conv, isSelected, hasSelection, onToggle }: ConversationItemProps) => {
    const navigate = useNavigate();
    const { conversationId } = useParams();

    const longPressEvent = useLongPress(
        () => onToggle(conv.id),
        () => {
            if (hasSelection) {
                onToggle(conv.id);
            } else {
                navigate(`/chat/${conv.id}`);
            }
        },
        { delay: 800 }
    );

    return (
        <div
            {...longPressEvent}
            className={cn(
                "p-3 border-b cursor-pointer transition-all flex items-center gap-3 relative overflow-hidden",
                isSelected ? "bg-emerald-100/50" : "hover:bg-emerald-50/50",
                conversationId === conv.id && !isSelected ? "bg-emerald-50 border-r-4 border-r-emerald-600" : ""
            )}
        >
            {/* Selection Checkbox */}
            {hasSelection && (
                <div className="absolute left-3 z-10 animate-in fade-in zoom-in duration-200">
                    <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                        isSelected ? "bg-emerald-600 border-emerald-600 scale-110" : "bg-white border-gray-300"
                    )}>
                        {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </div>
                </div>
            )}

            <div className="w-12 h-12 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden relative">
                {conv.avatar_url ? (
                    <img src={conv.avatar_url} alt={conv.name} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 font-bold text-lg bg-gray-100 text-center">
                        {conv.name?.[0]}
                    </div>
                )}
            </div>
            <div className="flex-1 min-w-0 text-right">
                <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate mb-0.5">{conv.name}</h3>
                        <p className={cn(
                            "text-sm truncate",
                            conv.unread_count > 0 ? "text-gray-900 font-bold" : "text-gray-500 font-light"
                        )}>
                            {conv.last_message || 'مرفق'}
                        </p>
                    </div>

                    <div className="flex flex-col items-end gap-2 pr-2 shrink-0">
                        {conv.last_message_at && (
                            <span className="text-[10px] text-gray-400 tabular-nums">
                                {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true, locale: ar })}
                            </span>
                        )}
                        {conv.unread_count > 0 && !isSelected && (
                            <div className="bg-blue-600 text-white text-[10px] font-bold min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center shadow-md animate-in zoom-in duration-300">
                                {conv.unread_count}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
