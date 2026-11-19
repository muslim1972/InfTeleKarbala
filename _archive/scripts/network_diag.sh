#!/bin/bash
echo "=============================================="
echo "    فحص الاتصال الشبكي الشامل لسيرفر كربلاء    "
echo "           $(date)          "
echo "=============================================="

echo -e "\n--- 1. فحص توجيه الشبكة والـ Gateway ---"
ip route show

echo -e "\n--- 2. فحص حل أسماء النطاقات (DNS Resolution) ---"
for domain in "onesignal.com" "api.onesignal.com" "cdn.onesignal.com" "info-tele-karbala-l87sl248.livekit.cloud" "google.com"; do
    printf "%-40s : " "$domain"
    getent ahosts "$domain" | awk '{print $1}' | head -n 1 || echo "DNS FAILED"
done

echo -e "\n--- 3. فحص البينغ الخارجي (ICMP Outbound) ---"
for target in "8.8.8.8" "1.1.1.1"; do
    printf "Ping %-15s : " "$target"
    ping -c 2 -W 3 "$target" > /dev/null 2>&1 && echo "SUCCESS (Reachable)" || echo "FAILED (Unreachable / Blocked)"
done

echo -e "\n--- 4. فحص اتصال منافذ TCP 443 بخدمات OneSignal (Push Notifications) ---"
for host in "onesignal.com" "api.onesignal.com" "cdn.onesignal.com"; do
    echo "[+] فحص $host:443 عبر nc:"
    nc -zv -w 5 "$host" 443 2>&1

    echo "[+] فحص $host عبر curl (HTTPS):"
    curl -I -s --connect-timeout 5 --max-time 8 "https://$host" 2>&1 | head -n 5 || echo "Curl Failed / Timeout"
    echo "----------------------------------------------"
done

echo -e "\n--- 5. فحص اتصال خادم الاتصال الصوتي والمرئي LiveKit Cloud ---"
lk_host="info-tele-karbala-l87sl248.livekit.cloud"
echo "[+] فحص $lk_host:443 (Signaling):"
nc -zv -w 5 "$lk_host" 443 2>&1
echo "[+] فحص $lk_host:7880:"
nc -zv -w 5 "$lk_host" 7880 2>&1

echo -e "\n--- 6. فحص هل يوجد خادم LiveKit يعمل محلياً داخل السيرفر (Port 7880) ---"
ss -tulpn | grep 7880 || echo "لا يوجد خادم LiveKit يستمع محلياً على المنفذ 7880"

echo -e "\n--- 7. فحص جدار الحماية المحلي داخل السيرفر (iptables / nftables) ---"
echo "قواعد UFW (إن وجدت):"
which ufw > /dev/null && sudo ufw status || echo "UFW غير مفعل أو غير مثبت"

echo -e "\n=============================================="
echo "               نهاية تقرير الفحص              "
echo "=============================================="
