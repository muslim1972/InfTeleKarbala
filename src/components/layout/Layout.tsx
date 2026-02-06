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
        <div className="min-h-screen w-full relative bg-[var(--bg-primary)] text-[var(--text-primary)] font-tajawal transition-colors duration-300">
            {/* Cosmic Background Effects - Dynamic for both modes */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/10 dark:bg-purple-500/10 light:bg-purple-200/20 blur-[100px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/10 dark:bg-blue-500/10 light:bg-blue-200/20 blur-[100px]" />
                <div className="absolute top-[20%] right-[20%] w-[30%] h-[30%] rounded-full bg-teal-500/5 dark:bg-teal-500/5 light:bg-teal-200/10 blur-[80px]" />
            </div>

            <div className="relative z-10 flex flex-col h-full min-h-screen">
                <AppHeader bottomContent={headerContent} title={headerTitle} showUserName={showUserName} />
                <main className={cn("flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full pb-24 md:pb-28", className)}>
                    {children}
                </main>
                <AppFooter />
            </div>
        </div>
    );
};
