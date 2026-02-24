import { BookOpen, Laptop, BellRing, ClipboardList } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { AccordionSection } from "../ui/AccordionSection";
import { PollCreator } from "../admin/PollCreator";
import { TrainingPollsList } from "./TrainingPollsList";

export const TrainingTabContent = ({ isAdmin = false }: { isAdmin?: boolean }) => {
    const [openSection, setOpenSection] = useState<string | null>(null);

    const toggleSection = (section: string) => {
        setOpenSection(prev => prev === section ? null : section);
    };
    const sections = [
        {
            id: 'curriculum',
            title: 'المنهاج التدريبي',
            icon: BookOpen,
            color: 'from-blue-600 to-blue-500'
        },
        {
            id: 'exam',
            title: 'الاختبار الالكتروني',
            icon: Laptop,
            color: 'from-purple-600 to-purple-500'
        },
        {
            id: 'notifications',
            title: 'التبليغات',
            icon: BellRing,
            color: 'from-amber-600 to-amber-500'
        },
        {
            id: 'survey',
            title: 'استطلاع رأي المتدربين',
            icon: ClipboardList,
            color: 'from-green-600 to-green-500'
        }
    ];

    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    };

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-6 mx-2 md:mx-6"
        >
            {sections.map((section) => (
                <motion.div key={section.id} variants={itemVariants}>
                    <AccordionSection
                        id={section.id}
                        title={section.title}
                        icon={section.icon}
                        color={section.color}
                        isOpen={openSection === section.id}
                        onToggle={() => toggleSection(section.id)}
                    >
                        {section.id === 'survey' ? (
                            <div className="p-4">
                                {isAdmin ? <PollCreator category="training" /> : <TrainingPollsList />}
                            </div>
                        ) : (
                            <div className="p-4 text-center">
                                <h4 className="text-sm font-bold text-foreground mb-1">تحت التطوير</h4>
                                <p className="text-muted-foreground text-xs">سيتم اطلاق هذا القسم قريباً</p>
                            </div>
                        )}
                    </AccordionSection>
                </motion.div>
            ))}
            {/* Spacer for scroll */}
            <div className="h-20"></div>
        </motion.div>
    );
};
