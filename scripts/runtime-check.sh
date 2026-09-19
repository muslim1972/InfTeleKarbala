#!/bin/bash
# فحص تشغيلي: البناء الجديد + إصلاح انهيار useGovernorate + عزل مواقع العمل
echo "== مراجع index.html المقدَّم =="
curl -s http://127.0.0.1/ | grep -oE 'assets/index-[A-Za-z0-9_-]+\.(js|css)' | head -4
echo "== إصلاح الانهيار: المرجع المكسور useGovernorate في حزم الدخول الحالية يجب أن يكون 0 =="
printf 'broken identifier occurrences (must be 0): '
curl -s http://127.0.0.1/assets/index-Cc1R3f3f.js http://127.0.0.1/assets/index-BIimG4Tc.js | grep -o 'useGovernorate' | wc -l
echo "== جلب حزم المحاكي =="
curl -s -o /dev/null -w 'workspace_new:%{http_code}\n' http://127.0.0.1/assets/FiberSimulatorWorkspace-CjvnVPX8.js
curl -s -o /dev/null -w 'launcher_new:%{http_code}\n' http://127.0.0.1/assets/FiberSimulatorLauncher-8EPZQoyE.js
echo "== إصلاح بحث الحوافز: عزل isDeveloperOrGeneral بالمحافظة =="
printf 'IncentivesTabContent governorate occurrences: '
curl -s http://127.0.0.1/assets/IncentivesTabContent-DD23ZvFb.js | grep -o 'governorate' | wc -l
curl -s -o /dev/null -w 'incentives_http:%{http_code}\n' http://127.0.0.1/assets/IncentivesTabContent-DD23ZvFb.js
echo "== عزل المحافظات: useMediaContent fail-closed (في حزمة Dashboard) =="
curl -s http://127.0.0.1/assets/Dashboard-D-Nh_prB.js | grep -c 'governorate required' || true
echo "== عزل المحافظات: حارس governorate في كتّاب المحتوى (يجب 1 لكل بند) =="
printf 'PollCreator guard: '
curl -s http://127.0.0.1/assets/PollCreator-grbIGJxs.js | grep -c 'لم يتم تحديد المحافظة' || true
printf 'MediaSectionEditor guard: '
curl -s http://127.0.0.1/assets/MediaSectionEditor-HQHxWWdc.js | grep -c 'لم يتم تحديد المحافظة' || true
printf 'TipsEditor guard: '
curl -s http://127.0.0.1/assets/TipsEditor-DxacFPGx.js | grep -c 'لم يتم تحديد المحافظة' || true
printf 'TraineePollSettings guard (SummerTrainingPage): '
curl -s http://127.0.0.1/assets/SummerTrainingPage-DzOxxWjc.js | grep -c 'لم يتم تحديد المحافظة' || true
echo "== الشريط الإخباري: بلا fallback كربلاء (activeGovernorate موجودة) =="
curl -s http://127.0.0.1/assets/TipsMarquee-D-CVeJx9.js | grep -c 'selectedGovernorate\|activeGovernorate' || true
echo "== عزل مواقع العمل: حزمة إعدادات الحضور (مواقع العمل + ختم governorate) =="
printf 'work locations UI: '
curl -s http://127.0.0.1/assets/index-BIimG4Tc.js | grep -c 'مواقع العمل' || true
printf 'governorate stamp occurrences: '
curl -s http://127.0.0.1/assets/index-BIimG4Tc.js | grep -o 'governorate' | wc -l
