
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/Card";
import { Label } from "../../ui/Label";
import { Input } from "../../ui/Input";
import { Button } from "../../ui/Button";
import { DepartmentSelector } from "../DepartmentSelector";
import { cn } from "../../../lib/utils";
import { Loader2, UserPlus, AlertCircle, Info } from "lucide-react";

interface TabAddEmployeeProps {
    formData: any;
    setFormData: (data: any) => void;
    isRoleEditable: boolean;
    theme: 'light' | 'dark';
    handleSaveEmployee?: (e: any) => Promise<void>;
    loading?: boolean;
}

export const TabAddEmployee = ({
    formData,
    setFormData,
    isRoleEditable,
    theme,
    handleSaveEmployee,
    loading = false
}: TabAddEmployeeProps) => {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full px-2 md:container md:mx-auto max-w-2xl">
            <Card className="w-full border shadow-sm">
                <CardHeader className="pb-3 border-b border-border/50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                <UserPlus className="w-5 h-5" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">إضافة موظف جديد</CardTitle>
                                <p className="text-xs text-muted-foreground mt-0.5">فتح قيد وظيفي وإنشاء حساب دخول أمني للموظف</p>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-5 pt-4">
                    {/* Notice bar */}
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 text-blue-800 dark:text-blue-300 text-xs">
                        <Info className="w-4 h-4 flex-shrink-0" />
                        <span>الحقول المؤشرة بعلامة (<span className="text-red-500 font-bold">*</span>) إلزامية لفتح القيد. يرجى إدخال اسم المستخدم وكلمة المرور بدقة.</span>
                    </div>

                    {/* Row 1: Full Name */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-2 md:col-span-2">
                            <Label htmlFor="full_name" className="flex items-center gap-1 font-semibold">
                                الاسم الكامل
                                <span className="text-red-500 font-bold">*</span>
                            </Label>
                            <Input
                                id="full_name"
                                type="text"
                                value={formData.full_name}
                                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                placeholder="الاسم الرباعي واللقب"
                                className={cn(!formData.full_name && "border-amber-300 dark:border-amber-700/50")}
                            />
                        </div>
                        
                        <div className="grid gap-2">
                            <Label htmlFor="gender" className="flex items-center gap-1 font-semibold">
                                الجنس
                                <span className="text-red-500 font-bold">*</span>
                            </Label>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant={formData.gender === 'male' ? 'default' : 'outline'}
                                    onClick={() => setFormData({ ...formData, gender: 'male' })}
                                    className="flex-1 text-xs"
                                >
                                    ذكر
                                </Button>
                                <Button
                                    type="button"
                                    variant={formData.gender === 'female' ? 'default' : 'outline'}
                                    onClick={() => setFormData({ ...formData, gender: 'female' })}
                                    className="flex-1 text-xs"
                                >
                                    أنثى
                                </Button>
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="birth_date" className="flex items-center gap-1 font-semibold">
                                تاريخ الميلاد
                                <span className="text-muted-foreground text-xs font-normal">(اختياري)</span>
                            </Label>
                            <Input
                                id="birth_date"
                                type="date"
                                value={formData.birth_date || ""}
                                onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                                className="text-left font-mono"
                                dir="ltr"
                            />
                        </div>
                    </div>

                    {/* Department / Position Tree Node */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <Label className="flex items-center gap-1 font-semibold">
                                المرجع / التشكيل الإداري
                                <span className="text-red-500 font-bold">*</span>
                            </Label>
                            {!formData.department_id && (
                                <span className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                                    <AlertCircle className="w-3 h-3" />
                                    مطلوب اختيار القسم
                                </span>
                            )}
                        </div>
                        <DepartmentSelector
                            value={formData.department_id}
                            onChange={(val: string | null, dept?: any, parentDept?: any) => {
                                const updates: any = { department_id: val };
                                if (dept) {
                                    if (dept.level === 1 || dept.level === 2) {
                                        updates.dept_text = dept.name;
                                        updates.section_text = '';
                                        updates.unit_text = '';
                                    } else if (dept.level === 4) {
                                        updates.section_text = dept.name;
                                        if (parentDept) updates.dept_text = parentDept.name;
                                    } else if (dept.level === 3) {
                                        updates.dept_text = dept.name;
                                        updates.section_text = '';
                                    } else if (dept.level === 5) {
                                        updates.unit_text = dept.name;
                                        if (parentDept) updates.section_text = parentDept.name;
                                    }
                                }
                                setFormData((prev: any) => ({ ...prev, ...updates }));
                            }}
                            theme={theme}
                        />
                    </div>

                    {/* Row 2: Account Type */}
                    <div className="grid gap-2">
                        <Label className="font-semibold">نوع الحساب</Label>
                        <div className="grid grid-cols-2 gap-4">
                            <Button
                                type="button"
                                variant={formData.role === 'user' ? 'default' : 'outline'}
                                onClick={() => setFormData({ ...formData, role: 'user' })}
                                className="w-full gap-2"
                                disabled={!isRoleEditable}
                            >
                                <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center", formData.role === 'user' ? "border-white" : "border-muted-foreground")}>
                                    {formData.role === 'user' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                </div>
                                موظف
                            </Button>
                            <Button
                                type="button"
                                variant={formData.role === 'admin' ? 'default' : 'outline'}
                                onClick={() => setFormData({ ...formData, role: 'admin' })}
                                className="w-full gap-2"
                                disabled={!isRoleEditable}
                            >
                                <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center", formData.role === 'admin' ? "border-white" : "border-muted-foreground")}>
                                    {formData.role === 'admin' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                </div>
                                مشرف
                            </Button>
                        </div>

                        {/* Row 2.5: Admin Role (Visible only if role is admin and user has permission) */}
                        {formData.role === 'admin' && isRoleEditable && (
                            <div className="grid gap-2 animate-in fade-in slide-in-from-top-2 duration-300 col-span-1 md:col-span-2">
                                <Label className="font-semibold">صلاحية المشرف</Label>
                                <div className="flex flex-wrap gap-3">
                                    <Button
                                        type="button"
                                        variant={formData.admin_role === 'developer' ? 'default' : 'outline'}
                                        onClick={() => setFormData({ ...formData, admin_role: 'developer' })}
                                        className="flex-1 min-w-[140px] gap-2"
                                    >
                                        <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center", formData.admin_role === 'developer' ? "border-white" : "border-muted-foreground")}>
                                            {formData.admin_role === 'developer' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                        </div>
                                        مطور (كامل)
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={formData.admin_role === 'it_supervisor' ? 'default' : 'outline'}
                                        onClick={() => setFormData({ ...formData, admin_role: 'it_supervisor' })}
                                        className="flex-1 min-w-[140px] gap-2"
                                    >
                                        <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center", formData.admin_role === 'it_supervisor' ? "border-white" : "border-muted-foreground")}>
                                            {formData.admin_role === 'it_supervisor' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                        </div>
                                        مشرف IT (كامل)
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={formData.admin_role === 'finance' ? 'default' : 'outline'}
                                        onClick={() => setFormData({ ...formData, admin_role: 'finance' })}
                                        className="flex-1 min-w-[140px] gap-2"
                                    >
                                        <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center", formData.admin_role === 'finance' ? "border-white" : "border-muted-foreground")}>
                                            {formData.admin_role === 'finance' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                        </div>
                                        مالية
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={formData.admin_role === 'hr' ? 'default' : 'outline'}
                                        onClick={() => setFormData({ ...formData, admin_role: 'hr' })}
                                        className="flex-1 min-w-[140px] gap-2"
                                    >
                                        <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center", formData.admin_role === 'hr' ? "border-white" : "border-muted-foreground")}>
                                            {formData.admin_role === 'hr' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                        </div>
                                        الموارد البشرية
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={formData.admin_role === 'media' ? 'default' : 'outline'}
                                        onClick={() => setFormData({ ...formData, admin_role: 'media' })}
                                        className="flex-1 min-w-[140px] gap-2"
                                    >
                                        <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center", formData.admin_role === 'media' ? "border-white" : "border-muted-foreground")}>
                                            {formData.admin_role === 'media' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                        </div>
                                        إعلام
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={formData.admin_role === 'biometric' ? 'default' : 'outline'}
                                        onClick={() => setFormData({ ...formData, admin_role: 'biometric' })}
                                        className="flex-1 min-w-[140px] gap-2"
                                    >
                                        <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center", formData.admin_role === 'biometric' ? "border-white" : "border-muted-foreground")}>
                                            {formData.admin_role === 'biometric' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                        </div>
                                        مشرف بصمة
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={formData.admin_role === 'general' ? 'default' : 'outline'}
                                        onClick={() => setFormData({ ...formData, admin_role: 'general' })}
                                        className="flex-1 min-w-[140px] gap-2"
                                    >
                                        <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center", formData.admin_role === 'general' ? "border-white" : "border-muted-foreground")}>
                                            {formData.admin_role === 'general' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                        </div>
                                        عام
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Separate Additional Access Permissions */}
                        {isRoleEditable && (
                            <div className="grid gap-2 animate-in fade-in slide-in-from-top-2 duration-300 col-span-1 md:col-span-2">
                                <Label className="font-semibold">صلاحيات وصول إضافية</Label>
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        type="button"
                                        variant={formData.has_capacities_access ? 'default' : 'outline'}
                                        onClick={() => setFormData({ ...formData, has_capacities_access: !formData.has_capacities_access })}
                                        className={cn("flex-1 sm:flex-none min-w-[140px] gap-2", formData.has_capacities_access ? 'bg-purple-600 hover:bg-purple-700 text-white' : '')}
                                    >
                                        <div className={cn("w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors", formData.has_capacities_access ? "border-white bg-white/20" : "border-muted-foreground")} >
                                            {formData.has_capacities_access && (
                                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </div>
                                        السعات
                                    </Button>

                                    <Button
                                        type="button"
                                        variant={formData.has_attendance_access ? 'default' : 'outline'}
                                        onClick={() => setFormData({ ...formData, has_attendance_access: !formData.has_attendance_access })}
                                        className={cn("flex-1 sm:flex-none min-w-[140px] gap-2", formData.has_attendance_access ? 'bg-cyan-600 hover:bg-cyan-700 text-white' : '')}
                                    >
                                        <div className={cn("w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors", formData.has_attendance_access ? "border-white bg-white/20" : "border-muted-foreground")} >
                                            {formData.has_attendance_access && (
                                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </div>
                                        الحضور والانصراف
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Row 3: Job Number */}
                    <div className="grid gap-2">
                        <Label htmlFor="job_number" className="flex items-center gap-1 font-semibold">
                            الرقم الوظيفي الموحد
                            <span className="text-red-500 font-bold">*</span>
                        </Label>
                        <div className="relative">
                            <Input
                                id="job_number"
                                type="text"
                                inputMode="numeric"
                                value={formData.job_number}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, ''); // أرقام فقط
                                    setFormData({ ...formData, job_number: val });
                                }}
                                placeholder="مثال: 103523"
                                className={cn("font-mono text-left", !formData.job_number && "border-amber-300 dark:border-amber-700/50")}
                                dir="ltr"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-mono pointer-events-none">#</div>
                        </div>
                    </div>

                    {/* Row 5: Username */}
                    <div className="grid gap-2">
                        <Label htmlFor="username" className="flex items-center gap-1 font-semibold">
                            اسم المستخدم المؤقت
                            <span className="text-red-500 font-bold">*</span>
                        </Label>
                        <Input
                            id="username"
                            type="text"
                            value={formData.username}
                            onChange={(e) => {
                                const val = e.target.value.replace(/\s/g, ''); // منع المسافات
                                setFormData({ ...formData, username: val });
                            }}
                            placeholder="مثال: صابرين أو sabreen"
                            className={cn("font-mono text-left", !formData.username && "border-amber-300 dark:border-amber-700/50")}
                            dir="ltr"
                            autoComplete="off"
                        />
                    </div>

                    {/* Row 6: Password */}
                    <div className="grid gap-2">
                        <Label htmlFor="password" className="flex items-center gap-1 font-semibold">
                            كلمة المرور المؤقتة (6 خانات كحد أدنى)
                            <span className="text-red-500 font-bold">*</span>
                        </Label>
                        <Input
                            id="password"
                            type="text"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            placeholder="مثال: 103523 أو كلمة سر مخصصة"
                            className={cn("font-mono text-left", (!formData.password || formData.password.length < 6) && "border-amber-300 dark:border-amber-700/50")}
                            dir="ltr"
                            autoComplete="off"
                        />
                    </div>

                    {/* Bottom Save Action Button */}
                    {handleSaveEmployee && (
                        <div className="pt-3 border-t border-border/50">
                            <Button
                                type="button"
                                onClick={handleSaveEmployee}
                                disabled={loading}
                                className="w-full py-3 bg-brand-green hover:bg-brand-green/90 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-brand-green/20 disabled:opacity-50 transition-all cursor-pointer"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>جارٍ حفظ وتكوين القيد...</span>
                                    </>
                                ) : (
                                    <>
                                        <UserPlus className="w-4 h-4" />
                                        <span>حفظ وإضافة الموظف</span>
                                    </>
                                )}
                            </Button>
                        </div>
                    )}

                </CardContent>
            </Card>
        </div>
    );
};
