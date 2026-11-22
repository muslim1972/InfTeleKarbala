import fs from 'fs';

const filePath = 'src/hooks/useUniversalPatcher.ts';
let code = fs.readFileSync(filePath, 'utf8');

// 1. Update imports
code = code.replace(
    "resolveDepartmentHierarchy,\r\n} from '../utils/universalPatcherConfig';",
    "resolveDepartmentHierarchy,\r\n    resolvePositionAssignments,\r\n    type PositionAssignment,\r\n} from '../utils/universalPatcherConfig';"
);
if (!code.includes('resolvePositionAssignments')) {
    code = code.replace(
        "resolveDepartmentHierarchy,\n} from '../utils/universalPatcherConfig';",
        "resolveDepartmentHierarchy,\n    resolvePositionAssignments,\n    type PositionAssignment,\n} from '../utils/universalPatcherConfig';"
    );
}

// 2. Update MatchResult interface
const matchResultOld = `export interface MatchResult {
    status: 'match' | 'new_record' | 'missing';
    /** ID السجل الموجود (للتحديث) */
    recordId?: string;
    /** ID المستخدم */
    profileId?: string;
    /** الاسم في DB */
    currentName?: string;
    /** الاسم في Excel */
    excelName: string;
    /** الرقم الوظيفي المستخرج من Excel (لإنشاء الحسابات) */
    jobNumber?: string;
    /** الاسم المعروض من Excel */
    displayName?: string;
    /** القيم الجديدة */
    newValues: Record<string, any>;
    /** القيم القديمة */
    oldValues?: Record<string, any>;
    /** الفروقات المكتشفة */
    diffs: Record<string, { old: any; new: any }>;
    /** هل الموظف محال للتقاعد */
    isRetired?: boolean;
    /** تاريخ الإحالة للتقاعد */
    retirementDate?: string | null;
}`;

const matchResultNew = `export interface MatchResult {
    status: 'match' | 'new_record' | 'missing';
    /** ID السجل الموجود (للتحديث) */
    recordId?: string;
    /** ID المستخدم */
    profileId?: string;
    /** الاسم في DB */
    currentName?: string;
    /** الاسم في Excel */
    excelName: string;
    /** الرقم الوظيفي المستخرج من Excel (لإنشاء الحسابات) */
    jobNumber?: string;
    /** الاسم المعروض من Excel */
    displayName?: string;
    /** القيم الجديدة */
    newValues: Record<string, any>;
    /** القيم القديمة */
    oldValues?: Record<string, any>;
    /** الفروقات المكتشفة */
    diffs: Record<string, { old: any; new: any }>;
    /** هل الموظف محال للتقاعد */
    isRetired?: boolean;
    /** تاريخ الإحالة للتقاعد */
    retirementDate?: string | null;
    /** التكليف الإداري المستنتج (مسؤول / بديل) */
    posAssignment?: PositionAssignment;
}`;

code = code.replace(matchResultOld.replace(/\r\n/g, '\n'), matchResultNew.replace(/\r\n/g, '\n'));
code = code.replace(matchResultOld, matchResultNew);

// 3. Add skip management states after const [govOpening, setGovOpening] = useState(false);
const skipStates = `    // 🆕 وضع افتتاح محافظة جديدة: لا مستخدمين → إنشاء الحسابات من عمودي الملف ثم الحقن
    const [govOpening, setGovOpening] = useState(false);

    // ⛔ إدارة تجاوز القيود في المعاينة
    const [skippedRecordKeys, setSkippedRecordKeys] = useState<Set<string>>(new Set());

    const getMatchKey = useCallback((m: MatchResult): string => {
        return m.recordId || m.profileId || m.jobNumber || m.excelName;
    }, []);

    const toggleSkipRecord = useCallback((key: string) => {
        setSkippedRecordKeys(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }, []);

    const skipAllRecords = useCallback(() => {
        const allKeys = new Set(matches.map(m => m.recordId || m.profileId || m.jobNumber || m.excelName));
        setSkippedRecordKeys(allKeys);
    }, [matches]);

    const unskipAllRecords = useCallback(() => {
        setSkippedRecordKeys(new Set());
    }, []);

    const isRecordSkipped = useCallback((key: string) => {
        return skippedRecordKeys.has(key);
    }, [skippedRecordKeys]);`;

code = code.replace(
    '    // 🆕 وضع افتتاح محافظة جديدة: لا مستخدمين → إنشاء الحسابات من عمودي الملف ثم الحقن\r\n    const [govOpening, setGovOpening] = useState(false);',
    skipStates
);
if (!code.includes('skippedRecordKeys')) {
    code = code.replace(
        '    // 🆕 وضع افتتاح محافظة جديدة: لا مستخدمين → إنشاء الحسابات من عمودي الملف ثم الحقن\n    const [govOpening, setGovOpening] = useState(false);',
        skipStates
    );
}

