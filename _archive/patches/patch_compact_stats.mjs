import fs from 'fs';

const filePath = 'd:/InfTeleKarbala/src/components/admin/dashboard/TabAdminStats.tsx';
let code = fs.readFileSync(filePath, 'utf-8');

// 1. Remove Calendar from imports
code = code.replace("    Calendar,\n", "");

// 2. Replace the Main Charts Grid
const oldGridStart = `            {/* Main Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">`;

const oldGridEnd = `            {/* Active Visitors Modal */}
            <ActiveVisitorsModal`;

const gridStartIndex = code.indexOf(oldGridStart);
const gridEndIndex = code.indexOf(oldGridEnd);

if (gridStartIndex === -1 || gridEndIndex === -1) {
    console.error('Could not find grid indices');
    process.exit(1);
}

const newGridContent = `            {/* Main Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Gender Distribution Card */}
                <GlassCard className="p-4 sm:p-6">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                            <Users className="w-5 h-5 text-blue-500 opacity-70" />
                            <h3 className={cn("font-bold text-base sm:text-lg", theme === 'light' ? "text-gray-900" : "text-white")}>
                                توزيع النوع الاجتماعي
                            </h3>
                        </div>

                        {/* زر طباعة غير المحدد في الركن الأيسر الأعلى */}
                        <button
                            onClick={handlePrintUnspecified}
                            disabled={printingUnspecified}
                            title="طباعة قائمة الموظفين غير محددي الجنس لإحالتها إلى الموارد البشرية"
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all shadow-sm active:scale-95",
                                theme === 'light'
                                    ? "bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300"
                                    : "bg-white/10 hover:bg-white/15 text-white/90 border-white/10"
                            )}
                        >
                            {printingUnspecified ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                            ) : (
                                <Printer className="w-3.5 h-3.5 text-blue-500" />
                            )}
                            <span>طباعة غير المحدد ({unspecifiedCount})</span>
                        </button>
                    </div>

                    <div className="flex flex-col items-center justify-center py-2">
                        {/* Interactive Dynamic Donut Chart */}
                        <div className="relative flex flex-col items-center">
                            <DonutChart 
                                data={[
                                    { label: 'ذكور', value: maleCount, color: '#3B82F6', percentage: malePct },
                                    { label: 'إناث', value: femaleCount, color: '#EC4899', percentage: femalePct },
                                    { label: 'غير محدد', value: unspecifiedCount, color: '#94A3B8', percentage: unspecifiedPct }
                                ]}
                                total={totalEmployees}
                                theme={theme}
                            />
                            {/* Badges showing percentages and counts in a single compact row */}
                            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mt-4 text-xs font-bold">
                                <span className="text-blue-500 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-full whitespace-nowrap shadow-sm">
                                    ذكور {malePct.toFixed(0)}% = {maleCount}
                                </span>
                                <span className="text-pink-500 bg-pink-500/10 border border-pink-500/20 px-2.5 py-1 rounded-full whitespace-nowrap shadow-sm">
                                    إناث {femalePct.toFixed(0)}% = {femaleCount}
                                </span>
                                <span className="text-gray-500 bg-gray-500/10 border border-gray-500/20 px-2.5 py-1 rounded-full whitespace-nowrap shadow-sm">
                                    غير محدد {unspecifiedPct.toFixed(0)}% = {unspecifiedCount}
                                </span>
                            </div>
                        </div>
                    </div>
                </GlassCard>

                {/* Appointment Years */}
                <GlassCard className="p-4 sm:p-6">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-amber-500 opacity-70" />
                            <h3 className={cn("font-bold text-base sm:text-lg", theme === 'light' ? "text-gray-900" : "text-white")}>
                                توزيع التعيينات حسب السنوات
                            </h3>
                        </div>
                    </div>
                    <div className="space-y-4">
                        {Object.entries(stats?.appointment_year_dist || {})
                            .sort((a, b) => b[0].localeCompare(a[0]))
                            .slice(0, 5)
                            .map(([year, count]) => (
                                <div key={year} className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span className={theme === 'light' ? "text-gray-600" : "text-white/60"}>{year}</span>
                                        <span className="font-bold text-amber-500">{count} موظف</span>
                                    </div>
                                    <div className="h-2 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                                        <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: \`\${(count / Math.max(...Object.values(stats?.appointment_year_dist || {}), 1)) * 100}%\` }}
                                            className="h-full bg-amber-500 rounded-full"
                                        />
                                    </div>
                                </div>
                            ))}
                    </div>
                </GlassCard>
            </div>

            `;

code = code.substring(0, gridStartIndex) + newGridContent + code.substring(gridEndIndex);

// 3. Remove unused LegendItem component & interface at bottom
const legendItemIndex = code.indexOf('interface LegendItemProps {');
if (legendItemIndex !== -1) {
    code = code.substring(0, legendItemIndex).trimEnd() + '\n';
    console.log('Removed LegendItem definition');
}

fs.writeFileSync(filePath, code, 'utf-8');
console.log('Successfully patched TabAdminStats.tsx with compact gender card and removed 2 unused cards');
