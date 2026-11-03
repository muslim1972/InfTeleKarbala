with open('src/App.tsx', 'r', encoding='utf-8') as f:
    app_text = f.read()

# Replace LauncherPage call with direct Login for unauthenticated users
target_block = """  // إذا لم يكن هناك مستخدم، نعرض LauncherPage ونحدد هل تظهر صفحة الاختيار أم صفحة الدخول فوراً
  if (!user) {
    return (
      <LauncherPage 
        onProceed={() => {
          setHasProceeded(true);
          sessionStorage.setItem('hasChosenWeb', 'true');
        }}
        initialShowLogin={isStandalone || hasProceeded}
      />
    );
  }"""

new_block = """  // مرحلة إطلاق Beta: التطبيق ينهض من الـ Splash Screen مباشرة إلى واجهة تسجيل الدخول لكربلاء المقدسة
  if (!user) {
    return <Login />;
  }"""

if target_block in app_text:
    app_text = app_text.replace(target_block, new_block)
    print("SUCCESS: Replaced LauncherPage in App.tsx")
else:
    print("WARNING: target_block not found in App.tsx, checking variants...")
    import re
    app_text = re.sub(
        r'if\s*\(!user\)\s*\{\s*return\s*\(\s*<LauncherPage[\s\S]*?/>\s*\);\s*\}',
        '// مرحلة إطلاق Beta: التطبيق ينهض من الـ Splash Screen مباشرة إلى واجهة تسجيل الدخول لكربلاء المقدسة\n  if (!user) {\n    return <Login />;\n  }',
        app_text
    )
    print("Regex replaced in App.tsx")

with open('src/App.tsx', 'w', encoding='utf-8', newline='\n') as f:
    f.write(app_text)

# Also update LauncherPage.tsx so that it always defaults to Login without governorate picker
launcher_code = """import { Login } from "./Login";

interface LauncherPageProps {
    onProceed?: () => void;
    initialShowLogin?: boolean;
}

export const LauncherPage = (_props: LauncherPageProps) => {
    // مرحلة إطلاق Beta: تقتصر الواجهة على تسجيل الدخول المباشر لمديرية كربلاء المقدسة
    return <Login />;
};
"""

with open('src/pages/LauncherPage.tsx', 'w', encoding='utf-8', newline='\n') as f:
    f.write(launcher_code)
print("SUCCESS: Updated LauncherPage.tsx")