// 4. Update analyzeData to fetch departments, resolve hierarchy & position
const analyzeDeptFetch = `            // 1. جلب ملفات محافظة الهدف فقط
            let profilesRaw: any[] = [];
            let govDepartments: any[] = [];
            if (tableDef.tableName === 'profiles') {
                const { data: dData } = await supabase.from('departments').select('id, name, parent_id, level').eq('governorate', gov);
                govDepartments = dData || [];
            }`;

code = code.replace(
    "            // 1. جلب ملفات محافظة الهدف فقط\r\n            let profilesRaw: any[] = [];",
    analyzeDeptFetch
);
if (!code.includes('govDepartments: any[] = [];')) {
    code = code.replace(
        "            // 1. جلب ملفات محافظة الهدف فقط\n            let profilesRaw: any[] = [];",
        analyzeDeptFetch
    );
}

// 5. In analyzeData, process hierarchy & position
const profileHierarchyProcess = `                // حقن اسم الدورة إذا كان الجدول تدريب صيفي
                if (tableDef.tableName === 'summer_training_students') {
                    newValues['batch_name'] = targetBatch;
                }

                // استنتاج التشكيل الإداري والمنصب الإداري لجدول profiles
                let posAssignment: PositionAssignment | undefined;
                if (tableDef.tableName === 'profiles' && govDepartments.length > 0) {
                    const resolvedDept = resolveDepartmentHierarchy(
                        newValues.unit_text,
                        newValues.section_text,
                        newValues.dept_text,
                        govDepartments
                    );
                    if (resolvedDept) {
                        if (resolvedDept.department_id) newValues.department_id = resolvedDept.department_id;
                        if (resolvedDept.dept_text) newValues.dept_text = resolvedDept.dept_text;
                        if (resolvedDept.section_text !== undefined) newValues.section_text = resolvedDept.section_text;
                        if (resolvedDept.unit_text !== undefined) newValues.unit_text = resolvedDept.unit_text;
                    }
                    if (newValues.position_title) {
                        posAssignment = resolvePositionAssignments(
                            newValues.position_title,
                            resolvedDept,
                            govDepartments
                        );
                    }
                }`;

code = code.replace(
    "                // حقن اسم الدورة إذا كان الجدول تدريب صيفي\r\n                if (tableDef.tableName === 'summer_training_students') {\r\n                    newValues['batch_name'] = targetBatch;\r\n                }",
    profileHierarchyProcess
);
if (!code.includes('posAssignment: PositionAssignment | undefined;')) {
    code = code.replace(
        "                // حقن اسم الدورة إذا كان الجدول تدريب صيفي\n                if (tableDef.tableName === 'summer_training_students') {\n                    newValues['batch_name'] = targetBatch;\n                }",
        profileHierarchyProcess
    );
}

// 6. In results.push for profiles match, remove identity fields from diffs and attach posAssignment
const matchProfilesOld = `                if (tableDef.tableName === 'profiles') {
                    // تحديث الملف الشخصي مباشرة
                    const existing = userRecords[0] || {};
                    const diffs = buildDiffs(newValues, existing);

                    results.push({
                        status: 'match',
                        recordId: matched.profileId,
                        profileId: matched.profileId,
                        currentName: matched.full_name,
                        excelName: cardTitle,
                        jobNumber: jobNumber || matched.job_number || undefined,
                        displayName: matched.full_name || displayName || undefined,
                        newValues,
                        oldValues: existing,
                        diffs,
                        isRetired: matched.is_retired,
                        retirementDate: matched.retirement_date,
                    });`;

const matchProfilesNew = `                if (tableDef.tableName === 'profiles') {
                    // تحديث الملف الشخصي مباشرة
                    const existing = userRecords[0] || {};
                    const diffs = buildDiffs(newValues, existing);
                    // تحصين حقول الهوية الثلاثية: لا تظهر كفروقات لأنها لن تُعدّل للمطابقين
                    delete diffs.full_name;
                    delete diffs.username;
                    delete diffs.job_number;

                    results.push({
                        status: 'match',
                        recordId: matched.profileId,
                        profileId: matched.profileId,
                        currentName: matched.full_name,
                        excelName: cardTitle,
                        jobNumber: jobNumber || matched.job_number || undefined,
                        displayName: matched.full_name || displayName || undefined,
                        newValues,
                        oldValues: existing,
                        diffs,
                        isRetired: matched.is_retired,
                        retirementDate: matched.retirement_date,
                        posAssignment,
                    });`;

code = code.replace(matchProfilesOld.replace(/\r\n/g, '\n'), matchProfilesNew.replace(/\r\n/g, '\n'));
code = code.replace(matchProfilesOld, matchProfilesNew);

