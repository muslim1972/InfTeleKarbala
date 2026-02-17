import { useNavigate } from "react-router-dom";
import { AppHeader } from "./AppHeader";
import { AppFooter } from "./AppFooter";
import { cn } from "../../lib/utils";

interface LayoutProps {
    children: React.ReactNode;
    className?: string;
    headerContent?: React.ReactNode;
    headerTitle?: string;
    showUserName?: boolean;
}

export const Layout = ({ children, className, headerContent, headerTitle, showUserName = false }: LayoutProps) => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen w-full relative bg-background text-foreground font-tajawal transition-colors duration-300">
            {/* Cosmic Background Effects - Dynamic for both modes */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/10 dark:bg-purple-500/10 light:bg-purple-200/20 blur-[100px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/10 dark:bg-blue-500/10 light:bg-blue-200/20 blur-[100px]" />
                <div className="absolute top-[20%] right-[20%] w-[30%] h-[30%] rounded-full bg-teal-500/5 dark:bg-teal-500/5 light:bg-teal-200/10 blur-[80px]" />
            </div>

            <div className="relative z-10 flex flex-col h-full min-h-screen">
                <AppHeader bottomContent={headerContent} title={headerTitle} showUserName={showUserName} />
                <main className={cn("flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full pb-32 md:pb-40", className)}>
                    {children}
                </main>
                <AppFooter />

                {/* Global Chat FAB */}
                <button
                    onClick={() => navigate('/chat')}
                    className="fixed bottom-24 left-6 z-50 w-16 h-16 rounded-full transition-all duration-300 transform hover:scale-110 active:scale-95 group p-0 flex items-center justify-center focus:outline-none"
                >
                    {/* Main Icon - Increased Z-index */}
                    <img
                        src="/images/conv-icon.png"
                        alt="المحادثات"
                        className="w-full h-full object-cover relative z-10"
                        onError={(e) => {
                            e.currentTarget.style.display = 'none';
                        }}
                    />
                    {/* Fallback Icon */}
                    <div className="absolute inset-0 flex items-center justify-center -z-10">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-message-circle w-8 h-8 text-white"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></svg>
                    </div>

                    <span className="sr-only">المحادثات</span>

                    {/* Ripple Effect Grid - Z-index 0 to sit ON TOP of button background but BELOW image (z-10) */}
                    <div
                        className="absolute inset-0 rounded-full border-[6px] animate-pulse-custom pointer-events-none"
                        style={{ borderColor: '#8b5cf6' }}
                    />
                </button>
            </div>
        </div>
    );
};
