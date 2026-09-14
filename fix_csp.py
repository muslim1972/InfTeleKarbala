import sys

file_path = '/home/muslim/inftelekarbala/spa_server.py'
with open(file_path, 'r') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'self.send_header(''Content-Security-Policy''' in line:
        lines[i] = f"        self.send_header('Content-Security-Policy', \"{csp}\")\n"

with open(file_path, 'w') as f:
    f.writelines(lines)
