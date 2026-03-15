
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/Card";
import { Label } from "../../ui/Label";
import { Input } from "../../ui/Input";
import { Button } from "../../ui/Button";
import { DepartmentSelector } from "../DepartmentSelector";
import { cn } from "../../../lib/utils";

interface TabAddEmployeeProps {
    formData: any;
    setFormData: (data: any) => void;
    isRoleEditable: boolean;
    theme: 'light' | 'dark';
}

export const TabAddEmployee = ({
    formData,
    setFormData,
    isRoleEditable,
    theme
}: TabAddEmployeeProps) => {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full px-2 md:container md:mx-auto max-w-2xl">
            <Card className="w-full">
                <CardHeader>
                    <CardTitle>إضافة موظف جديد</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Row 1: Full Name */}
                    <div className="grid gap-2">
                        <Label htmlFor="full_name">الاسم الكامل</Label>
                        <Input
                            id="full_name"
                            type="text"
                            value={formData.full_name}
                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                            placeholder="الاسم الرباعي واللقب"
                        />
                    </div>

                    {/* Department / Position Tree Node */}
                    <DepartmentSelector
                        value={formData.department_id}
                        onChange={(val: string | null) => setFormData({ ...formData, department_id: val })}
                        theme={theme}
                    />

                    {/* Row 2: Account Type */}
                    <div className="grid gap-2">
                        <Label>نوع الحساب</Label>
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
                                <Label>صلاحية المشرف</Label>
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
                                        ذاتية
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
                    </div>

                    {/* Row 3: Job Number */}
                    <div className="grid gap-2">
                        <Label htmlFor="job_number">الرقم الوظيفي الموحد</Label>
                        <div className="relative">
                            <Input
                                id="job_number"
                                type="text"
                                value={formData.job_number}
                                onChange={(e) => setFormData({ ...formData, job_number: e.target.value })}
                                placeholder="123456"
                                className="font-mono text-left"
                                dir="ltr"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-mono pointer-events-none">#</div>
                        </div>
                    </div>

                    {/* Row 4: IBAN */}
                    <div className="grid gap-2">
                        <Label htmlFor="iban">رمز ( IBAN )</Label>
                        <Input
                            id="iban"
                            type="text"
                            value={formData.iban}
                            onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                            placeholder="IQ..."
                            className="font-mono text-left"
                            dir="ltr"
                        />
                    </div>

                    {/* Row 5: Username */}
                    <div className="grid gap-2">
                        <Label htmlFor="username">اسم المستخدم المؤقت</Label>
                        <Input
                            id="username"
                            type="text"
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            placeholder="username"
                            className="font-mono text-left"
                            dir="ltr"
                            autoComplete="off"
                        />
                    </div>

                    {/* Row 6: Password */}
                    <div className="grid gap-2">
                        <Label htmlFor="password">كلمة المرور المؤقتة</Label>
                        <Input
                            id="password"
                            type="text"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            placeholder="password"
                            className="font-mono text-left"
                            dir="ltr"
                            autoComplete="off"
                        />
                    </div>

                </CardContent>
            </Card>
        </div>
    );
};
