import fs from 'fs';

let c = fs.readFileSync('src/hooks/useEmployeeManager.ts', 'utf8');

const target = `                    unit_text: cleanText(selectedEmployee.unit_text),
                    updated_at: new Date().toISOString(),`;

const repl = `                    unit_text: cleanText(selectedEmployee.unit_text),
                    mother_name: selectedEmployee.mother_name,
                    phone_number: selectedEmployee.phone_number,
                    general_specialization: selectedEmployee.general_specialization,
                    position_title: selectedEmployee.position_title,
                    reinstatement_date: selectedEmployee.reinstatement_date,
                    leave_date: selectedEmployee.leave_date,
                    reinstatement_type: selectedEmployee.reinstatement_type,
                    updated_at: new Date().toISOString(),`;

const isCrlf = c.includes('\r\n');
const targetStr = isCrlf ? target.replace(/\n/g, '\r\n').replace(/\r\r\n/g, '\r\n') : target.replace(/\r\n/g, '\n');
const replStr = isCrlf ? repl.replace(/\n/g, '\r\n').replace(/\r\r\n/g, '\r\n') : repl.replace(/\r\n/g, '\n');

if (!c.includes(targetStr)) {
    console.error('target not found in useEmployeeManager.ts');
    process.exit(1);
}

c = c.replace(targetStr, replStr);
fs.writeFileSync('src/hooks/useEmployeeManager.ts', c, 'utf8');
console.log('useEmployeeManager.ts updated successfully');
