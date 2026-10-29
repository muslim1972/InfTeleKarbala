# -*- coding: utf-8 -*-
import docx
from docx.shared import Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
import copy
import os

HIGHLIGHT_COLOR = RGBColor(0, 82, 204) # Royal Blue for v0.3 updates

def highlight_run(run):
    run.font.color.rgb = HIGHLIGHT_COLOR
    run.font.bold = True

src_path = r"F:\صور للتجربة\نظام المديرية\نظام الادارة\تطبيق نحن\البحث النهائي\بحث إطار عمل B.R.I.C.K ومحرك الإنفاذ الحتمي v0.2.docx"
dst_path = r"F:\صور للتجربة\نظام المديرية\نظام الادارة\تطبيق نحن\البحث النهائي\بحث إطار عمل B.R.I.C.K ومحرك الإنفاذ الحتمي v0.3.docx"

doc = docx.Document(src_path)

print(f"Loaded v0.2 with {len(doc.paragraphs)} paragraphs and {len(doc.tables)} tables.")

# =========================================================================
# 1. Update Paragraph 16 (Arabic Abstract Scale & Invariants)
# =========================================================================
p16 = doc.paragraphs[16]
p16.text = ""
r1 = p16.add_run("وتؤكد النتائج الميدانية لتطبيق الإطار على نظام مؤسسي إنتاجي متكامل ")
r2 = p16.add_run("(45 نواة، 318 ملفاً، 128 دالة مخزنة، 91 جدولاً علائقياً)")
highlight_run(r2)
r3 = p16.add_run(" قدرته على فرض الحظر التام على أي تعديل غير مصرح به أو تجاوز سيادي، ")
r4 = p16.add_run("مع القضاء المبرم على هلوسات المخططات النمطية وأخطاء الربط المتأخر في قواعد البيانات عبر بوابات الفحص الدخاني والتأصيل الهيكلي (v3.0)، ")
highlight_run(r4)
r5 = p16.add_run("بزمن فحص يقل عن 1.2 ثانية، مما يؤسس لمرحلة جديدة من حوكمة البرمجيات الحتمية والسيادية الموثوقة.")

# =========================================================================
# 2. Update Paragraph 19 (English Abstract Scale & Invariants)
# =========================================================================
p19 = doc.paragraphs[19]
p19.text = ""
p19_part1 = ("Modern software engineering operates at an unprecedented crossroads: while human engineers face "
             "cognitive memory limits in managing enterprise codebase complexity and accumulating Architectural Technical Debt, "
             "the pervasive adoption of generative AI coding assistants has become an undeniable reality. However, this human-AI hybrid "
             "paradox introduces a dual-vulnerability paradox: human fatigue leads to accidental regressions and cross-feature breakage, "
             "while stochastic LLM agents introduce context loss, hallucinations, collateral file tampering, and frontend-database schema divergence. "
             "This paper presents the B.R.I.C.K. Framework and Deterministic Sentinel—a bi-directional architectural shield that safeguards "
             "systems against both human cognitive oversight and non-deterministic agent drift. B.R.I.C.K. organizes software into Bounded, "
             "Reliable, Immutable, Cross-layer Kernels governed by strict single ownership, zero-orphan invariants, and cross-layer sovereign boundaries. "
             "The framework exhibits dual-mode operational resilience: (1) an Enterprise Distributed Mode integrating Git recovery vectors and "
             "PostgreSQL live schema introspection across multiple schemas, and (2) an Air-Gapped / Offline Mode supporting completely disconnected, "
             "Git-less environments via a local content-addressed Shadow Stash (.brick-cache/) enabling sub-millisecond local rollback, combined with "
             "embedded SQLite catalog inspection. Evaluated across an enterprise production system in its ")
r_eng1 = p19.add_run(p19_part1)
r_eng2 = p19.add_run("enhanced v3.0 iteration (45 kernels, 318 frontend files, 128 stored procedures, 91 relational tables), ")
highlight_run(r_eng2)
r_eng3 = p19.add_run("the framework eliminated unauthorized mutations, cross-kernel sovereign bypasses, and ")
r_eng4 = p19.add_run("late-binding column mismatches via deterministic schema-grounding smoke verification, ")
highlight_run(r_eng4)
r_eng5 = p19.add_run("with sub-second execution overhead (<1.2s), providing an empirical and formal foundation for verifiable, deterministic, and sovereign hybrid engineering.")

