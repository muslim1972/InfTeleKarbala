import React, { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import type { LeaveType } from './LeaveTypeSelector';

interface LeavePayToggleProps {
  leaveType: LeaveType;
  withPay: boolean;
  onToggle: (withPay: boolean) => void;
  balance: number | undefined;
  daysCount: number;
}

export const LeavePayToggle: React.FC<LeavePayToggleProps> = ({
  leaveType,
  withPay,
  onToggle,
  balance,
  daysCount,
}) => {
  // Hide for specific leave types that do not affect balances
  if (['dispatch', 'duty', 'time_off'].includes(leaveType)) {
    return null;
  }

  const isZeroBalance = balance === 0 || balance === undefined;
  const isInsufficientBalance = !isZeroBalance && balance < daysCount;

  // If balance is 0 or undefined, force "without pay" and disable toggle
  useEffect(() => {
    if (isZeroBalance && withPay) {
      onToggle(false);
    }
  }, [isZeroBalance, withPay, onToggle]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            نوع الإجازة من حيث الراتب
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {withPay ? 'إجازة براتب' : 'إجازة بدون راتب'}
          </span>
        </div>

        <button
          type="button"
          disabled={isZeroBalance}
          onClick={() => onToggle(!withPay)}
          className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
            isZeroBalance
              ? 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
              : withPay
              ? 'bg-green-500 hover:bg-green-600 focus-visible:ring-green-500 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900'
              : 'bg-orange-500 hover:bg-orange-600 focus-visible:ring-orange-500 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900'
          }`}
          role="switch"
          aria-checked={withPay}
        >
          <span className="sr-only">استخدم الراتب</span>
          <span
            aria-hidden="true"
            className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              withPay ? '-translate-x-7 rtl:-translate-x-7 ltr:translate-x-7' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {isZeroBalance && (
        <div className="flex items-start p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm border border-red-100 dark:border-red-900/30">
          <AlertCircle className="w-5 h-5 ml-2 flex-shrink-0" />
          <p>⚠️ رصيدك صفر، سيتم احتساب إجازتك بدون راتب</p>
        </div>
      )}

      {isInsufficientBalance && (
        <div className="flex items-start p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-lg text-sm border border-amber-100 dark:border-amber-900/30">
          <AlertCircle className="w-5 h-5 ml-2 flex-shrink-0" />
          <p>
            ⚠️ رصيدك غير كافي ({balance} يوم فقط)، سيتم احتساب ({daysCount - balance}) أيام بدون راتب
          </p>
        </div>
      )}
    </div>
  );
};
