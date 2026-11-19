#!/bin/bash
echo "=== تأكيد الفحص الثاني (Double Verification) ==="
date

echo "1. مسار الخروج (IP Route):"
ip route get 104.16.160.145

echo ""
echo "2. محاولة اتصال تفصيلية بـ api.onesignal.com:"
curl -v -m 5 https://api.onesignal.com 2>&1

echo ""
echo "3. محاولة اتصال عبر IPv4 الصريح بـ onesignal.com:"
curl -4 -v -m 5 https://onesignal.com 2>&1

echo ""
echo "4. فحص اتصال منفذ HTTPS القياسي بأي موقع خارجي (Google / Cloudflare):"
curl -I -m 5 https://www.google.com 2>&1 | head -n 5
curl -I -m 5 https://1.1.1.1 2>&1 | head -n 5

echo ""
echo "5. فحص خدمة LiveKit المحلية والشبكة:"
ss -tulpn | grep 7880
echo "فحص منافذ UDP لـ WebRTC (LiveKit RTC):"
ss -u -a | grep -E "788[0-9]|50000" | head -n 10

echo ""
echo "=== نهاية الفحص التأكيدي ==="
