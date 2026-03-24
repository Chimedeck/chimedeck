// DiscoverPluginSearch — search + category filter for the Discover Plugins section.
// Debounces the search input (300ms) before notifying the parent.
import { useState, useEffect, useRef } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import translations from '../translations/en.json';

interface Props {
  searchQuery: string;
  selectedCategory: string | null;
  categories: string[];
  onSearchChange: (q: string) => void;
  onCategoryChange: (category: string | null) => void;
}

const DiscoverPluginSearch = ({
  searchQuery,
  selectedCategory,
  categories,
  onSearchChange,
  onCategoryChange,
}: Props) => {
  // [why] Local state drives the input; debounced value propagates to parent to avoid
  // firing a network request on every keystroke.
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync when parent clears the query externally (e.g. "Clear search")
  useEffect(() => {
    setLocalQuery(searchQuery);
  }, [searchQuery]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearchChange(value);
    }, 300);
  };

  return (
    <div className="flex flex-col sm:flex-row gap-2 mb-4">
      {/* Search input */}
      <div className="relative flex-1">
        <MagnifyingGlassIcon
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="text"
          value={localQuery}
          onChange={handleInputChange}
          placeholder={translations['plugins.searchBar.placeholder']}
          className="w-full pl-9 pr-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Category filter */}
      {categories.length > 0 && (
        <select
          value={selectedCategory ?? ''}
          onChange={(e) => onCategoryChange(e.target.value || null)}
          className="bg-slate-700 border border-slate-600 text-slate-200 text-sm rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:w-44"
        >
          <option value="">{translations['plugins.searchBar.allCategories']}</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      )}
    </div>
  );
};

export default DiscoverPluginSearch;
