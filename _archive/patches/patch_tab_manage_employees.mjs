import fs from 'fs';

const filePath = 'd:/InfTeleKarbala/src/components/admin/dashboard/TabManageEmployees.tsx';
let code = fs.readFileSync(filePath, 'utf-8');

const oldSnippet = `                    {field.options ? (() => {
                        const allOptions = (value && !field.options.includes(String(value)))
                            ? [String(value), ...field.options]
                            : field.options;
                        return (
                            <Select
                                value={value?.toString() || ""}
                                onValueChange={(val) => onChange(field.key, val)}
                                disabled={field.disabled || isReadOnly}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="اختر..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {allOptions.map((opt: string) => (
                                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        );
                    })() : (`;

const newSnippet = `                    {field.options ? (() => {
                        const normalizedOptions: { value: string; label: string }[] = field.options.map((opt: any) =>
                            typeof opt === 'object' && opt !== null && 'value' in opt
                                ? { value: String(opt.value), label: String(opt.label) }
                                : { value: String(opt), label: String(opt) }
                        );
                        const strVal = (field.key === 'transport_allowance' && (value === 0 || value === '0' || value === null || value === undefined || value === ''))
                            ? '0'
                            : (value !== null && value !== undefined && value !== '') ? String(value) : '';
                        const exists = normalizedOptions.some(o => o.value === strVal);
                        const allOptions = (strVal && !exists)
                            ? [{ value: strVal, label: strVal === '0' ? 'بلا' : strVal }, ...normalizedOptions]
                            : normalizedOptions;
                        return (
                            <Select
                                value={strVal}
                                onValueChange={(val) => onChange(field.key, val)}
                                disabled={field.disabled || isReadOnly}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="اختر..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {allOptions.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        );
                    })() : (`;

// Normalize CRLF to LF for comparison if needed
const codeLf = code.replace(/\r\n/g, '\n');
const oldSnippetLf = oldSnippet.replace(/\r\n/g, '\n');
const newSnippetLf = newSnippet.replace(/\r\n/g, '\n');

if (codeLf.includes(oldSnippetLf)) {
    code = codeLf.replace(oldSnippetLf, newSnippetLf);
    fs.writeFileSync(filePath, code, 'utf-8');
    console.log('Successfully patched TabManageEmployees.tsx');
} else {
    console.error('Could not find oldSnippet in TabManageEmployees.tsx');
    process.exit(1);
}
