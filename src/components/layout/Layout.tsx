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
        <div className="min-h-screen w-full relative overflow-x-hidden bg-[#0f172a] text-white font-tajawal">
            {/* Cosmic Background Effects */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/10 blur-[100px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/10 blur-[100px]" />
                <div className="absolute top-[20%] right-[20%] w-[30%] h-[30%] rounded-full bg-teal-500/5 blur-[80px]" />
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
