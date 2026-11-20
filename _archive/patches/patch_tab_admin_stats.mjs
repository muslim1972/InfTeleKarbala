import fs from 'fs';

const filePath = 'd:/InfTeleKarbala/src/components/admin/dashboard/TabAdminStats.tsx';
let code = fs.readFileSync(filePath, 'utf-8');

// 1. Update the grid definition and wrap the 5th card
const oldGrid = `<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <StatSummaryCard 
                    title="الموظفون بالخدمة" 
                    value={totalEmployees} 
                    icon={Users} 
                    color="blue"
                    theme={theme}
                />
                <StatSummaryCard 
                    title="سجل المتقاعدين" 
                    value={stats?.retired_count || 0} 
                    icon={Award} 
                    color="amber"
                    theme={theme}
                />
                <StatSummaryCard 
                    title="نشاط اليوم" 
                    value={\`\${todayLogins} دخول\`} 
                    icon={Activity} 
                    color="green"
                    theme={theme}
                    clickable
                    onClick={() => setShowVisitorsModal(true)}
                />
                <StatSummaryCard 
                    title="مواليد هذا العام" 
                    value={stats?.birth_year_dist?.[new Date().getFullYear().toString()] || 0} 
                    icon={CalendarDays} 
                    color="purple"
                    theme={theme}
                />
                <StatSummaryCard 
                    title="التعيينات الجديدة" 
                    value={stats?.appointment_year_dist?.[new Date().getFullYear().toString()] || 0} 
                    icon={TrendingUp} 
                    color="amber"
                    theme={theme}
                />
            </div>`;

const newGrid = `<div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-4">
                <StatSummaryCard 
                    title="الموظفون بالخدمة" 
                    value={totalEmployees} 
                    icon={Users} 
                    color="blue"
                    theme={theme}
                />
                <StatSummaryCard 
                    title="سجل المتقاعدين" 
                    value={stats?.retired_count || 0} 
                    icon={Award} 
                    color="amber"
                    theme={theme}
                />
                <StatSummaryCard 
                    title="نشاط اليوم" 
                    value={\`\${todayLogins} دخول\`} 
                    icon={Activity} 
                    color="green"
                    theme={theme}
                    clickable
                    onClick={() => setShowVisitorsModal(true)}
                />
                <StatSummaryCard 
                    title="مواليد هذا العام" 
                    value={stats?.birth_year_dist?.[new Date().getFullYear().toString()] || 0} 
                    icon={CalendarDays} 
                    color="purple"
                    theme={theme}
                />
                <div className="col-span-2 lg:col-span-1">
                    <StatSummaryCard 
                        title="التعيينات الجديدة" 
                        value={stats?.appointment_year_dist?.[new Date().getFullYear().toString()] || 0} 
                        icon={TrendingUp} 
                        color="amber"
                        theme={theme}
                    />
                </div>
            </div>`;

// 2. Update StatSummaryCard component styling
const oldCardFunc = `const StatSummaryCard = ({ 
    title, 
    value, 
    icon: Icon, 
    color, 
    theme, 
    clickable, 
    onClick 
}: StatSummaryCardProps) => {
    const colors = {
        blue: "text-blue-500 bg-blue-500/10 border-blue-500/20",
        green: "text-green-500 bg-green-500/10 border-green-500/20",
        purple: "text-purple-500 bg-purple-500/10 border-purple-500/20",
        amber: "text-amber-500 bg-amber-500/10 border-amber-500/20"
    };

    return (
        <GlassCard 
            onClick={clickable ? onClick : undefined}
            className={cn(
                "p-4 flex items-center gap-4 transition-all duration-200 select-none",
                clickable && "cursor-pointer hover:scale-[1.02] active:scale-[0.98] hover:border-green-500/40 hover:shadow-lg"
            )}
        >
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border", colors[color])}>
                <Icon className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                    <p className={cn("text-[10px] font-bold uppercase tracking-wider opacity-50", theme === 'light' ? "text-gray-900" : "text-white")}>
                        {title}
                    </p>
                    {clickable && (
                        <span className="text-[9px] font-bold text-green-600 dark:text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded-full">
                            تصفية
                        </span>
                    )}
                </div>
                <p className={cn("text-2xl font-black truncate", theme === 'light' ? "text-gray-900" : "text-white")}>
                    {value}
                </p>
            </div>
        </GlassCard>
    );
};`;

const newCardFunc = `const StatSummaryCard = ({ 
    title, 
    value, 
    icon: Icon, 
    color, 
    theme, 
    clickable, 
    onClick 
}: StatSummaryCardProps) => {
    const colors = {
        blue: "text-blue-500 bg-blue-500/10 border-blue-500/20",
        green: "text-green-500 bg-green-500/10 border-green-500/20",
        purple: "text-purple-500 bg-purple-500/10 border-purple-500/20",
        amber: "text-amber-500 bg-amber-500/10 border-amber-500/20"
    };

    return (
        <GlassCard 
            onClick={clickable ? onClick : undefined}
            className={cn(
                "p-3 sm:p-4 flex items-center gap-2.5 sm:gap-4 transition-all duration-200 select-none",
                clickable && "cursor-pointer hover:scale-[1.02] active:scale-[0.98] hover:border-green-500/40 hover:shadow-lg"
            )}
        >
            <div className={cn("w-9 h-9 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 border", colors[color])}>
                <Icon className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                    <p className={cn("text-[9.5px] sm:text-[10px] font-bold uppercase tracking-wider opacity-60 truncate", theme === 'light' ? "text-gray-900" : "text-white")}>
                        {title}
                    </p>
                    {clickable && (
                        <span className="text-[8px] sm:text-[9px] font-bold text-green-600 dark:text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded-full shrink-0">
                            تصفية
                        </span>
                    )}
                </div>
                <p className={cn("text-lg sm:text-2xl font-black truncate", theme === 'light' ? "text-gray-900" : "text-white")}>
                    {value}
                </p>
            </div>
        </GlassCard>
    );
};`;

const codeLf = code.replace(/\r\n/g, '\n');
const oldGridLf = oldGrid.replace(/\r\n/g, '\n');
const newGridLf = newGrid.replace(/\r\n/g, '\n');
const oldCardFuncLf = oldCardFunc.replace(/\r\n/g, '\n');
const newCardFuncLf = newCardFunc.replace(/\r\n/g, '\n');

if (codeLf.includes(oldGridLf) && codeLf.includes(oldCardFuncLf)) {
    code = codeLf.replace(oldGridLf, newGridLf).replace(oldCardFuncLf, newCardFuncLf);
    fs.writeFileSync(filePath, code, 'utf-8');
    console.log('Successfully patched TabAdminStats.tsx');
} else {
    console.error('Could not find snippets in TabAdminStats.tsx');
    process.exit(1);
}
