import sys
import yaml

filepath = "/home/muslim/inftelekarbala/supabase/docker/docker-compose.yml"
with open(filepath, 'r') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if "extra_hosts:\\n" in line:
        continue # skip broken lines
    if "extra_hosts:" in line and "\\n" in line:
        continue
    if ' khr-itpc.egov.iq:10.56.3.3' in line:
        continue
    new_lines.append(line)

# Cleaned up. Now insert extra_hosts for auth and storage
final_lines = []
for line in new_lines:
    final_lines.append(line)
    if "container_name: supabase-auth" in line or "container_name: supabase-storage" in line:
        indent = line[:len(line) - len(line.lstrip())]
        final_lines.append(indent + "extra_hosts:\n")
        final_lines.append(indent + "  - \"khr-itpc.egov.iq:10.56.3.3\"\n")

with open(filepath, 'w') as f:
    f.writelines(final_lines)
