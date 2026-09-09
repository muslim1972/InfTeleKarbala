#!/bin/bash
echo '=== kong env key names (masked) ==='
docker exec supabase-kong env | grep -iE 'key|role|anon' | sed 's/=.\{16\}.*/=<masked>/'
echo '=== kong.yml locations ==='
docker exec supabase-kong sh -c 'ls -la /tmp/ /var/lib/kong/ 2>/dev/null; ls /usr/local/share/kong/ 2>/dev/null' | head -20
