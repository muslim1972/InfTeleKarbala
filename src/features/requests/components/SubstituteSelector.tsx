import React from 'react';
import { useAuth } from '../../../context/AuthContext';
import { EmployeeSearch } from '../../../components/shared/EmployeeSearch';
import { UserCheck, X } from 'lucide-react';
import { toast } from 'react-hot-toast';

export interface SubstituteEmployee {
  id: string;
  fullName: string;
  jobTitle?: string;
  departmentName?: string;
}

interface Props {
  selectedSubstitute: SubstituteEmployee | null;
  onSelect: (substitute: SubstituteEmployee | null) => void;
  required?: boolean;
  disabled?: boolean;
  label?: string;
  helpText?: string;
}

export const SubstituteSelector: React.FC<Props> = ({
  selectedSubstitute,
  onSelect,
  required = false,
  disabled = false,
  label = 'الموظف البديل المكلف بتغطية الواجب',
  helpText = 'اختر موظفاً من نفس المحافظة ليقوم بتغطية واجبك. سيتلقى إشعاراً فورياً للموافقة قبل توجيه الطلب للمسؤولين.'
}) => {
  const { user } = useAuth();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
          <UserCheck size={14} className="inline ml-1 text-indigo-600 dark:text-indigo-400" />
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        {selectedSubstitute && (
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
            تم تحديد البديل
          </span>
        )}
      </div>

      {helpText && (
        <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
          {helpText}
        </p>
      )}

      {/* بطاقة الموظف المختار */}
      {selectedSubstitute ? (
        <div className="flex items-center justify-between p-3.5 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-slate-800 dark:to-slate-800/80 border border-indigo-200 dark:border-indigo-800/60 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-indigo-600/20">
              {selectedSubstitute.fullName.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                {selectedSubstitute.fullName}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {selectedSubstitute.jobTitle || 'موظف'}
                {selectedSubstitute.departmentName && ` — ${selectedSubstitute.departmentName}`}
              </p>
            </div>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/50 text-gray-400 hover:text-red-600 rounded-lg transition-colors"
              title="تغيير الموظف البديل"
            >
              <X size={16} />
            </button>
          )}
        </div>
      ) : (
        /* استدعاء حقل البحث العالمي للموظفين في التطبيق */
        <div className="relative">
          <EmployeeSearch
            onSelect={(emp) => {
              if (emp.id === user?.id) {
                toast.error('لا يمكنك اختيار نفسك كموظف بديل');
                return;
              }
              onSelect({
                id: emp.id,
                fullName: emp.full_name || 'موظف',
                jobTitle: emp.job_title || emp.role || undefined,
                departmentName: emp.department_name || emp.departments?.name || undefined
              });
            }}
            placeholder="ابحث بالاسم أو الرقم الوظيفي لتحديد الموظف البديل..."
            disabled={disabled}
            clearOnSelect={true}
            portalClassName="z-[99999]"
            inputClassName="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-gray-800 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-500/30 outline-none transition-all placeholder:text-gray-400 placeholder:font-normal"
          />
        </div>
      )}
    </div>
  );
};
