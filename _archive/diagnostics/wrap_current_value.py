with open('src/components/admin/CustomAudit.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

target = """                            <div className="flex items-center justify-between border-t border-dashed pt-3" style={{ borderColor: theme === 'light' ? '#ddd' : 'rgba(255,255,255,0.1)' }}>
                                <span className={cn("text-xs font-bold", labelClr)}>المستلم</span>
                                <div className="flex items-center gap-2">
                                    <span className={cn("text-lg font-bold font-mono", theme === 'light' ? 'text-blue-600' : 'text-blue-400')}>{fmt(currentValue)}</span>
                                    <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded", theme === 'light' ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/10 text-blue-400')}>المستلم</span>
                                </div>
                            </div>"""

repl = """                            {scope === 'specific' && currentValue !== null && (
                                <div className="flex items-center justify-between border-t border-dashed pt-3" style={{ borderColor: theme === 'light' ? '#ddd' : 'rgba(255,255,255,0.1)' }}>
                                    <span className={cn("text-xs font-bold", labelClr)}>المستلم</span>
                                    <div className="flex items-center gap-2">
                                        <span className={cn("text-lg font-bold font-mono", theme === 'light' ? 'text-blue-600' : 'text-blue-400')}>{fmt(currentValue)}</span>
                                        <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded", theme === 'light' ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/10 text-blue-400')}>المستلم</span>
                                    </div>
                                </div>
                            )}"""

if target in text:
    text = text.replace(target, repl)
    with open('src/components/admin/CustomAudit.tsx', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Wrapped currentValue display for scope === specific successfully!")
else:
    print("target not found")
