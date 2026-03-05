// PluginSearchBar — debounced search input + category dropdown for the plugin registry.
import { useState, useEffect, useRef } from 'react';

interface Props {
  categories: string[];
  onSearchChange: (query: string) => void;
  onCategoryChange: (category: string | null) => void;
  searchQuery?: string;
  selectedCategory?: string | null;
}

const PluginSearchBar = ({
  categories,
  onSearchChange,
  onCategoryChange,
  searchQuery = '',
  selectedCategory = null,
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

  return (
    <div className="flex gap-2 mb-4">
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        placeholder="Search plugins…"
        className="flex-1 bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
      />
      <select
        value={selectedCategory ?? ''}
        onChange={handleCategoryChange}
        className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
      >
        <option value="">All categories</option>
        {categories.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
      </select>
    </div>
  );
};

export default PluginSearchBar;