# =========================================================================
# 3. Update Invariants Introduction (Paragraph 107)
# =========================================================================
p107 = doc.paragraphs[107]
p107.text = ""
r_inv_intro1 = p107.add_run("يفرض محرك الحراسة ")
r_inv_intro2 = p107.add_run("ست قواعد قطعية وسيادية وتأصيلية مجردة (System Invariants) ")
highlight_run(r_inv_intro2)
r_inv_intro3 = p107.add_run("يجب أن تتحقق بالكامل قبل السماح بتمرير أي عملية بناء أو اعتماد لقطة:")

# =========================================================================
# 4. Insert 6th Invariant before Chapter 4 (Paragraph 117)
# =========================================================================
p117 = doc.paragraphs[117]
p_new_inv6 = p117.insert_paragraph_before()
p_new_inv6.style = doc.paragraphs[116].style

r_inv6_bullet = p_new_inv6.add_run("▪ ")
r_inv6_title = p_new_inv6.add_run("مسلمة التأصيل الهيكلي القطعي والإلزام التنفيذي للدوال (Strict Schema Grounding & Execution-Proof Invariant): ")
highlight_run(r_inv6_title)
r_inv6_body1 = p_new_inv6.add_run("يُحظر قطعياً على أي دالة RPC مخزنة أو استعلام بيانات اعتماد أسماء أعمدة افتراضية أو نمطية (Semantic Schema Priors) دون إثبات وجودها الفعلي والمطابق في كتالوج قاعدة البيانات الحي (information_schema.columns). كما يُلزم المحرك إخضاع كل دالة مضافة أو معدلة لفحص تنفيذي لحظي محمي (Protected Dry-Run / Smoke Invocation Gate) داخل معاملة معزولة تُلغى فورياً (ROLLBACK) أو استدعاء استعلامي آمن قبل تمرير البناء أو أخذ اللقطة، لمنع تسلل أخطاء عدم تطابق المخطط الناتجة عن الربط المتأخر في محركات قواعد البيانات (Late-Binding Resolution Failures):")
highlight_run(r_inv6_body1)

# Clone Table 5 (the styled 1x1 formula table) to hold Invariant 6 Formula!
t5 = doc.tables[5]
new_formula_tbl_elm = copy.deepcopy(t5._tbl)
p_new_inv6._p.addnext(new_formula_tbl_elm)

# Style and populate the cloned formula table
formula_tbl = docx.table.Table(new_formula_tbl_elm, doc)
f_cell = formula_tbl.cell(0, 0)
f_cell.text = ""
p_f = f_cell.paragraphs[0]
p_f.alignment = docx.enum.text.WD_ALIGN_PARAGRAPH.CENTER

formula_tokens = [
    ("∀ f ∈ ", True),
    ("S_rpc", True),
    (",  Columns(f) ⊆ Catalog(", True),
    ("S_tables", True),
    (")  ∧  DryRun(f) ≠ RuntimeSchemaError", True)
]

for tok_text, tok_bold in formula_tokens:
    r = p_f.add_run(tok_text)
    r.font.name = "Consolas"
    r.font.bold = tok_bold
    r.font.color.rgb = HIGHLIGHT_COLOR
    rPr = r._r.get_or_add_rPr()
    rFonts = OxmlElement('w:rFonts')
    rFonts.set(qn('w:ascii'), 'Consolas')
    rFonts.set(qn('w:hAnsi'), 'Consolas')
    rFonts.set(qn('w:cs'), 'Consolas')
    rPr.append(rFonts)

# =========================================================================
# 5. Update Table 8 (Algorithm 3 to v3.0)
# =========================================================================
table8 = doc.tables[8]
cell8 = table8.cell(0, 0)
cell8.text = ""

