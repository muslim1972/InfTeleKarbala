import fs from 'fs';

let c = fs.readFileSync('src/components/admin/dashboard/TabManageEmployees.tsx', 'utf8');

const target1 = `                            <EditableField
                                label="الرقم الوظيفي"
                                value={selectedEmployee.job_number}
                                onChange={(val: string) => setSelectedEmployee({ ...selectedEmployee, job_number: val })}
                                recordId={selectedEmployee.id}
                                tableName="profiles"
                                dbField="job_number"
                                isReadOnly={isFieldReadOnly('job_number')}
                                className="font-mono text-left"
                            />`;

const repl1 = `                            <EditableField
                                label="الرقم الوظيفي"
                                value={selectedEmployee.job_number}
                                onChange={(val: string) => setSelectedEmployee({ ...selectedEmployee, job_number: val })}
                                recordId={selectedEmployee.id}
                                tableName="profiles"
                                dbField="job_number"
                                isReadOnly={isFieldReadOnly('job_number')}
                                className="font-mono text-left"
                            />

                            <EditableField
                                label="اسم الأم"
                                value={selectedEmployee.mother_name}
                                onChange={(val: string) => setSelectedEmployee({ ...selectedEmployee, mother_name: val })}
                                recordId={selectedEmployee.id}
                                tableName="profiles"
                                dbField="mother_name"
                                isReadOnly={isFieldReadOnly('mother_name')}
                            />

                            <EditableField
                                label="رقم الهاتف"
                                value={selectedEmployee.phone_number}
                                onChange={(val: string) => setSelectedEmployee({ ...selectedEmployee, phone_number: val })}
                                recordId={selectedEmployee.id}
                                tableName="profiles"
                                dbField="phone_number"
                                isReadOnly={isFieldReadOnly('phone_number')}
                                className="font-mono text-left"
                            />`;

const target2 = `                            {/* New Profile Fields */}
                            <div className="grid grid-cols-1 gap-4 mt-4">
                                <EditableField
                                    label="التخصص (PROF)"`;

const repl2 = `                            {/* New Profile Fields */}
                            <div className="grid grid-cols-1 gap-4 mt-4">
                                <EditableField
                                    label="المنصب الإداري"
                                    value={selectedEmployee.position_title}
                                    onChange={(val: string) => setSelectedEmployee({ ...selectedEmployee, position_title: val })}
                                    recordId={selectedEmployee.id}
                                    tableName="profiles"
                                    dbField="position_title"
                                    isReadOnly={isFieldReadOnly('position_title')}
                                />
                                <EditableField
                                    label="الاختصاص العام"
                                    value={selectedEmployee.general_specialization}
                                    onChange={(val: string) => setSelectedEmployee({ ...selectedEmployee, general_specialization: val })}
                                    recordId={selectedEmployee.id}
                                    tableName="profiles"
                                    dbField="general_specialization"
                                    isReadOnly={isFieldReadOnly('general_specialization')}
                                />
                                <EditableField
                                    label="التخصص (PROF)"`;

const target3 = `                                <EditableField
                                    label="الوحدة"
                                    value={cleanText(selectedEmployee.unit_text)}
                                    onChange={(val: string) => setSelectedEmployee({ ...selectedEmployee, unit_text: val })}
                                    recordId={selectedEmployee.id}
                                    tableName="profiles"
                                    dbField="unit_text"
                                    isReadOnly={isFieldReadOnly('unit_text')}
                                />
                            </div>`;

const repl3 = `                                <EditableField
                                    label="الوحدة"
                                    value={cleanText(selectedEmployee.unit_text)}
                                    onChange={(val: string) => setSelectedEmployee({ ...selectedEmployee, unit_text: val })}
                                    recordId={selectedEmployee.id}
                                    tableName="profiles"
                                    dbField="unit_text"
                                    isReadOnly={isFieldReadOnly('unit_text')}
                                />
                                <EditableField
                                    label="تاريخ الترك"
                                    value={selectedEmployee.leave_date}
                                    onChange={(val: string) => setSelectedEmployee({ ...selectedEmployee, leave_date: val })}
                                    recordId={selectedEmployee.id}
                                    tableName="profiles"
                                    dbField="leave_date"
                                    isReadOnly={isFieldReadOnly('leave_date')}
                                />
                                <EditableField
                                    label="تاريخ الإعادة"
                                    value={selectedEmployee.reinstatement_date}
                                    onChange={(val: string) => setSelectedEmployee({ ...selectedEmployee, reinstatement_date: val })}
                                    recordId={selectedEmployee.id}
                                    tableName="profiles"
                                    dbField="reinstatement_date"
                                    isReadOnly={isFieldReadOnly('reinstatement_date')}
                                />
                                <EditableField
                                    label="نوع الإعادة"
                                    value={selectedEmployee.reinstatement_type}
                                    onChange={(val: string) => setSelectedEmployee({ ...selectedEmployee, reinstatement_type: val })}
                                    recordId={selectedEmployee.id}
                                    tableName="profiles"
                                    dbField="reinstatement_type"
                                    isReadOnly={isFieldReadOnly('reinstatement_type')}
                                />
                            </div>`;

const isCrlf = c.includes('\r\n');
const toLines = (s) => isCrlf ? s.replace(/\n/g, '\r\n').replace(/\r\r\n/g, '\r\n') : s.replace(/\r\n/g, '\n');

if (!c.includes(toLines(target1))) {
    console.error('target1 not found');
    process.exit(1);
}
c = c.replace(toLines(target1), toLines(repl1));

if (!c.includes(toLines(target2))) {
    console.error('target2 not found');
    process.exit(1);
}
c = c.replace(toLines(target2), toLines(repl2));

if (!c.includes(toLines(target3))) {
    console.error('target3 not found');
    process.exit(1);
}
c = c.replace(toLines(target3), toLines(repl3));

fs.writeFileSync('src/components/admin/dashboard/TabManageEmployees.tsx', c, 'utf8');
console.log('TabManageEmployees.tsx updated successfully');
