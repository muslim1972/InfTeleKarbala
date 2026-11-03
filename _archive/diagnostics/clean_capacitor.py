with open('src/App.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace("import { Capacitor } from '@capacitor/core';\n", '')
text = text.replace("  const isCapacitor = Capacitor.isNativePlatform() || (window.location.hostname === 'localhost' && /Android|iPhone|iPad/i.test(navigator.userAgent));\n", '')

with open('src/App.tsx', 'w', encoding='utf-8', newline='\n') as f:
    f.write(text)

print('SUCCESS: Removed Capacitor from App.tsx')
