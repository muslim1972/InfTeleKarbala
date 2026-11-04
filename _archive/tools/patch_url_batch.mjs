import fs from 'fs';

let c = fs.readFileSync('src/hooks/useUniversalPatcher.ts', 'utf8');
const isCrlf = c.includes('\r\n');
c = c.replace(/\r\n/g, '\n');

// 1. Target the fetching of existingRecords
const targetFetch = `            } else if (tableDef.type === 'single') {
                // financial_records: سجل واحد لكل موظف
                const { data } = await supabase.from(tableDef.tableName).select('*').in('user_id', govProfileIds);
                existingRecords = (data || []).map((r: any) => ({ ...r, _userId: r.user_id }));
            } else {
                // yearly / detail: نحتاج السنة
                const { data } = await supabase
                    .from(tableDef.tableName)
                    .select('*')
                    .eq('year', targetYear)
                    .in('user_id', govProfileIds);
                existingRecords = (data || []).map((r: any) => ({ ...r, _userId: r.user_id }));
            }`;

const replFetch = `            } else if (tableDef.type === 'single') {
                // financial_records: سجل واحد لكل موظف — تقسيم الاستعلام إلى دفعات لتجنب خطأ 414 Request-URI Too Large
                const BATCH_SIZE = 80;
                const allData: any[] = [];
                for (let i = 0; i < govProfileIds.length; i += BATCH_SIZE) {
                    const slice = govProfileIds.slice(i, i + BATCH_SIZE);
                    const { data } = await supabase.from(tableDef.tableName).select('*').in('user_id', slice);
                    if (data && data.length) allData.push(...data);
                }
                existingRecords = allData.map((r: any) => ({ ...r, _userId: r.user_id }));
            } else {
                // yearly / detail: نحتاج السنة — تقسيم الاستعلام إلى دفعات لتجنب خطأ 414 Request-URI Too Large
                const BATCH_SIZE = 80;
                const allData: any[] = [];
                for (let i = 0; i < govProfileIds.length; i += BATCH_SIZE) {
                    const slice = govProfileIds.slice(i, i + BATCH_SIZE);
                    const { data } = await supabase
                        .from(tableDef.tableName)
                        .select('*')
                        .eq('year', targetYear)
                        .in('user_id', slice);
                    if (data && data.length) allData.push(...data);
                }
                existingRecords = allData.map((r: any) => ({ ...r, _userId: r.user_id }));
            }`;

if (!c.includes(targetFetch)) {
    console.error('targetFetch not found in useUniversalPatcher.ts');
    process.exit(1);
}
c = c.replace(targetFetch, replFetch);

// 2. Target the insert/upsert in executePatch
const targetInsert = `                        } else if (item.status === 'new_record' && (item.profileId || tableDef.isStandalone)) {
                            // إضافة سجل جديد
                            const insertPayload: any = { ...payload };
                            if (!tableDef.isStandalone) {
                                insertPayload.user_id = item.profileId;
                            }
                            // إضافة السنة للجداول السنوية/التفصيلية
                            if (tableDef.type === 'yearly' || tableDef.type === 'detail') {
                                insertPayload.year = targetYear;
                            }
                            const { error } = await supabase
                                .from(tableDef.tableName)
                                .insert([insertPayload]);
                            if (error) throw error;
                        }`;

const replInsert = `                        } else if (item.status === 'new_record' && (item.profileId || tableDef.isStandalone)) {
                            // إضافة سجل جديد (أو تحديث إذا وُجد السجل مسبقاً في الجداول الأحادية لمنع تعارض المفاتيح الفريدة)
                            const insertPayload: any = { ...payload };
                            if (!tableDef.isStandalone) {
                                insertPayload.user_id = item.profileId;
                            }
                            // إضافة السنة للجداول السنوية/التفصيلية
                            if (tableDef.type === 'yearly' || tableDef.type === 'detail') {
                                insertPayload.year = targetYear;
                            }
                            const query = (tableDef.type === 'single' && !tableDef.isStandalone)
                                ? supabase.from(tableDef.tableName).upsert([insertPayload], { onConflict: 'user_id' })
                                : supabase.from(tableDef.tableName).insert([insertPayload]);
                            const { error } = await query;
                            if (error) throw error;
                        }`;

if (!c.includes(targetInsert)) {
    console.error('targetInsert not found in useUniversalPatcher.ts');
    process.exit(1);
}
c = c.replace(targetInsert, replInsert);

if (isCrlf) {
    c = c.replace(/\n/g, '\r\n');
}
fs.writeFileSync('src/hooks/useUniversalPatcher.ts', c, 'utf8');
console.log('useUniversalPatcher.ts patched successfully');
