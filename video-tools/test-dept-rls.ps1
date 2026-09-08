$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

function B64Url([byte[]]$b) {
  [Convert]::ToBase64String($b).TrimEnd('=').Replace('+','-').Replace('/','_')
}

$secret = ([System.IO.File]::ReadAllText('D:\InfTeleKarbala\video-tools\jwt.secret')).Trim()
$anon   = ([System.IO.File]::ReadAllText('D:\InfTeleKarbala\video-tools\anon.key')).Trim()

$uid = '27bc58c5-89c6-4c41-8597-d73bbbf8951d'  # رسل 102513365
$now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$header  = '{"alg":"HS256","typ":"JWT"}'
$payload = '{"sub":"' + $uid + '","role":"authenticated","aud":"authenticated","exp":' + ($now + 3600) + ',"iat":' + $now + '}'

$h = [System.Security.Cryptography.HMACSHA256]::new([System.Text.Encoding]::UTF8.GetBytes($secret))
$signing = (B64Url ([System.Text.Encoding]::UTF8.GetBytes($header))) + '.' + (B64Url ([System.Text.Encoding]::UTF8.GetBytes($payload)))
$sig = B64Url ($h.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($signing)))
$jwt = "$signing.$sig"

"JWT_LEN=$($jwt.Length)"

# 1) قراءة قسم رسل عبر departments (نفس استعلام الواجهة حرفياً)
$deptUrl = 'https://khr-itpc.egov.iq/rest/v1/departments?id=eq.f7b97974-c251-4eb9-b91f-4143ba08a38c&select=id,parent_id'
$r1 = curl.exe -s -w "`nHTTP:%{http_code}" $deptUrl -H "apikey: $anon" -H "Authorization: Bearer $jwt"
"--- departments read as Rusul (auth member of section) ---"
$r1

# 2) للمقارنة: get_own_profile تعمل؟
$profUrl = 'https://khr-itpc.egov.iq/rest/v1/rpc/get_own_profile'
$r2 = curl.exe -s -w "`nHTTP:%{http_code}" -X POST $profUrl -H "apikey: $anon" -H "Authorization: Bearer $jwt" -H "Content-Type: application/json" --data '{}'
"--- get_own_profile as Rusul ---"
$r2txt = $r2 -join "`n"
if ($r2txt.Length -gt 700) { $r2txt.Substring(0,700) } else { $r2txt }
