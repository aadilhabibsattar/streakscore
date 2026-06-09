import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { getProfile, updateProfileColor } from "@/lib/profile.functions";

type ThemeContextValue = {
  primaryColor: string;
  setPrimaryColor: (hex: string) => Promise<void>;
  loaded: boolean;
};

const DEFAULT_COLOR = "#10b981"; // Emerald

const ThemeContext = createContext<ThemeContextValue>({
  primaryColor: DEFAULT_COLOR,
  setPrimaryColor: async () => {},
  loaded: false,
});

function applyColor(hex: string) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--habit-accent", hex);
  root.style.setProperty("--grid-filled", hex);
  root.style.setProperty("--primary", hex);
  root.style.setProperty("--ring", hex);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [primaryColor, setColor] = useState<string>(DEFAULT_COLOR);
  const [loaded, setLoaded] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const p = await getProfile();
      setColor(p.primary_color);
      applyColor(p.primary_color);
    } catch {
      applyColor(DEFAULT_COLOR);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    applyColor(primaryColor);
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) loadProfile();
      else setLoaded(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) loadProfile();
      else {
        setColor(DEFAULT_COLOR);
        applyColor(DEFAULT_COLOR);
      }
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setPrimaryColor = useCallback(async (hex: string) => {
    setColor(hex);
    applyColor(hex);
    await updateProfileColor({ data: { primary_color: hex } });
  }, []);

  return (
    <ThemeContext.Provider value={{ primaryColor, setPrimaryColor, loaded }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
