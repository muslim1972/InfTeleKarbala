import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Upload, Loader2, CheckCircle, FileText, Calendar, Hash, Image as ImageIcon } from 'lucide-react';
import type { LeaveRecord } from './AdminLeaveRequests';

interface HRDocumentProcessingPanelProps {
  record: LeaveRecord;
  onClose: () => void;
  onSuccess: () => void;
  currentUser: { id: string, full_name: string } | null;
}

export function HRDocumentProcessingPanel({ record, onClose, onSuccess, currentUser }: HRDocumentProcessingPanelProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    admin_order_number: record.admin_order_number || '',
    admin_order_date: record.admin_order_date || '',
    admin_order_image_url: record.admin_order_image_url || '',
    
    clearance_letter_number: record.clearance_letter_number || '',
    clearance_letter_date: record.clearance_letter_date || '',
    clearance_letter_image_url: record.clearance_letter_image_url || '',
    
    hospital_referral_letter_number: record.hospital_referral_letter_number || '',
    hospital_referral_letter_date: record.hospital_referral_letter_date || '',
    hospital_referral_letter_image_url: record.hospital_referral_letter_image_url || '',
    
    hospital_response_letter_number: record.hospital_response_letter_number || '',
    hospital_response_letter_date: record.hospital_response_letter_date || '',
    hospital_response_letter_image_url: record.hospital_response_letter_image_url || '',
    hospital_response_letter_days: record.hospital_response_letter_days?.toString() || '',
    
    dispatch_order_number: record.dispatch_order_number || '',
    dispatch_order_date: record.dispatch_order_date || '',
    dispatch_order_image_url: record.dispatch_order_image_url || '',
    
    dispatch_end_letter_number: record.dispatch_end_letter_number || '',
    dispatch_end_letter_date: record.dispatch_end_letter_date || '',
    dispatch_end_letter_image_url: record.dispatch_end_letter_image_url || '',
    dispatch_end_letter_days: record.dispatch_end_letter_days?.toString() || '',
    
    duty_paper_image_url: record.duty_paper_image_url || '',
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: keyof typeof formData) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    try {
      setIsSubmitting(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${record.id}_${fieldName}_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('order-image')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('order-image')
        .getPublicUrl(fileName);

      setFormData(prev => ({ ...prev, [fieldName]: publicUrlData.publicUrl }));
    } catch (err: any) {
      console.error('Upload error:', err);
      setError('فشل رفع الملف: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const updatePayload: any = {
        hr_status: 'completed',
        hr_assigned_to: currentUser.id,
        hr_completed_at: new Date().toISOString(),
      };

      // Only include relevant fields based on leave type
      if (['long_regular', 'long_sick'].includes(record.leave_type)) {
        updatePayload.admin_order_number = formData.admin_order_number;
        updatePayload.admin_order_date = formData.admin_order_date;
        updatePayload.admin_order_image_url = formData.admin_order_image_url;
        updatePayload.clearance_letter_number = formData.clearance_letter_number;
        updatePayload.clearance_letter_date = formData.clearance_letter_date;
        updatePayload.clearance_letter_image_url = formData.clearance_letter_image_url;
      }

      if (['sick', 'long_sick'].includes(record.leave_type)) {
        updatePayload.hospital_referral_letter_number = formData.hospital_referral_letter_number;
        updatePayload.hospital_referral_letter_date = formData.hospital_referral_letter_date;
        updatePayload.hospital_referral_letter_image_url = formData.hospital_referral_letter_image_url;
        updatePayload.hospital_response_letter_number = formData.hospital_response_letter_number;
        updatePayload.hospital_response_letter_date = formData.hospital_response_letter_date;
        updatePayload.hospital_response_letter_image_url = formData.hospital_response_letter_image_url;
        updatePayload.hospital_response_letter_days = parseInt(formData.hospital_response_letter_days) || null;
      }

      if (record.leave_type === 'dispatch') {
        updatePayload.dispatch_order_number = formData.dispatch_order_number;
        updatePayload.dispatch_order_date = formData.dispatch_order_date;
        updatePayload.dispatch_order_image_url = formData.dispatch_order_image_url;
        updatePayload.dispatch_end_letter_number = formData.dispatch_end_letter_number;
        updatePayload.dispatch_end_letter_date = formData.dispatch_end_letter_date;
        updatePayload.dispatch_end_letter_image_url = formData.dispatch_end_letter_image_url;
        updatePayload.dispatch_end_letter_days = parseInt(formData.dispatch_end_letter_days) || null;
      }

      if (record.leave_type === 'duty') {
        updatePayload.duty_paper_image_url = formData.duty_paper_image_url;
      }

      const { error: updateError } = await supabase
        .from('leave_requests')
        .update(updatePayload)
        .eq('id', record.id);

      if (updateError) throw updateError;
      
      onSuccess();
    } catch (err: any) {
      console.error('Update error:', err);
      setError(err.message || 'حدث خطأ أثناء حفظ المستندات');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderDocumentSection = (
    title: string, 
    prefix: 'admin_order' | 'clearance_letter' | 'hospital_referral_letter' | 'hospital_response_letter' | 'dispatch_order' | 'dispatch_end_letter', 
    includeDays: boolean = false
  ) => {
    return (
      <div className="bg-gray-50 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-200 dark:border-slate-700 space-y-4">
        <h4 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <FileText size={18} className="text-blue-500" />
          {title}
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
              <Hash size={14} /> رقم الكتاب / الأمر
            </label>
            <input
              type="text"
              required
              value={formData[`${prefix}_number`]}
              onChange={(e) => setFormData(prev => ({ ...prev, [`${prefix}_number`]: e.target.value }))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
              <Calendar size={14} /> تاريخ الإصدار
            </label>
            <input
              type="date"
              required
              value={formData[`${prefix}_date`]}
              onChange={(e) => setFormData(prev => ({ ...prev, [`${prefix}_date`]: e.target.value }))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          {includeDays && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                <Calendar size={14} /> عدد الأيام الممنوحة/الفعلية
              </label>
              <input
                type="number"
                min="1"
                required
                value={formData[`${prefix}_days` as keyof typeof formData]}
                onChange={(e) => setFormData(prev => ({ ...prev, [`${prefix}_days`]: e.target.value }))}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          )}
        </div>
        
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
            <ImageIcon size={14} /> صورة المستند (اختياري)
          </label>
          <div className="flex items-center gap-3">
            <label className="cursor-pointer bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-slate-700 transition flex items-center gap-2">
              <Upload size={16} /> اختيار ملف
              <input 
                type="file" 
                accept="image/*,application/pdf"
                className="hidden" 
                onChange={(e) => handleFileUpload(e, `${prefix}_image_url`)}
                disabled={isSubmitting}
              />
            </label>
            {formData[`${prefix}_image_url`] && (
              <a href={formData[`${prefix}_image_url`]} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline">
                معاينة الملف المرفوع
              </a>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 my-8 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-slate-700 shrink-0">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <CheckCircle className="text-blue-500" />
              إكمال مستندات الإجازة
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              الموظف: {record.employee_name} | النوع: {record.leave_type}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 bg-gray-100 dark:bg-slate-700 rounded-full hover:bg-gray-200 dark:hover:bg-slate-600 transition"
          >
            <X size={20} className="text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          <form id="hr-docs-form" onSubmit={handleSubmit} className="space-y-6">
            
            {['long_regular', 'long_sick'].includes(record.leave_type) && (
              <>
                {renderDocumentSection('الأمر الإداري', 'admin_order')}
                {renderDocumentSection('براءة الذمة', 'clearance_letter')}
              </>
            )}

            {['sick', 'long_sick'].includes(record.leave_type) && (
              <>
                {renderDocumentSection('كتاب الإرسال للمستشفى', 'hospital_referral_letter')}
                {renderDocumentSection('كتاب المستشفى (القرار الطبي)', 'hospital_response_letter', true)}
              </>
            )}

            {record.leave_type === 'dispatch' && (
              <>
                {renderDocumentSection('أمر الإيفاد', 'dispatch_order')}
                {renderDocumentSection('كتاب إنهاء الإيفاد', 'dispatch_end_letter', true)}
              </>
            )}

            {record.leave_type === 'duty' && (
              <div className="bg-gray-50 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                <h4 className="font-bold text-gray-800 dark:text-white flex items-center gap-2 mb-4">
                  <FileText size={18} className="text-blue-500" />
                  ورقة الواجب
                </h4>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                  <ImageIcon size={14} /> صورة ورقة الواجب المختومة
                </label>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-slate-700 transition flex items-center gap-2">
                    <Upload size={16} /> اختيار ملف
                    <input 
                      type="file" 
                      accept="image/*,application/pdf"
                      className="hidden" 
                      required={!formData.duty_paper_image_url}
                      onChange={(e) => handleFileUpload(e, 'duty_paper_image_url')}
                      disabled={isSubmitting}
                    />
                  </label>
                  {formData.duty_paper_image_url && (
                    <a href={formData.duty_paper_image_url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline">
                      معاينة الملف المرفوع
                    </a>
                  )}
                </div>
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm border border-red-200 dark:border-red-800">
                {error}
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition"
          >
            إلغاء
          </button>
          <button
            type="submit"
            form="hr-docs-form"
            disabled={isSubmitting}
            className="px-8 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition shadow-lg shadow-blue-500/30 flex items-center gap-2"
          >
            {isSubmitting ? (
              <><Loader2 size={18} className="animate-spin" /> جاري الحفظ...</>
            ) : (
              <><CheckCircle size={18} /> حفظ واكتمال</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
