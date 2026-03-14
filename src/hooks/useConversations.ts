import { useChat } from '../context/ChatContext';

export function useConversations() {
    return useChat();
}
