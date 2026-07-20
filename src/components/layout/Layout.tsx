import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "./AppHeader";
import { cn } from "../../lib/utils";

interface LayoutProps {
    children: React.ReactNode;
    className?: string;
    headerContent?: React.ReactNode;
    headerTitle?: string;
    showUserName?: boolean;
    onBack?: () => void;
}

export const Layout = ({ children, className, headerContent, headerTitle, showUserName = false, onBack }: LayoutProps) => {

    return (
        <div className="relative w-full min-h-screen bg-background text-foreground font-tajawal transition-colors duration-300">
            {/* Cosmic Background Effects - Dynamic for both modes */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/10 dark:bg-purple-500/10 light:bg-purple-200/20 blur-[100px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/10 dark:bg-blue-500/10 light:bg-blue-200/20 blur-[100px]" />
                <div className="absolute top-[20%] right-[20%] w-[30%] h-[30%] rounded-full bg-teal-500/5 dark:bg-teal-500/5 light:bg-teal-200/10 blur-[80px]" />
                {/* Watermark Logo */}
                <div
                    className="absolute inset-0"
                    style={{
                        backgroundImage: 'url(/icon-512.png)',
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'center',
                        backgroundSize: '420px',
                        opacity: 0.1,
                    }}
                />
            </div>

            <div className="relative z-10 flex flex-col h-full min-h-screen">
                <AppHeader bottomContent={headerContent} title={headerTitle} showUserName={showUserName} onBack={onBack} />

                <main className={cn("flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full pb-96", className)}>
                    {children}
                </main>
            </div>
        </div>
    );
};