alg3_text_part1 = (
    "الخوارزمية 3 المحدثة (v3.0): الفحص الكتالوجي والسيادي والتأصيلي التنفيذي لقواعد البيانات [Pseudocode]\n\n"
    "Algorithm 3: Pluggable Deep Catalog, Sovereign Boundary & Protected Smoke Auditing (v3.0)\n"
    "Input: DeclaredCatalog R_db, DatabaseDriver Driver, ConnectionConfig Cfg, ConfiguredSchemas Schemas\n"
    "Output: Conformance Confirmed OR Discrepancy & Execution Fault List\n\n"
    "1: LiveCatalog ← IntrospectSchemaObjects(Driver, Cfg, Schemas)\n"
    "2: Faults ← InitializeList()\n"
    "3:\n"
    "4: // 1. تدقيق الوجود الكتالوجي والتغطية الشاملة (Catalog Parity)\n"
    "5: For each Category in DeclaredCatalog.categories():\n"
    "6:    Missing ← R_db.getItems(Category).difference(LiveCatalog.getItems(Category))\n"
    "7:    Orphans ← LiveCatalog.getItems(Category).difference(R_db.getItems(Category))\n"
    "8:    If Missing.isNotEmpty Then Faults.append(\"MISSING_OBJECT: \" + Category + \" -> \" + Missing)\n"
    "9:    If Orphans.isNotEmpty Then Faults.append(\"UNDECLARED_OBJECT: \" + Category + \" -> \" + Orphans)\n"
    "10:\n"
    "11: // 2. تدقيق الملكية السيادية والامتيازات (Sovereign Ownership & Privilege Check)\n"
    "12: For each (Func, Owner, isDefiner) in LiveCatalog.functionsWithMeta():\n"
    "13:    If isDefiner AND Owner != \"supabase_admin\" Then:\n"
    "14:       Faults.append(\"UNAUTHORIZED_FUNCTION_OWNER: \" + Func + \" owned by \" + Owner + \" (Must be supabase_admin)\")\n"
    "15:\n"
    "16: // 3. تدقيق التعدي العابر للأنوية (Cross-Kernel Mutation Audit)\n"
    "17: For each Kernel B in R_db.bricks:\n"
    "18:    For each MutatedTable in ExtractMutations(B):\n"
    "19:       OwnerKernel ← R_db.findOwnerOfTable(MutatedTable)\n"
    "20:       If OwnerKernel != B.id AND NOT OwnerKernel.isContractExport(MutatedTable) Then:\n"
    "21:          Faults.append(\"SOVEREIGN_BYPASS: \" + B.id + \" mutates table \" + MutatedTable + \" owned by \" + OwnerKernel)\n"
    "22:\n"
)

p_alg = cell8.paragraphs[0]
r_alg1 = p_alg.add_run(alg3_text_part1)

alg3_v3_extension = (
    "23: // 4. تدقيق التأصيل الهيكلي والاستدعاء الدخاني المحمي (Schema Grounding & Protected Smoke Audit - v3.0)\n"
    "24: For each Func in LiveCatalog.newOrModifiedFunctions():\n"
    "25:    ReferencedCols ← ExtractReferencedColumns(Func)\n"
    "26:    UnknownCols ← ReferencedCols.difference(LiveCatalog.allTableColumns())\n"
    "27:    If UnknownCols.isNotEmpty Then:\n"
    "28:       Faults.append(\"SCHEMA_GROUNDING_FAILED: \" + Func + \" references non-existent columns: \" + UnknownCols)\n"
    "29:    Else:\n"
    "30:       ExecutionResult ← ExecuteProtectedSmokeInvocation(Func, InTransactionWithRollback=True)\n"
    "31:       If ExecutionResult.hasRuntimeSchemaMismatch() Then:\n"
    "32:          Faults.append(\"LATE_BINDING_EXECUTION_FAULT: \" + Func + \" -> \" + ExecutionResult.errorMessage)\n"
    "33:\n"
    "34: If Faults.length > 0 Then HaltExecution(Exit 1, Faults)\n"
    "35: Else Return ConformanceConfirmed\n"
)
r_alg2 = p_alg.add_run(alg3_v3_extension)
highlight_run(r_alg2)

# =========================================================================
# 6. Update Table 9 (The Snapshot Protocol - Gate 4)
# =========================================================================
table9 = doc.tables[9]
cell9 = table9.cell(0, 0)
cell9.text = ""
p_t9 = cell9.paragraphs[0]

