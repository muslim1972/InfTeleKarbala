import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, BookOpen, Code, Rocket, Cpu, Briefcase, GraduationCap, ShieldCheck, Youtube } from 'lucide-react';

interface DeveloperCVProps {
    isOpen: boolean;
    onClose: () => void;
}

const DeveloperCV: React.FC<DeveloperCVProps> = ({ isOpen, onClose }) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-950/95 backdrop-blur-2xl p-4 md:p-8 overflow-y-auto pt-20"
                >
                    {/* Close Button */}
                    <motion.button
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        whileHover={{ scale: 1.1, rotate: 90 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={onClose}
                        className="fixed top-4 right-4 z-[120] p-3 bg-white/10 hover:bg-red-500/20 text-white rounded-full backdrop-blur-md border border-white/20 transition-all shadow-xl"
                    >
                        <X size={24} />
                    </motion.button>

                    {/* Main Container */}
                    <motion.div
                        initial={{ y: 50, opacity: 0, scale: 0.95 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: 50, opacity: 0, scale: 0.95 }}
                        className="relative w-full max-w-5xl bg-slate-900/50 border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-max text-white mb-10"
                        dir="rtl"
                    >
                        {/* Background Decorations */}
                        <div className="absolute inset-0 overflow-hidden pointer-events-none">
                            <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px]" />
                            <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-purple-600/10 rounded-full blur-[100px]" />
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[length:24px_24px]" />
                        </div>

                        {/* Side Panel (Profile) */}
                        <div className="w-full md:w-1/3 bg-gradient-to-b from-blue-600/20 to-slate-900/80 p-8 flex flex-col items-center justify-center text-center border-b md:border-b-0 md:border-l border-white/10 relative z-10">
                            <motion.div
                                initial={{ scale: 0, rotate: -10 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ delay: 0.2, type: 'spring' }}
                                className="relative"
                            >
                                <div className="w-48 h-48 rounded-full border-4 border-blue-400/30 p-1 bg-gradient-to-tr from-blue-500 to-purple-500 shadow-2xl overflow-hidden mb-6">
                                    <img
                                        src="/صورة 1.jpg"
                                        alt="Eng. Muslim A. Alanazi"
                                        className="w-full h-full object-cover rounded-full"
                                    />
                                </div>
                                <div className="absolute -bottom-2 -right-2 bg-blue-500 p-2 rounded-full shadow-lg">
                                    <Cpu className="text-white" size={20} />
                                </div>
                            </motion.div>

                            <motion.h1
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="text-3xl font-bold mb-1 text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-white"
                            >
                                المهندس مسلم عقيل العنزي
                            </motion.h1>
                            <motion.h2
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                                className="text-lg font-medium text-blue-300/80 mb-6 font-mono"
                            >
                                Eng. Muslim A. Alanazi
                            </motion.h2>

                            <div className="space-y-4 w-full text-right">
                                <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/10">
                                    <Briefcase size={18} className="text-blue-400 shrink-0" />
                                    <span className="text-sm opacity-90 leading-relaxed">موظف في وزارة الاتصالات / مديرية اتصالات ومعلوماتية كربلاء المقدسة</span>
                                </div>
                                <a
                                    href="mailto:muslim@shamel.com"
                                    className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/10 hover:bg-white/10 transition-all group"
                                >
                                    <Mail size={18} className="text-blue-400 shrink-0 group-hover:scale-110 transition-transform" />
                                    <span className="text-sm opacity-90 font-mono hover:text-blue-300">muslim@shamel.com</span>
                                </a>
                                <a
                                    href="https://www.youtube.com/@culturalkarbala4671"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-3 bg-red-500/10 p-3 rounded-xl border border-red-500/20 hover:bg-red-500/20 transition-all group"
                                >
                                    <Youtube size={18} className="text-red-500 shrink-0 group-hover:scale-110 transition-transform" />
                                    <span className="text-sm opacity-90 font-mono">@culturalkarbala4671</span>
                                </a>
                            </div>
                        </div>

                        {/* Content Panel */}
                        <div className="flex-1 p-8 md:p-12 relative z-10">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full">

                                {/* Academic Background */}
                                <motion.section
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.5 }}
                                >
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2 bg-blue-500/20 rounded-lg">
                                            <GraduationCap className="text-blue-400" />
                                        </div>
                                        <h3 className="text-xl font-bold">المسيرة العلمية</h3>
                                    </div>
                                    <ul className="space-y-4">
                                        <li className="flex gap-4 items-start border-r-2 border-blue-500/30 pr-4">
                                            <div>
                                                <p className="font-bold text-blue-300">1992</p>
                                                <p className="text-sm opacity-80">حاصل على دبلوم تقني (حاسبات / اتصالات)</p>
                                            </div>
                                        </li>
                                        <li className="flex gap-4 items-start border-r-2 border-blue-500/30 pr-4">
                                            <div>
                                                <p className="font-bold text-blue-300">2017</p>
                                                <p className="text-sm opacity-80">حاصل على بكلوريوس هندسة (حاسبات / اتصالات)</p>
                                            </div>
                                        </li>
                                    </ul>
                                </motion.section>

                                {/* Programming Journey */}
                                <motion.section
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.6 }}
                                >
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2 bg-purple-500/20 rounded-lg">
                                            <Code className="text-purple-400" />
                                        </div>
                                        <h3 className="text-xl font-bold">الرحلة البرمجية</h3>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {['Q-Basic', 'Fortran', 'Pascal', 'C', 'C++', 'C#', 'SQL', 'Web Tech'].map((tech) => (
                                            <span key={tech} className="px-3 py-1 bg-white/5 rounded-full text-xs border border-white/10">
                                                {tech}
                                            </span>
                                        ))}
                                    </div>
                                    <p className="text-sm opacity-80 leading-relaxed italic border-r-2 border-purple-500/30 pr-4">
                                        "بدأت بكتابة الأكواد منذ عام 1993، متنقلاً بين اللغات الكلاسيكية وصولاً إلى التقنيات الحديثة، مع شغف دائم بالتطوير والابتكار."
                                    </p>
                                </motion.section>

                                {/* Major Projects */}
                                <motion.section
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.7 }}
                                    className="md:col-span-2"
                                >
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2 bg-orange-500/20 rounded-lg">
                                            <Rocket className="text-orange-400" />
                                        </div>
                                        <h3 className="text-xl font-bold">أبرز المحطات والمشاريع</h3>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="p-4 bg-white/5 rounded-2xl border border-white/10 hover:border-blue-500/40 transition-all group">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-xs font-bold text-orange-400">1995</span>
                                                <Cpu size={16} className="opacity-40 group-hover:text-blue-400" />
                                            </div>
                                            <h4 className="font-bold mb-1">نظام المقذوفات الذكي</h4>
                                            <p className="text-xs opacity-70">بناء تطبيق حساب مسار وإحداثيات المقذوف في الوقت الحقيقي، تم استخدامه فعلياً في وزارة الصناعة.</p>
                                        </div>
                                        <div className="p-4 bg-white/5 rounded-2xl border border-white/10 hover:border-purple-500/40 transition-all group">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-xs font-bold text-purple-400">تشفير</span>
                                                <ShieldCheck size={16} className="opacity-40 group-hover:text-purple-400" />
                                            </div>
                                            <h4 className="font-bold mb-1 truncate">SeptaCrypt</h4>
                                            <p className="text-xs opacity-70">تطبيق يعمل متخفياً لتشفير الرسائل بسبعة طبقات حماية بين طرفين (End-to-End)، لضمان أقصى درجات السرية.</p>
                                        </div>
                                        <div className="p-4 bg-white/5 rounded-2xl border border-white/10 hover:border-blue-500/40 transition-all group">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-xs font-bold text-blue-400">2025</span>
                                                <Code size={16} className="opacity-40 group-hover:text-blue-400" />
                                            </div>
                                            <h4 className="font-bold mb-1">Shamil App</h4>
                                            <p className="text-xs opacity-70 leading-relaxed mb-2">منصة شاملة للتواصل الاجتماعي والمراسلة، تجمع بين السرعة والأمان بأحدث التقنيات.</p>
                                            <p className="text-[10px] text-blue-300/80 font-bold bg-blue-500/5 p-2 rounded-lg border border-blue-500/10">
                                                - اطلع على التطبيقات وثبت ما يعجبك
                                                <a href="https://shamelapp.com" target="_blank" rel="noopener noreferrer" className="mr-1 text-blue-400 hover:text-white underline decoration-dotted transition-colors">من هنا</a>
                                            </p>
                                        </div>
                                        <div className="p-4 bg-white/5 rounded-2xl border border-white/10 hover:border-green-500/40 transition-all group sm:col-span-2">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-xs font-bold text-green-400">الحالي</span>
                                                <Briefcase size={16} className="opacity-40 group-hover:text-green-400" />
                                            </div>
                                            <h4 className="font-bold mb-1">نظام الموارد البشرية (HR System)</h4>
                                            <p className="text-xs opacity-70 leading-relaxed">تطبيق متكامل لإدارة الموارد البشرية يعمل حالياً في مديرية اتصالات ومعلوماتية كربلاء المقدسة، مصمم لتسهيل الإجراءات الإدارية والمالية بدقة عالية، بالتعاون مع اساتذة الاختصاص في المديرية.</p>
                                        </div>
                                    </div>
                                </motion.section>

                                {/* Inventions & Specializations */}
                                <motion.section
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.8 }}
                                    className="md:col-span-2"
                                >
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2 bg-green-500/20 rounded-lg">
                                            <BookOpen className="text-green-400" />
                                        </div>
                                        <h3 className="text-xl font-bold">مهارات واختراعات</h3>
                                    </div>
                                    <div className="flex flex-wrap gap-4 text-sm opacity-80">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-green-500" />
                                            <span>متخصص في صيانة الحاسبات وأجهزة الموبايل (دراسة إلكترونية تخصصية).</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-green-500" />
                                            <span>تدريس المواد الهندسية لطلبة الكليات الهندسية والماجستير.</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-green-500" />
                                            <span>صاحب اختراعات وابتكارات في المجالين الميكانيكي والكهربائي.</span>
                                        </div>
                                    </div>
                                </motion.section>

                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default DeveloperCV;
