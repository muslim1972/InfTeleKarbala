import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarCheck, ArrowRight } from 'lucide-react';
import LeaveRequestForm from './LeaveRequestForm';

export const RequestsTabContent = () => {
    const [view, setView] = useState<'list' | 'leave_form'>('list');

    const requestTypes = [
        {
            id: 'leave',
            title: 'طلب إجازة',
            description: 'تقديم طلب إجازة جديد ومتابعة حالته',
            icon: <CalendarCheck size={40} className="text-white" />,
            color: 'bg-gradient-to-br from-blue-500 to-blue-600',
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
                        className="grid grid-cols-1 md:grid-cols-2 gap-4"
                    >
                        {requestTypes.map((type) => (
                            <div
                                key={type.id}
                                onClick={type.onClick}
                                className={`relative overflow-hidden rounded-2xl shadow-lg cursor-pointer transform transition-all duration-300 hover:scale-[1.02] hover:shadow-xl group ${type.color}`}
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-white/20 transition-all"></div>
                                <div className="p-6 flex items-center justify-between relative z-10">
                                    <div className="text-white">
                                        <h3 className="text-xl font-bold mb-1">{type.title}</h3>
                                        <p className="text-white/80 text-sm">{type.description}</p>
                                    </div>
                                    <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                                        {type.icon}
                                    </div>
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