t9_part1 = (
    "مفارقة البصمة والاعتماد المشروط (The Snapshot Protocol)\n"
    "يثار تساؤل هندسي جوهري : إذا كان الحارس في اطار B.R.I.C.K يمنع أي اختلاف في البصمات التشفيرية، فكيف يطور المبرمج ميزات جديدة دون أن يوقفه الحارس؟ وهل اعتماد البصمة الجديدة يتم بمجرد رغبة المطور أم يخضع لشروط قطعية؟\n"
    "الجواب : يعمل الحارس وفق مبدأ «الفصل الصارم بين وضعين تشغيليين»:\n"
    "وضع الحراسة الافتراضي (Read-Only Verification): في خط البناء العادي وأثناء عمل وكلاء الذكاء الاصطناعي، يرفض الحارس أي تغير في البصمة ويصدر أمر الاسترجاع الفوري لحماية النظام من التسلل العشوائي.\n"
    "وضع الاعتماد الصريح (Explicit Snapshot Mode): حين ينتهي المطور من كتابة ميزته ويثق بصحتها، او يدقق عمل الوكيل ويثق باضافاته , يطلق أمراً صريحاً يعلن مسؤوليته البشرية:\n"
    "                                                                node scripts/verify-bricks.mjs --snapshot\n"
    "ولكن الحارس لا يقبل أخذ اللقطة واعتماد البصمة الجديدة إلا بعد اجتياز بوابات متزامنة قطعية:\n"
    "• البوابة 1 (انعدام الأيتام): ألا يكون التعديل قد أفرز أي ملف جديد سائب غير منسوب لنواة معتمدة.\n"
    "• البوابة 2 (حظر الملكية المزدوجة): ألا يشترك ملف أو كائن واحد بين نواتين.\n"
    "• البوابة 3 (التكافؤ التعاقدي R# / T#): أن تجتاز كافة الاختبارات البرمجية المسجلة وتطابق قواعد العمل المقابلة لها.\n"
)
r_t9_1 = p_t9.add_run(t9_part1)

t9_gate4 = (
    "• البوابة 4 (اتساق كتالوج قاعدة البيانات والتأصيل التنفيذي الدخاني - v3.0): مطابقة كافة الجداول والدوال عبر كافة المخططات (public / itpc) مع السجل المصرح به دون كائنات مجهولة أو مفقودة، واجتياز كافة دوال RPC الجديدة للاستدعاء الدخاني التنفيذي المحمي (Smoke Gate) وخلوها التام من أخطاء الربط المتأخر للأعمدة.\n"
)
r_t9_2 = p_t9.add_run(t9_gate4)
highlight_run(r_t9_2)

t9_gate5 = (
    "• البوابة 5 (التخزين في مستودع الظل): ضغط وتحديث كتل البيانات في .brick-cache/ لتأمين نقطة الاسترجاع المحلية المعزولة.\n"
)
r_t9_3 = p_t9.add_run(t9_gate5)

# =========================================================================
# 7. Update Table Scale (System Scale Table)
# =========================================================================
for tbl in doc.tables:
    if len(tbl.rows) > 0 and "المقياس الهندسي" in tbl.cell(0, 0).text:
        # Row 2: Frontend files -> 318
        cell_src = tbl.cell(2, 1)
        cell_src.text = ""
        r_src = cell_src.paragraphs[0].add_run("318 ملفاً")
        highlight_run(r_src)

        # Row 2 Result: 400 fingerprints
        cell_src_res = tbl.cell(2, 2)
        cell_src_res.text = ""
        p_src_res = cell_src_res.paragraphs[0]
        r_sr1 = p_src_res.add_run("تغطية بنسبة 100% (مع ")
        r_sr2 = p_src_res.add_run("400 ملفاً مسجلاً بالبصمة التشفيرية")
        highlight_run(r_sr2)
        r_sr3 = p_src_res.add_run(")")

        # Row 3: Stored procedures -> 128
        cell_rpc = tbl.cell(3, 1)
        cell_rpc.text = ""
        r_rpc = cell_rpc.paragraphs[0].add_run("128 دالة RPC")
        highlight_run(r_rpc)
        break

