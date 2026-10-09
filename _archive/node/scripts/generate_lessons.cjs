const fs = require('fs');
const path = require('path');

// 1. Data Structure defined
const telecomData = {
  "placementQuiz": [
    {
      "id": "q1",
      "text": "ما هو الغرض الأساسي من استخدام كابلات الألياف الضوئية (Fiber Optics) في الشبكات؟",
      "options": [
        { "id": "q1o1", "text": "نقل الكهرباء لتشغيل الأجهزة الشبكية.", "points": 0 },
        { "id": "q1o2", "text": "نقل البيانات بسرعات عالية ولمسافات طويلة باستخدام نبضات الضوء.", "points": 1 },
        { "id": "q1o3", "text": "ربط الأجهزة اللاسلكية فقط.", "points": 0 }
      ]
    },
    {
      "id": "q2",
      "text": "ما هي الوظيفة الأساسية لبروتوكول DNS في الشبكة؟",
      "options": [
        { "id": "q2o1", "text": "توزيع عناوين IP بشكل ديناميكي.", "points": 0 },
        { "id": "q2o2", "text": "حماية الشبكة من الهجمات الخارجية.", "points": 0 },
        { "id": "q2o3", "text": "ترجمة أسماء النطاقات (مثل google.com) إلى عناوين IP.", "points": 1 }
      ]
    },
    {
      "id": "q3",
      "text": "أي من الأجهزة التالية يُستخدم لربط شبكات مختلفة مسارياً (Routing)؟",
      "options": [
        { "id": "q3o1", "text": "السويتش (Switch)", "points": 0 },
        { "id": "q3o2", "text": "الراوتر (Router)", "points": 1 },
        { "id": "q3o3", "text": "نقطة الوصول (Access Point)", "points": 0 }
      ]
    },
    {
      "id": "q4",
      "text": "في أنظمة التشغيل والشبكات، ما هو الغرض من استخدام أمر (Ping)؟",
      "options": [
        { "id": "q4o1", "text": "فحص وتحليل استقرارية الاتصال والوصول إلى جهاز آخر عبر الشبكة.", "points": 1 },
        { "id": "q4o2", "text": "تغيير إعدادات الراوتر.", "points": 0 },
        { "id": "q4o3", "text": "مسح الفيروسات من الحاسبة.", "points": 0 }
      ]
    },
    {
      "id": "q5",
      "text": "ما هو الفرق الرئيسي بين ترددي Wi-Fi (2.4GHz) و (5GHz)؟",
      "options": [
        { "id": "q5o1", "text": "تردد 5GHz يوفر مدى أبعد لكن سرعة أقل.", "points": 0 },
        { "id": "q5o2", "text": "تردد 2.4GHz يوفر سرعة أعلى للاتصالات المباشرة القريبة.", "points": 0 },
        { "id": "q5o3", "text": "تردد 5GHz يوفر سرعة أعلى وتداخلاً أقل، لكن بمدى أقصر مقارنة بـ 2.4GHz.", "points": 1 }
      ]
    },
    {
      "id": "q6",
      "text": "في الشبكات المؤسساتية، ما هي الفائدة من نظام الـ (VLAN)؟",
      "options": [
        { "id": "q6o1", "text": "عزل وتقسيم الشبكة المادية إلى شبكات منطقية منفصلة داخل نفس السويتش.", "points": 1 },
        { "id": "q6o2", "text": "ربط السيرفرات بالإنترنت الفضائي.", "points": 0 },
        { "id": "q6o3", "text": "تحويل الإشارة من تماثلية إلى رقمية.", "points": 0 }
      ]
    },
    {
      "id": "q7",
      "text": "في أنظمة توصيل الألياف للمنازل (FTTH)، ماذا يسمى الجهاز الرئيسي المركزي الموضوع في غرفة الاتصالات (البدالة)؟",
      "options": [
        { "id": "q7o1", "text": "ONT", "points": 0 },
        { "id": "q7o2", "text": "OLT", "points": 1 },
        { "id": "q7o3", "text": "Splitter", "points": 0 }
      ]
    },
    {
      "id": "q8",
      "text": "في المقابل لـ OLT، ماذا يسمى الجهاز النهائي الذي يتم تركيبه في بيت المواطن لخدمات الـ GPON؟",
      "options": [
        { "id": "q8o1", "text": "OLT", "points": 0 },
        { "id": "q8o2", "text": "ONT / ONU", "points": 1 },
        { "id": "q8o3", "text": "Media Converter", "points": 0 }
      ]
    },
    {
      "id": "q9",
      "text": "ما هو دور الـ (Subnet Mask) في الشبكة؟",
      "options": [
        { "id": "q9o1", "text": "تمييز أي جزء من الـ IP مخصص للشبكة وأي جزء مخصص للمضيف (Host).", "points": 1 },
        { "id": "q9o2", "text": "إخفاء الـ IP عن المخترقين.", "points": 0 },
        { "id": "q9o3", "text": "تحديد سرعة نقل البيانات الافتراضية للراوتر.", "points": 0 }
      ]
    },
    {
      "id": "q10",
      "text": "النطاق السعوي لعناوين (192.168.x.x) يُعتبر عادةً:",
      "options": [
        { "id": "q10o1", "text": "عناوين عامة (Public IPs) مخصصة للخوادم العالمية.", "points": 0 },
        { "id": "q10o2", "text": "عناوين خاصة (Private IPs) للاستخدام المكتبي والمنزلي للشبكات المحلية.", "points": 1 },
        { "id": "q10o3", "text": "عناوين بث (Broadcast) حصراً.", "points": 0 }
      ]
    },
    {
      "id": "q11",
      "text": "ما هو بروتوكول التوجيه الرئيسي (Routing Protocol) المستخدم لربط مزودي الخدمة (ISPs) ببعضهم وتشكيل شبكة الإنترنت؟",
      "options": [
        { "id": "q11o1", "text": "BGP (Border Gateway Protocol)", "points": 1 },
        { "id": "q11o2", "text": "OSPF (Open Shortest Path First)", "points": 0 },
        { "id": "q11o3", "text": "RIP (Routing Information Protocol)", "points": 0 }
      ]
    },
    {
      "id": "q12",
      "text": "بروتوكول OSPF يعتمد في احتساب أفضل مسار (Metric) للبيانات على مقياس:",
      "options": [
        { "id": "q12o1", "text": "عدد القفزات (Hop Count)", "points": 0 },
        { "id": "q12o2", "text": "الكلفة (Cost) المرتبطة بسرعة وعرض النطاق الترددي للمسار", "points": 1 },
        { "id": "q12o3", "text": "الوقت المستغرق بالملي ثانية فقط (Latency)", "points": 0 }
      ]
    },
    {
      "id": "q13",
      "text": "ماذا تعني تقنية DWDM في شبكات الألياف الضوئية الكبرى؟",
      "options": [
        { "id": "q13o1", "text": "توسيع سعة الكابل النحاسي ليعمل كألياف.", "points": 0 },
        { "id": "q13o2", "text": "تشفير الترددات لمنع التنصت.", "points": 0 },
        { "id": "q13o3", "text": "إرسال عدة إشارات منفصلة ومختلقة الألوان (الأطوال الموجية) داخل شعرة ليف ضوئي واحدة لمضاعفة السعة.", "points": 1 }
      ]
    },
    {
      "id": "q14",
      "text": "إذا طلب منك مدير الشبكة متابعة حمل السيرفر والراوترات برمجياً باستخدام Zabbix، فما هو البروتوكول القياسي المسؤول عن قراءة أداء المعدات؟",
      "options": [
        { "id": "q14o1", "text": "SNMP (Simple Network Management Protocol)", "points": 1 },
        { "id": "q14o2", "text": "SMTP (Simple Mail Transfer Protocol)", "points": 0 },
        { "id": "q14o3", "text": "SIP (Session Initiation Protocol)", "points": 0 }
      ]
    },
    {
      "id": "q15",
      "text": "تقنية التوجيه المتعدد البروتوكولات (MPLS) تعمل عملياً في أي طبقة وفقاً لنموذج OSI؟",
      "options": [
        { "id": "q15o1", "text": "الطبقة الثالثة كلياً (Network Layer)", "points": 0 },
        { "id": "q15o2", "text": "الطبقة السابعة (Application Layer)", "points": 0 },
        { "id": "q15o3", "text": "بين الطبقة الثانية والثالثة (Layer 2.5)", "points": 1 }
      ]
    }
  ],
  "lessons": {
    "beginner": [
      { "id": "lesson_beg_01", "title": "مقدمة في عالم الاتصالات", "description": "تاريخ الاتصالات وتطور التقنيات", "fileName": "lesson_beg_01.json" },
      { "id": "lesson_beg_02", "title": "وسائط النقل النحاسية واللاسلكية", "description": "الكابلات بأنوعها والترددات اللاسلكية", "fileName": "lesson_beg_02.json" },
      { "id": "lesson_beg_03", "title": "أساسيات الألياف الضوئية", "description": "كيف يعمل الليف الضوئي؟ ولماذا السرعة الهائلة؟", "fileName": "lesson_beg_03.json" },
      { "id": "lesson_beg_04", "title": "نموذج OSI السبعة طبقات", "description": "كيف تتواصل حاسباتنا مع بعضها خطوة بخطوة؟", "fileName": "lesson_beg_04.json" },
      { "id": "lesson_beg_05", "title": "عناوين الـ IPv4", "description": "فهم العناوين (Public و Private)", "fileName": "lesson_beg_05.json" },
      { "id": "lesson_beg_06", "title": "الأجهزة الأساسية: السويتش والراوتر", "description": "الفرق بين السويتش والراوتر ومتى نستخدم كليهما", "fileName": "lesson_beg_06.json" },
      { "id": "lesson_beg_07", "title": "توبولوجيا الشبكات", "description": "أنماط وتصاميم ربط الأجهزة المادية", "fileName": "lesson_beg_07.json" },
      { "id": "lesson_beg_08", "title": "مفاهيم الإنترنت (DNS & HTTP)", "description": "كيف تفتح الموق الإلكتروني في متصفحك", "fileName": "lesson_beg_08.json" },
      { "id": "lesson_beg_09", "title": "أمن المعلومات الأساسي", "description": "الفيروسات وجدران الحماية (Firewall)", "fileName": "lesson_beg_09.json" },
      { "id": "lesson_beg_10", "title": "تقنيات Wi-Fi", "description": "ترددات الموجات والمداخل التوجيهية للإنترنت", "fileName": "lesson_beg_10.json" }
    ],
    "intermediate": [
      { "id": "lesson_int_01", "title": "تقسيم الشبكات (Subnetting)", "description": "رياضيات وحسابات الشبكات الفرعية", "fileName": "lesson_int_01.json" },
      { "id": "lesson_int_02", "title": "تقنيات الـ VLANs", "description": "الشبكات الوهمية لعزل الأقسام", "fileName": "lesson_int_02.json" },
      { "id": "lesson_int_03", "title": "تقنية GPON بالتفصيل", "description": "هيكلية الـ OLT والـ ONT والـ Splitters", "fileName": "lesson_int_03.json" },
      { "id": "lesson_int_04", "title": "بروتوكولات التوجيه المبدئية (OSPF)", "description": "كيفية معرفة الراوترات للمسارات المتاحة", "fileName": "lesson_int_04.json" },
      { "id": "lesson_int_05", "title": "كابلات الألياف المتقدمة وتوصيلاتها", "description": "الفرق بين السمكات وأنواع الموصلات (SC, LC)", "fileName": "lesson_int_05.json" },
      { "id": "lesson_int_06", "title": "نقل الصوت عبر الإنترنت (VoIP)", "description": "البدالات الرقمية وبروتوكول SIP و RTP", "fileName": "lesson_int_06.json" },
      { "id": "lesson_int_07", "title": "جودة الخدمة (QoS)", "description": "أولوية المرور للبيانات داخل الشبكة المعقدة", "fileName": "lesson_int_07.json" },
      { "id": "lesson_int_08", "title": "مراقبة الشبكات (Network Monitoring)", "description": "كيفية عمل Zabbix وأنظمة الـ SNMP", "fileName": "lesson_int_08.json" },
      { "id": "lesson_int_09", "title": "الحوسبة السحابية (Cloud Basics)", "description": "مراكز البيانات وأجهزة السيرفر التخيلية", "fileName": "lesson_int_09.json" },
      { "id": "lesson_int_10", "title": "أمن الشبكات المتوسط (VPNs)", "description": "طرق تشفير الاتصالات الممتدة", "fileName": "lesson_int_10.json" }
    ],
    "advanced": [
      { "id": "lesson_adv_01", "title": "تقنية DWDM السعوية", "description": "تصميم الأطوال الموجية ونقل الترافيك العالي", "fileName": "lesson_adv_01.json" },
      { "id": "lesson_adv_02", "title": "الشبكات المعرفة برمجياً (SDN)", "description": "فصل الطبقة التنفيذية عن طبقة البيانات", "fileName": "lesson_adv_02.json" },
      { "id": "lesson_adv_03", "title": "بروتوكول BGP والألياف الدولية", "description": "كيف تعمل بوابات الإنترنت بين الدول؟", "fileName": "lesson_adv_03.json" },
      { "id": "lesson_adv_04", "title": "هندسة شبكات الجيل الخامس (5G)", "description": "ألياف أبراج الاتصالات الحديثة (Fronthaul & Backhaul)", "fileName": "lesson_adv_04.json" },
      { "id": "lesson_adv_05", "title": "تقنية MPLS للتوجيه السريع", "description": "التغليف المتعدد لسرعة تحويل الحزم (Packets)", "fileName": "lesson_adv_05.json" },
      { "id": "lesson_adv_06", "title": "أتمتة الشبكات", "description": "برمجة أجهزة سيسكو ومايكروتك بالبايثون", "fileName": "lesson_adv_06.json" },
      { "id": "lesson_adv_07", "title": "الأمن السيبراني المتقدم", "description": "الهجمات الكبيرة (DDoS) وأنظمة الـ IDS/IPS", "fileName": "lesson_adv_07.json" },
      { "id": "lesson_adv_08", "title": "الحوسبة الطرفية (Edge Computing)", "description": "معالجة البيانات قريباً من المستخدم لتقليل التأخير", "fileName": "lesson_adv_08.json" },
      { "id": "lesson_adv_09", "title": "تصميم داتا سنتر الاتصالات", "description": "مبادئ الكابلات المنظمة وتبريد البدالات", "fileName": "lesson_adv_09.json" },
      { "id": "lesson_adv_10", "title": "مستقبل الاتصالات وإنترنت الأشياء", "description": "IPv6 وإدارة ملايين الحساسات التقنية بمديريات المجاري وغيرها", "fileName": "lesson_adv_10.json" }
    ]
  }
};

