# Clean Login.tsx
with open('src/pages/Login.tsx', 'r', encoding='utf-8') as f:
    login_text = f.read()

login_text = login_text.replace(
    'export const Login = ({ onBack }: { onBack?: () => void } = {}) => {',
    'export const Login = (_props: { onBack?: () => void } = {}) => {'
)
login_text = login_text.replace(
    '  const { activeGovernorate, setActiveGovernorate } = useGovernorate();',
    '  const { activeGovernorate } = useGovernorate();'
)

with open('src/pages/Login.tsx', 'w', encoding='utf-8', newline='\n') as f:
    f.write(login_text)

# Clean App.tsx
with open('src/App.tsx', 'r', encoding='utf-8') as f:
    app_text = f.read()

# Remove unused LauncherPage import
app_text = app_text.replace(
    'const LauncherPage = lazy(() => import("./pages/LauncherPage").then(m => ({ default: m.LauncherPage })));\n',
    ''
)
# Clean hasProceeded / isStandalone unused warnings if any
app_text = app_text.replace(
    "  const [hasProceeded, setHasProceeded] = useState(() => {\n    return sessionStorage.getItem('hasChosenWeb') === 'true';\n  });\n",
    ''
)
app_text = app_text.replace(
    "  const isStandalone = \n    window.matchMedia('(display-mode: standalone)').matches || \n    (window.navigator as any).standalone ||\n    isCapacitor;\n",
    ''
)

with open('src/App.tsx', 'w', encoding='utf-8', newline='\n') as f:
    f.write(app_text)

print('SUCCESS: Cleaned unused variables')
