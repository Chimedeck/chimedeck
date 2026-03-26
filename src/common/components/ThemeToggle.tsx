import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import { useTheme } from '../hooks/useTheme';
import translations from '~/common/translations/en.json';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      aria-label={theme === 'dark' ? translations['Common.switchToLightMode'] : translations['Common.switchToDarkMode']}
      className="p-2 rounded-lg text-muted hover:text-base hover:bg-bg-overlay transition-colors"
    >
      {theme === 'dark' ? (
        <SunIcon className="w-5 h-5" />
      ) : (
        <MoonIcon className="w-5 h-5" />
      )}
    </button>
  );
}
