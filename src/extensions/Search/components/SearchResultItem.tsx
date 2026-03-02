// src/extensions/Search/components/SearchResultItem.tsx
// Renders a single search result — board tile or card row.
import React from 'react';
import type { SearchResult } from '../api';

interface SearchResultItemProps {
  result: SearchResult;
  onSelect: (result: SearchResult) => void;
}

const SearchResultItem: React.FC<SearchResultItemProps> = ({ result, onSelect }) => {
  const isBoard = result.type === 'board';

  return (
    <button
      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
      onClick={() => onSelect(result)}
    >
      <span
        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-xs font-bold text-white ${
          isBoard ? 'bg-indigo-500' : 'bg-emerald-500'
        }`}
        aria-hidden="true"
      >
        {isBoard ? 'B' : 'C'}
      </span>
      <span className="truncate font-medium text-gray-800">{result.title}</span>
      <span className="ml-auto text-xs text-gray-400">{isBoard ? 'Board' : 'Card'}</span>
    </button>
  );
};

export default SearchResultItem;
