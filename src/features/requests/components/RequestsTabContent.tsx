import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarCheck, ArrowRight } from 'lucide-react';
import LeaveRequestForm from './LeaveRequestForm';

export const RequestsTabContent = () => {
    const [view, setView] = useState<'list' | 'leave_form'>('list');

    const requestTypes = [
        {
            id: 'leave',
            title: 'الإجازات',
            description: 'تقديم طلب إجازة جديد ومتابعة حالته',
            icon: <CalendarCheck size={40} className="text-white drop-shadow-md" />,
            color: 'bg-gradient-to-br from-blue-500 to-indigo-600',
            onClick: () => setView('leave_form')
        },
        // Future types can be added here
    ];

    return (
        <div className="w-full">
            <AnimatePresence mode="wait">
                {view === 'list' ? (
                    <motion.div
                        key="list"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="grid grid-cols-1 md:grid-cols-2 gap-6"
                    >
                        {requestTypes.map((type) => (
                            <div
                                key={type.id}
                                onClick={type.onClick}
                                className={`relative overflow-hidden rounded-3xl cursor-pointer group flex items-center gap-6 p-6 ${type.color} shadow-lg shadow-indigo-500/20 hover:shadow-xl hover:shadow-indigo-500/30 transition-all duration-300 hover:-translate-y-1`}
                            >
                                {/* Background pattern */}
                                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvc3ZnPg==')] opacity-50"></div>
                                
                                <div className={`w-20 h-20 shrink-0 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 z-10 border border-white/20 shadow-inner`}>
                                    {type.icon}
                                </div>
                                
                                <div className="z-10">
                                    <h3 className="text-2xl font-bold text-white mb-1 tracking-wide">
                                        {type.title}
                                    </h3>
                                    <p className="text-blue-100/90 text-sm leading-relaxed">
                                        {type.description}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </motion.div>
                ) : (
                    <motion.div
                        key="form"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                    >
                        <button
                            onClick={() => setView('list')}
                            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors font-medium"
                        >
                            <ArrowRight size={18} />
                            العودة لقائمة الطلبات
                        </button>
                        <LeaveRequestForm onSuccess={() => setView('list')} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
