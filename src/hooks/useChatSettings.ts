import { useChatSettingsContext } from '../context/ChatSettingsContext';

export type { FontSize, ChatSettings } from '../context/ChatSettingsContext';

export function useChatSettings() {
    return useChatSettingsContext();
}
