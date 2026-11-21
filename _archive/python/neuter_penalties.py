with open(r'd:\InfTeleKarbala\src\features\attendance\services\attendanceService.ts', 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = "  async enforceMandatoryPenalties(employeeId: string, dateStr: string, record: AttendanceRecord) {"
end_marker = "  async checkIn(employeeId: string, location?: string, deviceId?: string, verifiedByBiometric: boolean = false, snapshotUrl?: string, notes?: string) {"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print(f"Error: markers not found! start_idx={start_idx}, end_idx={end_idx}")
    exit(1)

replacement = """  async enforceMandatoryPenalties(_employeeId: string, _dateStr: string, _record: AttendanceRecord): Promise<void> {
    // ملغاة نهائياً: تطبيق البصمة استشاري تنبيهي فقط للمشرف ولا يفرض إجازات أو عقوبات تلقائية
    return;
  },

"""

new_content = content[:start_idx] + replacement + content[end_idx:]

with open(r'd:\InfTeleKarbala\src\features\attendance\services\attendanceService.ts', 'w', encoding='utf-8') as f:
    f.write(new_content)

print(f"Successfully replaced legacy enforceMandatoryPenalties ({end_idx - start_idx} chars removed).")
