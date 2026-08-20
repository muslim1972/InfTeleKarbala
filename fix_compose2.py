import sys
import yaml

filepath = "/home/muslim/inftelekarbala/supabase/docker/docker-compose.yml"
with open(filepath, 'r') as f:
    lines = f.readlines()

final_lines = []
for line in lines:
    final_lines.append(line)
    if "container_name: supabase-edge-functions" in line:
        indent = line[:len(line) - len(line.lstrip())]
        final_lines.append(indent + "extra_hosts:\n")
        final_lines.append(indent + "  - \"api.onesignal.com:104.17.111.223\"\n")
        final_lines.append(indent + "  - \"onesignal.com:104.17.111.223\"\n")

with open(filepath, 'w') as f:
    f.writelines(final_lines)
