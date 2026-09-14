import os
file_path = '/home/muslim/inftelekarbala/spa_server.py'
with open(file_path, 'r') as f:
    content = f.read()
csp = "default-src 'self'; script-src 'self' https://*.azureedge.net https://cdn.onesignal.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https://*; connect-src 'self' wss://* ws://* https://* http://*; media-src 'self' blob:; object-src 'none'; frame-ancestors 'self' https://*.khr-itpc.egov.iq; worker-src 'self' blob:; frame-src 'self'; form-action 'self';"
content = content.replace(\"self.send_header('Content-Security-Policy', \\\"frame-ancestors 'self' https://khr-itpc.egov.iq https://*.khr-itpc.egov.iq\\\")\", f\"self.send_header('Content-Security-Policy', \\\"{csp}\\\")\")
with open(file_path, 'w') as f:
    f.write(content)
