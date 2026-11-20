import fs from 'fs';

const filePath = 'd:/InfTeleKarbala/src/hooks/useEmployeeManager.ts';
let code = fs.readFileSync(filePath, 'utf-8');

// 1. Update allowances options for transport_allowance
const oldTransportLine = "{ key: 'transport_allowance', label: 'م. النقل', isMoney: true, options: ['20000', '30000'] },";
const newTransportLine = `{ 
                key: 'transport_allowance', 
                label: 'م. النقل', 
                isMoney: true, 
                options: [
                    { value: '0', label: 'بلا' },
                    { value: '20000', label: '20000' },
                    { value: '30000', label: '30000' },
                    { value: '40000', label: '40000' },
                    { value: '50000', label: '50000' },
                    { value: '60000', label: '60000' }
                ] 
            },`;

if (code.includes(oldTransportLine)) {
    code = code.replace(oldTransportLine, newTransportLine);
    console.log('Updated transport_allowance options');
} else {
    console.error('Could not find oldTransportLine');
    process.exit(1);
}

// 2. In handleFinancialChange, ensure transport_allowance is parsed as number
const searchChange = "if (key === 'risk_percentage' || key === 'nominal_salary') {";
const addTransportChange = `if (key === 'transport_allowance') {
            newData.transport_allowance = Number(value) || 0;
        }

        if (key === 'risk_percentage' || key === 'nominal_salary') {`;

if (code.includes(searchChange)) {
    code = code.replace(searchChange, addTransportChange);
    console.log('Updated handleFinancialChange for transport_allowance');
} else {
    console.error('Could not find searchChange');
    process.exit(1);
}

fs.writeFileSync(filePath, code, 'utf-8');
console.log('Successfully patched useEmployeeManager.ts');
