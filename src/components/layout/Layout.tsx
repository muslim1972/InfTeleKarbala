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
    return (
        <div className="min-h-screen bg-[#0f172a] text-white font-cairo relative">
            {/* Cosmic Background Effects */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                {/* Deep Space Gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#020617] via-[#0f172a] to-[#1e1b4b]" />

                {/* Nebulas / Orbs */}
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-purple-500/20 blur-[120px] mix-blend-screen animate-float" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-blue-500/20 blur-[120px] mix-blend-screen animate-float" style={{ animationDelay: '-2s' }} />
                <div className="absolute top-[40%] left-[50%] -translate-x-1/2 w-[300px] h-[300px] rounded-full bg-brand-green/10 blur-[80px] mix-blend-screen animate-pulse-slow" />

                {/* Stars Overlay (Optional noise texture) */}
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-150 contrast-150 mix-blend-overlay"></div>
            </div>

            <div className="relative z-10 flex flex-col h-full min-h-screen">
                <AppHeader bottomContent={headerContent} title={headerTitle} showUserName={showUserName} />
                <main className={cn("flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full pb-24 md:pb-28", className)}>
                    {children}
                </main>
                <AppFooter />

                {/* Global Sticky Signature */}
                <img
                    src="/MyName.png"
                    alt="Signature"
                    className="fixed bottom-16 right-4 z-[60] w-10 md:w-14 pointer-events-none opacity-90"
                />
            </div>
        </div>
    );
};
