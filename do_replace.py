import sys
content=sys.stdin.read()
target = '"frame-ancestors \'self\' https://khr-itpc.egov.iq https://*.khr-itpc.egov.iq"'
csp = '"default-src \'self\'; script-src \'self\' https://*.azureedge.net https://cdn.onesignal.com; style-src \'self\' \'unsafe-inline\' https://fonts.googleapis.com; font-src \'self\' data: https://fonts.gstatic.com; img-src \'self\' data: blob: https://*; connect-src \'self\' wss://* ws://* https://* http://*; media-src \'self\' blob:; object-src \'none\'; frame-ancestors \'self\' https://*.khr-itpc.egov.iq; worker-src \'self\' blob:; frame-src \'self\'; form-action \'self\'"'
content=content.replace(target, csp)
sys.stdout.write(content)
