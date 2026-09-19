#!/bin/bash
# مقارنة بصمات MD5 بين القائمة المحلية وملفات dist على VPS
# الإدخال: /tmp/dist-local-md5.txt (سطر لكل ملف: "<md5> <مسار نسبي>")
# الإخراج: /tmp/dist-cmp.txt (SAME|DIFF|MISSING <مسار>) + ملخص
BASE=/home/muslim/inftelekarbala/dist
CR=$(printf '\r')
: > /tmp/dist-cmp.txt
while IFS=' ' read -r h p; do
  p="${p%"$CR"}"
  [ -z "$p" ] && continue
  f="$BASE$p"
  if [ -f "$f" ]; then
    rm=$(md5sum "$f" | awk '{print $1}')
    if [ "$rm" = "$h" ]; then
      echo "SAME $p" >> /tmp/dist-cmp.txt
    else
      echo "DIFF $p" >> /tmp/dist-cmp.txt
    fi
  else
    echo "MISSING $p" >> /tmp/dist-cmp.txt
  fi
done < /tmp/dist-local-md5.txt
echo "SAME=$(grep -c '^SAME' /tmp/dist-cmp.txt)"
echo "DIFF=$(grep -c '^DIFF' /tmp/dist-cmp.txt)"
echo "MISSING=$(grep -c '^MISSING' /tmp/dist-cmp.txt)"
