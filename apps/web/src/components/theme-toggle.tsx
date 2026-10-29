import { Button } from "@workspace/ui/components/button";
import { useTheme, type Theme } from "@workspace/ui/components/theme-provider";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";

const NEXT: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
const ICONS = { light: SunIcon, dark: MoonIcon, system: MonitorIcon };

/** Cycles through light, dark and the system's theme. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const Icon = ICONS[theme];
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={`Theme: ${theme}. Switch to ${NEXT[theme]}.`}
      title={`Theme: ${theme}`}
      onClick={() => setTheme(NEXT[theme])}
    >
      <Icon />
    </Button>
  );
}
