
export interface LeaveRecord {
    id: string;
    user_id: string;
    start_date: string;
    end_date: string;
    status: string;
    days_count: number;
    reason: string;
    supervisor_id: string;
    created_at: string;
    employee_name?: string;
    employee_job_number?: string;
    employee_job_title?: string;
    employee_department?: string;
    employee_balance?: number;
    cut_status?: string;
    hr_cut_status?: string;
    is_archived?: boolean;
    cut_date?: string;
    supervisor: {
        full_name: string;
        job_title?: string;
        engineering_allowance?: number;
    } | null;
    unpaid_days?: number;
    cancellation_status?: string;
}

interface LeavePrintTemplateProps {
    printingRecord: LeaveRecord | null;
    directorateManager: { full_name: string, job_title: string } | null;
}

export function LeavePrintTemplate({ printingRecord, directorateManager }: LeavePrintTemplateProps) {
    if (!printingRecord) return null;

    return (
        <>
            <style>{`
                .print-only {
                    visibility: hidden;
                    position: absolute;
                    top: -9999px;
                    left: -9999px;
                    height: 0;
                    overflow: hidden;
                }
                @media print {
                    @page { size: A4 portrait; margin: 0; }
                    html, body {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        height: 100vh !important;
                        overflow: hidden !important;
                    }
                    body * { visibility: hidden !important; }
                    #print-section {
                        visibility: visible !important;
                        position: fixed !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 210mm !important;
                        height: auto !important;
                        background: white !important;
                        overflow: visible !important;
                        z-index: 9999 !important;
                    }
                    #print-section * { visibility: visible !important; }
                }
            `}</style>
            
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1, pointerEvents: 'none', background: 'white' }}>
                <div id="print-section" className="print-only" dir="rtl" style={{
                    width: '210mm',
                    minHeight: '297mm', /* Standard A4 height */
                    padding: '24mm 16mm 10mm 16mm',
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: 'white',
                    fontFamily: 'Arial, sans-serif',
                    color: '#000',
                }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8mm' }}>
                        <div style={{ textAlign: 'center', lineHeight: '1.6' }}>
                            <p style={{ fontWeight: 'bold', fontSize: '11pt', margin: '0 0 2px 0' }}>مديرية اتصالات ومعلوماتية</p>
                            <p style={{ fontWeight: '900', fontSize: '14pt', margin: '0 0 2px 0' }}>كربلاء المقدسة</p>
                            <p style={{ fontWeight: 'bold', fontSize: '9pt', margin: '0 0 2px 0' }}>نظام الإدارة الموحد</p>
                            <p style={{ fontSize: '8pt', margin: '4px 0 0 0' }}>طبعت : {new Date().toLocaleDateString('en-GB')}</p>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ border: '2px solid #166534', borderRadius: '50px', padding: '4px 14px', display: 'inline-block' }}>
                                <p style={{ color: '#166534', fontWeight: 'bold', fontSize: '10pt', margin: 0 }}>حاصل على موافقة المسؤول المباشر</p>
                            </div>
                            <p style={{ fontSize: '8pt', fontWeight: 'bold', margin: '4px 0 0 0' }}>{new Date(printingRecord.created_at).toLocaleDateString('en-GB')}</p>
                        </div>
                    </div>

                    {/* Title */}
                    <div style={{ textAlign: 'center', marginBottom: '7mm' }}>
                        <h1 style={{ fontSize: '15pt', fontWeight: '900', margin: 0, letterSpacing: '1px' }}>استمارة الاجازة الاعتيادية</h1>
                    </div>

                    {/* Body */}
                    <div style={{ fontSize: '15pt', fontWeight: 'bold', lineHeight: '2.5', paddingRight: '5mm', paddingLeft: '5mm' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <span>تمت الموافقة الالكترونية من المسؤول المخول بمنح إجازة اعتيادية لمدة</span>
                            <span style={{ marginRight: '8px', marginLeft: '8px', textAlign: 'center' }}>
                                ( {printingRecord.days_count} يوم )
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', marginTop: '12px' }}>
                            <span style={{ marginLeft: '8px', width: '130px' }}>من تأريخ :</span>
                            <span style={{ marginRight: '8px', textAlign: 'center' }}>
                                ( {printingRecord.start_date} )
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', marginTop: '20px' }}>
                            <span style={{ marginLeft: '8px', width: '130px' }}>لغرض</span>
                            <span style={{ marginRight: '8px', textAlign: 'center' }}>
                                {printingRecord.reason || '-'}
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', marginTop: '20px' }}>
                            <span style={{ marginLeft: '8px', width: '130px' }}>الرصيد المتبقي</span>
                            <span style={{ marginRight: '8px', textAlign: 'center' }}>
                                {printingRecord.employee_balance !== undefined ? printingRecord.employee_balance : 'غير مقروء'}
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', marginTop: '20px' }}>
                            <span style={{ marginLeft: '8px', width: '130px' }}>كود الطلب</span>
                            <span style={{ marginRight: '8px', textAlign: 'center', fontSize: '11pt', fontFamily: 'monospace' }}>
                                {printingRecord.id}
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', marginTop: '20px' }}>
                            <span style={{ marginLeft: '8px', width: '150px' }}>اسم صاحب الطلب :</span>
                            <span style={{ marginRight: '8px', textAlign: 'center' }}>
                                {printingRecord.employee_name}
                            </span>
                        </div>
                    </div>

                    {/* Spacer to push signatures up slightly so they don't get cut off by printer margins */}
                    <div style={{ height: '15mm', flexShrink: 0 }}></div>

                    {/* Signatures */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingRight: '15mm', paddingLeft: '15mm', textAlign: 'center' }}>
                        <div style={{ width: '40%' }}>
                            {printingRecord.supervisor?.engineering_allowance && printingRecord.supervisor.engineering_allowance > 0 && (
                                <p style={{ fontWeight: 'bold', fontSize: '13pt', margin: '0 0 4px 0' }}>المهندس</p>
                            )}
                            <p style={{ fontWeight: 'bold', fontSize: '13pt', margin: 0 }}>{printingRecord.supervisor?.full_name}</p>
                        </div>
                        <div style={{ width: '40%' }}>
                            <p style={{ fontWeight: 'bold', fontSize: '13pt', margin: '0 0 4px 0' }}>الدكتور</p>
                            <p style={{ fontWeight: 'bold', fontSize: '13pt', margin: 0 }}>{directorateManager?.full_name || 'علي عباس جاسم الصباغ'}</p>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
