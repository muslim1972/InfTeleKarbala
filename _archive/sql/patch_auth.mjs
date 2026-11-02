import fs from 'fs';

const filePath = 'D:/InfTeleKarbala/src/context/AuthContext.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

const target = "await supabase.from('login_logs').insert({";
const replacement = `const isStandalone = typeof window !== 'undefined' && (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://')
      );

      await supabase.from('login_logs').insert({`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  content = content.replace(
    "user_agent: navigator.userAgent",
    "user_agent: navigator.userAgent,\n        is_pwa: !!isStandalone"
  );
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log('AuthContext patched successfully');
} else {
  console.error('Target not found');
}
