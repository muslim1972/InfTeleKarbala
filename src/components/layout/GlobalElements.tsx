import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AppFooter } from "./AppFooter";
import DeveloperCV from "../ui/DeveloperCV";
import { AppNotifications } from "../features/AppNotifications";
import { useChat } from "../../context/ChatContext";

export const GlobalElements = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [isCVOpen, setIsCVOpen] = useState(false);
    const { totalUnreadCount } = useChat();

    // Do not show global elements if running inside an iframe (e.g. CapacitiesIframe)
    // to prevent duplicate footers.
    const isIframe = window !== window.top;

    // Do not show global elements on the chat page to avoid blocking the input
    if (location.pathname.startsWith('/chat') || isIframe) {
        return null;
    }

    return (
        <>
            <AppFooter onDeveloperClick={() => setIsCVOpen(true)} />
            <AppNotifications />
            
            {/* Global Chat FAB */}
            <button
                onClick={() => navigate('/chat')}
                className="fixed bottom-3 left-3 md:bottom-4 md:left-4 z-[100] w-12 h-12 md:w-14 md:h-14 rounded-full transition-all duration-300 transform hover:scale-110 active:scale-95 group p-0 flex items-center justify-center focus:outline-none"
            >
                <div className="relative w-full h-full">
                    <img
                        src="/images/conv-icon.png"
                        alt="المحادثات"
                        className="w-full h-full object-cover relative z-10"
                        onError={(e) => {
                            e.currentTarget.style.display = 'none';
                        }}
                    />
                    {totalUnreadCount > 0 && (
                        <div className="absolute -top-1 -right-1 z-20 min-w-[22px] h-[22px] px-1.5 bg-red-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-lg animate-in zoom-in-50 duration-200">
                            {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                        </div>
                    )}
                </div>
                {/* Fallback Icon */}
                <div className="absolute inset-0 flex items-center justify-center -z-10 bg-purple-500 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-white"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></svg>
                </div>

                <span className="sr-only">المحادثات</span>

                {/* Ripple Effect Grid */}
                <div
                    className="absolute inset-0 rounded-full border-[6px] animate-pulse-custom pointer-events-none"
                    style={{ borderColor: '#8b5cf6' }}
                />
            </button>

            <DeveloperCV isOpen={isCVOpen} onClose={() => setIsCVOpen(false)} />
        </>
    );
};
