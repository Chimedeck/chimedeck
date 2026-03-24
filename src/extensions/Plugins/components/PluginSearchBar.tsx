// PluginSearchBar — debounced search input + category dropdown + status filter for the plugin registry.
import { useState, useEffect, useRef } from 'react';
import translations from '../translations/en.json';
import type { RegistryStatus } from '../containers/PluginRegistryPage/PluginRegistryPage.duck';

interface Props {
  categories: string[];
  onSearchChange: (query: string) => void;
  onCategoryChange: (category: string | null) => void;
  onStatusChange?: (status: RegistryStatus) => void;
  searchQuery?: string;
  selectedCategory?: string | null;
  selectedStatus?: RegistryStatus;
}

const PluginSearchBar = ({
  categories,
  onSearchChange,
  onCategoryChange,
  onStatusChange,
  searchQuery = '',
  selectedCategory = null,
  selectedStatus = 'active',
}: Props) => {
  const [inputValue, setInputValue] = useState(searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external searchQuery reset (e.g. Clear button)
  useEffect(() => {
    setInputValue(searchQuery);
  }, [searchQuery]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearchChange(value);
    }, 300);
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onCategoryChange(value === '' ? null : value);
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onStatusChange?.(e.target.value as RegistryStatus);
  };

  const selectClass =
    'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500';

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        placeholder={translations['plugins.searchBar.placeholder']}
        className="flex-1 min-w-[180px] bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
      />
      <select
        value={selectedCategory ?? ''}
        onChange={handleCategoryChange}
        className={selectClass}
        aria-label={translations['plugins.searchBar.allCategories']}
      >
        <option value="">{translations['plugins.searchBar.allCategories']}</option>
        {categories.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
      </select>
      {onStatusChange && (
        <select
          value={selectedStatus}
          onChange={handleStatusChange}
          className={selectClass}
          aria-label={translations['plugins.searchBar.statusLabel']}
        >
          <option value="all">{translations['plugins.searchBar.statusAll']}</option>
          <option value="active">{translations['plugins.searchBar.statusActive']}</option>
          <option value="inactive">{translations['plugins.searchBar.statusInactive']}</option>
        </select>
      )}
    </div>
  );
};

export default PluginSearchBar;
