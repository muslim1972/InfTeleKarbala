import React, { createContext, useContext, useState, useEffect } from 'react';

export type FontSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ChatSettings {
    fontSize: FontSize;
    bubbleColorMe: string;
    bubbleColorOther: string;
    textColorMe: string;
    textColorOther: string;
    isBold: boolean;
}

const DEFAULT_SETTINGS: ChatSettings = {
    fontSize: 'md',
    bubbleColorMe: '#059669', // emerald-600
    bubbleColorOther: '#ffffff',
    textColorMe: '#ffffff',
    textColorOther: '#1f2937', // gray-800
    isBold: false
};

interface ChatSettingsContextType {
    settings: ChatSettings;
    updateSettings: (updates: Partial<ChatSettings>) => void;
    resetSettings: () => void;
}

const ChatSettingsContext = createContext<ChatSettingsContextType | undefined>(undefined);

export function ChatSettingsProvider({ children }: { children: React.ReactNode }) {
    const [settings, setSettings] = useState<ChatSettings>(() => {
        const saved = localStorage.getItem('chat_appearance_settings');
        if (saved) {
            try {
                return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
            } catch (e) {
                return DEFAULT_SETTINGS;
            }
        }
        return DEFAULT_SETTINGS;
    });

    useEffect(() => {
        localStorage.setItem('chat_appearance_settings', JSON.stringify(settings));
    }, [settings]);

    const updateSettings = (updates: Partial<ChatSettings>) => {
        setSettings(prev => ({ ...prev, ...updates }));
    };

    const resetSettings = () => {
        setSettings(DEFAULT_SETTINGS);
    };

    return (
        <ChatSettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
            {children}
        </ChatSettingsContext.Provider>
    );
}

export function useChatSettingsContext() {
    const context = useContext(ChatSettingsContext);
    if (!context) {
        throw new Error('useChatSettingsContext must be used within a ChatSettingsProvider');
    }
    return context;
}