# =========================================================================
# 8. Update Section 6.2 Performance Overhead Benchmarks (Question 3 & Image 3)
# =========================================================================
for p in doc.paragraphs:
    if "زمن التحقق الهيكلي المحلي ومستودع الظل:" in p.text:
        p.text = ""
        r_p1 = p.add_run("▪ زمن التحقق الهيكلي المحلي ومستودع الظل: ")
        r_p2 = p.add_run("بلغ متوسط زمن تنفيذ الفحص المحلي والتحقق التشفيري 1.16 ثانية لفحص ")
        r_p3 = p.add_run("318 ملفاً مصدرياً وتدقيق 400 بصمة تجزئة تشفيرية")
        highlight_run(r_p3)
        r_p4 = p.add_run("، فيما بلغ زمن استرجاع الملف التالف من مستودع الظل أقل من 5 أجزاء من الألف من الثانية (0.005s).")
        
    if "زمن الفحص المباشر لقاعدة البيانات البعيدة:" in p.text:
        p.text = ""
        r_d1 = p.add_run("▪ زمن الفحص المباشر لقاعدة البيانات البعيدة: ")
        r_d2 = p.add_run("استغرق فحص الخادم الحي عبر بروتوكول آمن متوسط 3.42 ثانية، شمل استعلام مخططات pg_proc وinformation_schema ومقارنة ")
        r_d3 = p.add_run("228 كائناً")
        highlight_run(r_d3)
        r_d4 = p.add_run(" موزعة على المخططين public وitpc (128 دالة RPC مخزنة، 91 جدولاً، 9 حاويات تخزين).")

# =========================================================================
# 9. Add Section 6.5 (Second Clinical Incident)
# =========================================================================
target_p_idx = -1
for i, p in enumerate(doc.paragraphs):
    if "7. المقارنة التحليلية مع الأطر الهندسية المعاصرة" in p.text:
        target_p_idx = i
        break

if target_p_idx != -1:
    p_comp = doc.paragraphs[target_p_idx]
    p65 = p_comp.insert_paragraph_before()
    p65.style = doc.paragraphs[target_p_idx - 1].style
    
    r65_title = p65.add_run("6.5 واقعة سريرية ثانية: كشف فجوة «الربط المتأخر وهلوسة المخطط النمطي» (Late-Binding & Prior Schema Hallucination Incident) وتطور المحرك الحتمي (v3.0)\n")
    highlight_run(r65_title)
    
    sec65_text = (
        "عقب سد ثغرة التجاوز السيادي، برزت واقعة سريرية ميدانية أخرى أثناء تطوير ميزة «التحقق الرقمي العام من وثائق الخدمة عبر رمز الاستجابة السريعة (QR Verification Engine)» التابعة لنواة الموارد البشرية (BE-HR-01). "
        "قام وكيل الذكاء الاصطناعي ببناء دالة خادم مركزية جديدة بالكامل (public.verify_continuity_letter)، واستوفت الدالة ظاهرياً كافة متطلبات الحوكمة المعمارية الصارمة: إذ نُسبت للنواة المصرح بها حصراً، واقترنت بمالك تشغيلي معتمد (supabase_admin)، وانعدمت فيها التعديات العابرة، واجتازت ملفات الواجهة فحص الأنواع (tsc) بنجاح 100%، وسُجلت الدالة في كتالوج قاعدة البيانات.\n"
        "ولكن بمجرد إجراء الفحص الميداني الفعلي عبر مسح رمز الـ QR بهاتف ذكي خارجي، توقف الاستعلام من طرف خادم PostgreSQL وأرجع الخطأ الصريح:\n"
        "                                                                column \"job_title\" does not exist\n"
        "كشف التحقيق المعماري في جذر العطل عن ظاهرتين متقاطعتين في بيئات التطوير الهجين:\n"
        "1. الهلوسة الدلالية للمخططات النمطية (Semantic Prior Schema Hallucination): اعتمد وكيل الذكاء الاصطناعي على استدعاء حقول نمطية شائعة إحصائياً في أنظمة الموارد البشرية (job_title و department) دون إجراء تأصيل مرجعي حقيقي (Schema Grounding) لفحص أسماء الأعمدة الفعلية المعتمدة في بنية جدول ملفات الموظفين (profiles) وهي (section_text و dept_text).\n"
        "2. فخ الربط المتأخر في محركات قواعد البيانات (Late-Binding Resolution Trap): يقبل محرك PostgreSQL إنشاء وترجمة الدوال المخزنة (PL/pgSQL) طالما كان البناء النحوي سليماً، ويؤجل مطابقة أسماء الأعمدة الداخلية إلى لحظة الاستدعاء التنفيذي الحي (Runtime Invocation).\n"
        "أثبتت هذه الحادثة أن الحوكمة الكتالوجية والسيادية (v2.0) تظل قاصرة ما لم تقترن بإلزام حتمي للتأصيل الهيكلي وفحص تنفيذي دخاني (Smoke Execution Gate). وعلى إثر ذلك، طُوّر الإصدار الثالث للمحرك الحتمي (v3.0) بإضافة الخوارزمية الفرعية للتأصيل الهيكلي، وإلزام تشغيل استدعاء دخاني محمي لكل دالة RPC جديدة داخل معاملة معزولة (Transaction Rollback) قبل منح إذن الاعتماد النهائي (--snapshot)، مما حقق درعاً ثلاثياً متكاملاً: هيكلياً، وسيادياً، وتأصيلياً."
    )
    r65_body = p65.add_run(sec65_text)
    highlight_run(r65_body)