// 2. Paths Configuration
const TARGET_DIR = path.join(__dirname, '../public/data/knowledge');
const LESSONS_DIR = path.join(TARGET_DIR, 'lessons');

// Ensure directories exist
if (!fs.existsSync(TARGET_DIR)) fs.mkdirSync(TARGET_DIR, { recursive: true });
if (!fs.existsSync(LESSONS_DIR)) fs.mkdirSync(LESSONS_DIR, { recursive: true });

// 3. Write telecomData.json
fs.writeFileSync(
  path.join(TARGET_DIR, 'telecomData.json'),
  JSON.stringify(telecomData, null, 2),
  'utf8'
);

// 4. Generate the 30 JSON files
const buildGenericLesson = (level, id, title) => {
    let sections = [
        { "id": "s1", "type": "title", "content": `مرحبًا بك في ${title}` },
        { "id": "s2", "type": "text", "content": "هذا الدرس هو جزء من المنظومة المعرفية الموسعة." },
        { "id": "s3", "type": "alert", "content": "قم بقراءة الدرس للاستفادة الكاملة من المادة التقنية.", "metadata": { "alertType": "info" } }
    ];

    // Add LaTeX math examples based on topic
    if (id === 'lesson_int_01') {
        sections.push({ "id": "s-math-1", "type": "text", "content": "مثال على معادلات السابنيتنج (Subnetting):" });
        sections.push({ "id": "s-math-2", "type": "math", "content": "\\text{Hosts per Subnet} = 2^{32 - \\text{CIDR}} - 2" });
    }

    if (id === 'lesson_adv_01') {
        sections.push({ "id": "s-math-1", "type": "text", "content": "معادلة سعة كابل الألياف نظرياً وفق قانون شانون-هارتلي:" });
        sections.push({ "id": "s-math-2", "type": "math", "content": "C = B \\log_2 \\left(1 + \\frac{S}{N}\\right)" });
    }

    return {
        id,
        level,
        title,
        sections
    };
};

['beginner', 'intermediate', 'advanced'].forEach(level => {
  telecomData.lessons[level].forEach(lesson => {
      const lessonPath = path.join(LESSONS_DIR, lesson.fileName);
      const output = buildGenericLesson(level, lesson.id, lesson.title);
      fs.writeFileSync(lessonPath, JSON.stringify(output, null, 2), 'utf8');
      console.log(`Generated: ${lesson.fileName}`);
  });
});

console.log("Successfully generated telecomData.json and all 30 lessons.");
