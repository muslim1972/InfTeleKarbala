import React, { useRef } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';

export type LeaveType = 'regular' | 'long_regular' | 'sick' | 'long_sick' | 'time_off' | 'dispatch' | 'duty';

export const LEAVE_TYPES_CONFIG = [
  { id: 'regular', name: 'اعتيادية', icon: '📅', desc: 'حتى 9 أيام • بموافقة المسؤول • تُخصم من رصيدك تلقائياً' },
  { id: 'long_regular', name: 'اعتيادية طويلة', icon: '🗓️', desc: 'أكثر من 9 أيام • تحتاج براءة ذمة وأمر إداري' },
  { id: 'sick', name: 'مرضية', icon: '💊', desc: 'حتى 21 يوم • تحتاج كتاب إرسال للمستشفى' },
  { id: 'long_sick', name: 'مرضية طويلة', icon: '🏥', desc: 'من 22 يوم إلى 6 أشهر • تحتاج تقرير طبي' },
  { id: 'time_off', name: 'زمنية', icon: '⏱️', desc: 'من 30 دقيقة إلى ساعتين • تحسب كتراكمية كل 7 ساعات' },
  { id: 'dispatch', name: 'إيفاد', icon: '💼', desc: 'مهمة عمل رسمية خارجية' },
  { id: 'duty', name: 'واجب', icon: '🚗', desc: 'مهمة ليوم واحد فقط' }
] as const;

interface Props {
  selectedType: LeaveType;
  onSelect: (type: LeaveType) => void;
}

const LeaveTypeSelector: React.FC<Props> = ({ selectedType, onSelect }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 200;
      scrollContainerRef.current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  };

  const selectedConfig = LEAVE_TYPES_CONFIG.find(t => t.id === selectedType);

  return (
    <div className="space-y-4 mb-6 relative">
      
      <div className="relative flex items-center">
        {/* Right Arrow (Start in RTL) */}
        <button 
          type="button" 
          onClick={() => scroll('right')} 
          className="absolute right-0 z-10 p-1.5 bg-white dark:bg-slate-800 rounded-full shadow-md border border-gray-200 dark:border-slate-700 text-blue-600 animate-pulse hover:animate-none hover:scale-110 transition-transform -mr-2 flex items-center justify-center"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        <div ref={scrollContainerRef} className="flex overflow-x-auto py-2 px-8 gap-2 hide-scrollbar scroll-smooth w-full">
          {LEAVE_TYPES_CONFIG.map((type) => (
          <button
            key={type.id}
            type="button"
            onClick={() => onSelect(type.id as LeaveType)}
            className={`whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold transition-all duration-200 border-2 shadow-sm \${
              selectedType === type.id 
                ? 'shadow-blue-500/30' 
                : 'hover:shadow-md'
            }`}
            style={{
              backgroundColor: selectedType === type.id ? '#2563eb' : 'transparent',
              borderColor: selectedType === type.id ? '#2563eb' : '#e5e7eb',
              color: selectedType === type.id ? '#ffffff' : 'inherit'
            }}
          >
            <span>{type.icon}</span>
            <span style={{ color: selectedType === type.id ? '#ffffff' : '' }} className="dark:text-gray-200">
              {type.name}
            </span>
          </button>
        ))}
        </div>

        {/* Left Arrow (End in RTL) */}
        <button 
          type="button" 
          onClick={() => scroll('left')} 
          className="absolute left-0 z-10 p-1.5 bg-white dark:bg-slate-800 rounded-full shadow-md border border-gray-200 dark:border-slate-700 text-blue-600 animate-pulse hover:animate-none hover:scale-110 transition-transform -ml-2 flex items-center justify-center"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>

      {selectedConfig && (
        <div className="p-4 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-1">
          <div className="text-2xl">{selectedConfig.icon}</div>
          <div>
            <h4 className="font-bold text-blue-900 dark:text-blue-300 text-sm mb-1">{selectedConfig.name}</h4>
            <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">{selectedConfig.desc}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveTypeSelector;