# =========================================================================
# 10. Update Table 14 (Comparative Analysis Table - Row 7 for BRICK)
# =========================================================================
for tbl in doc.tables:
    if len(tbl.rows) > 0 and "الأداة / الإطار المقارن" in tbl.cell(0, 0).text:
        brick_row_cells = tbl.rows[7].cells
        brick_name_cell = brick_row_cells[0]
        brick_scope_cell = brick_row_cells[1]

        brick_name_cell.text = ""
        r_bname = brick_name_cell.paragraphs[0].add_run("إطار B.R.I.C.K (v3.0 - العمل المقترح)")
        highlight_run(r_bname)

        brick_scope_cell.text = ""
        r_bscope = brick_scope_cell.paragraphs[0].add_run("أنوية عابرة للطبقات محصنة سيادياً وتأصيلياً (Cross-Layer, Sovereign & Schema-Grounded)")
        highlight_run(r_bscope)
        break

# =========================================================================
# 11. Update Section 8.1 (Limitations) and 9 (Conclusion)
# =========================================================================
for p in doc.paragraphs:
    if "نظام حراسة معماري وتشفيري وسيادي عميق" in p.text:
        p.text = ""
        r_lim1 = p.add_run("يُعد إطار B.R.I.C.K وحارسه الحتمي ")
        r_lim2 = p.add_run("«نظام حراسة معماري وتشفيري وسيادي وتأصيلي ثلاثي الأبعاد» (Architectural, Sovereign & Schema-Grounded Sentinel v3.0)، ")
        highlight_run(r_lim2)
        r_lim3 = p.add_run("وهو مصمم لحماية النظام من التدهور المعماري، والتسلل العشوائي، والملفات السائبة، والتجاوز السيادي، وهلوسات المخططات النمطية الناتجة عن الربط المتأخر. ولكنه ليس قارئاً للنيات والأفكار البشرية الداخلية:")
        break

for p in doc.paragraphs:
    if "قدمت هذه الورقة إطار عمل B.R.I.C.K" in p.text:
        p.text = ""
        r_c1 = p.add_run("قدمت هذه الورقة إطار عمل B.R.I.C.K ومحرك الإنفاذ الحتمي كنموذج هندسي موحد لحوكمة المعمارية البرمجية عبر الطبقات وضبط بيئات التطوير الهجين بين المطور البشري والوكلاء الأذكياء. من خلال الاعتراف الصادق بحدود الذاكرة البشرية وبالطبيعة الاحتمالية للنماذج الذكية، يضع الإطار درعاً حتمياً قائماً على أسس رياضية وتشفيرية صارمة لا تقبل النسيان ولا الهلوسة. وبفضل مرونته المزدوجة التي تدعم بيئات العمل السحابية والترابطية بقدر ما تدعم البيئات المعزولة محلياً (Air-Gapped)، ")
        r_c2 = p.add_run("وتطوره الميداني عبر ثلاثة أجيال حتمية سدت ثغرات التجاوز السيادي والربط المتأخر (v1.0 -> v2.0 -> v3.0)، واستناده إلى بروتوكول اعتماد مشروط مدعوم بفحص دخاني تنفيذي للأعمدة وقواعد البيانات، ")
        highlight_run(r_c2)
        r_c3 = p.add_run("أثبت الإطار نجاعته المطلقة في القضاء على الانحرافات والتعديلات الجانبية، مؤكداً أن الحتمية الرياضية والسيادية والتأصيلية هي الضمانة الوحيدة لاستقرار البرمجيات في عصر الذكاء الاصطناعي.")
        break

doc.save(dst_path)
print(f"Successfully generated clean v0.3 with perfected formula box and synchronized metrics at:\n{dst_path}")
