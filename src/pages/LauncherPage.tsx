import { Login } from "./Login";

interface LauncherPageProps {
    onProceed?: () => void;
    initialShowLogin?: boolean;
}

export const LauncherPage = (_props: LauncherPageProps) => {
    // مرحلة إطلاق Beta: تقتصر الواجهة على تسجيل الدخول المباشر لمديرية كربلاء المقدسة
    return <Login />;
};
