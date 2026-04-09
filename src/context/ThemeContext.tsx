import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
    theme: "light",
    toggleTheme: () => { },
});

const THEME_VERSION = "v2_light_default";

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    // Default to light as requested
    const [theme, setTheme] = useState<Theme>(() => {
        const storedVersion = localStorage.getItem("app_theme_version");
        const storedTheme = localStorage.getItem("app_theme");

        // Migration: If user hasn't seen the light-default version yet, force light
        if (storedVersion !== THEME_VERSION) {
            localStorage.setItem("app_theme_version", THEME_VERSION);
            localStorage.setItem("app_theme", "light");
            return "light";
        }

        return (storedTheme as Theme) || "light";
    });

    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove("light", "dark");
        root.classList.add(theme);
        localStorage.setItem("app_theme", theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme((prev) => (prev === "dark" ? "light" : "dark"));
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