// 7. In executeUpdate, filter skipped tasks and execute position assignment
const executeTasksOld = `            // 2. فلترة المهام القابلة للتنفيذ
            const tasks = matches.filter(m => {
                if (m.status === 'match') return true;
                if (m.status === 'new_record') return true;
                if (m.status === 'missing' && createMissingAccounts) return true;
                return false;
            });`;

const executeTasksNew = `            // 2. فلترة المهام القابلة للتنفيذ واستبعاد المتجاوزين
            const tasks = matches.filter(m => {
                const key = m.recordId || m.profileId || m.jobNumber || m.excelName;
                if (skippedRecordKeys.has(key)) return false; // ⛔ تجاوز القيد
                if (m.status === 'match') return true;
                if (m.status === 'new_record') return true;
                if (m.status === 'missing' && createMissingAccounts) return true;
                return false;
            });`;

code = code.replace(executeTasksOld.replace(/\r\n/g, '\n'), executeTasksNew.replace(/\r\n/g, '\n'));
code = code.replace(executeTasksOld, executeTasksNew);

// 8. In executeUpdate for profiles, enforce identity protection and update departments
const updateProfilesOld = `                            if (targetId) {
                                const { error } = await supabase
                                    .from('profiles')
                                    .update({ ...payload, updated_at: new Date().toISOString() })
                                    .eq('id', targetId);
                                if (error) throw error;`;

const updateProfilesNew = `                            if (targetId) {
                                // 🔒 تحصين حقول الهوية الثلاثية من التعديل للمطابقين
                                if (item.status === 'match') {
                                    delete payload.full_name;
                                    delete payload.username;
                                    delete payload.job_number;
                                }

                                const { error } = await supabase
                                    .from('profiles')
                                    .update({ ...payload, updated_at: new Date().toISOString() })
                                    .eq('id', targetId);
                                if (error) throw error;

                                // 👑 تطبيق تكليفات المنصب الإداري والبديل في departments
                                if (item.posAssignment) {
                                    if (item.posAssignment.managerDeptId) {
                                        try {
                                            await supabase.from('departments')
                                                .update({ manager_id: targetId, updated_at: new Date().toISOString() })
                                                .eq('id', item.posAssignment.managerDeptId);
                                        } catch (pErr) {
                                            console.warn('تعذر تعيين مسؤول التشكيل:', pErr);
                                        }
                                    }
                                    if (item.posAssignment.deputyDeptId) {
                                        try {
                                            await supabase.from('departments')
                                                .update({ deputy_manager_id: targetId, updated_at: new Date().toISOString() })
                                                .eq('id', item.posAssignment.deputyDeptId);
                                        } catch (pErr) {
                                            console.warn('تعذر تعيين بديل التشكيل:', pErr);
                                        }
                                    }
                                }`;

code = code.replace(updateProfilesOld.replace(/\r\n/g, '\n'), updateProfilesNew.replace(/\r\n/g, '\n'));
code = code.replace(updateProfilesOld, updateProfilesNew);

// 9. Update stats calculation to include skipped and approved
const statsOld = `    const stats = useMemo(() => ({
        total: matches.length,
        found: matches.filter(m => m.status === 'match').length,
        newRecords: matches.filter(m => m.status === 'new_record').length,
        missing: matches.filter(m => m.status === 'missing').length,
    }), [matches]);`;

const statsNew = `    const stats = useMemo(() => {
        const total = matches.length;
        const found = matches.filter(m => m.status === 'match').length;
        const newRecords = matches.filter(m => m.status === 'new_record').length;
        const missing = matches.filter(m => m.status === 'missing').length;
        const skipped = matches.filter(m => {
            const key = m.recordId || m.profileId || m.jobNumber || m.excelName;
            return skippedRecordKeys.has(key);
        }).length;
        return {
            total,
            found,
            newRecords,
            missing,
            skipped,
            approved: Math.max(0, total - skipped),
        };
    }, [matches, skippedRecordKeys]);`;

code = code.replace(statsOld.replace(/\r\n/g, '\n'), statsNew.replace(/\r\n/g, '\n'));
code = code.replace(statsOld, statsNew);

// 10. Update reset to clear skippedRecordKeys
code = code.replace(
    'setWorkbook(null);',
    'setWorkbook(null);\n        setSkippedRecordKeys(new Set());'
);

// 11. Return skipped functions in hook return
const returnMarker = '        analyzeData,\r\n        executeUpdate,\r\n        reset,\r\n    };';
const returnNew = `        analyzeData,
        executeUpdate,
        reset,
        skippedRecordKeys,
        toggleSkipRecord,
        skipAllRecords,
        unskipAllRecords,
        isRecordSkipped,
        getMatchKey,
    };`;

code = code.replace(returnMarker, returnNew);
if (!code.includes('toggleSkipRecord,')) {
    code = code.replace(
        '        analyzeData,\n        executeUpdate,\n        reset,\n    };',
        returnNew
    );
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('Successfully updated src/hooks/useUniversalPatcher.ts');
