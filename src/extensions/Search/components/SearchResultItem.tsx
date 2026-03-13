// src/extensions/Search/components/SearchResultItem.tsx
// Renders a single search result — board tile or card row.
// Board results show a 32×20 px background thumbnail when available.
import React from 'react';
import { RectangleStackIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import type { SearchResult } from '../api';

interface SearchResultItemProps {
  result: SearchResult;
  onSelect: (result: SearchResult) => void;
  /** Ref forwarded to the underlying button — used by CommandPalette for keyboard focus management */
  buttonRef?: (el: HTMLButtonElement | null) => void;
  /** Keydown handler for arrow-key navigation — forwarded from CommandPalette */
  onKeyDown?: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
}

const SearchResultItem: React.FC<SearchResultItemProps> = ({
  result,
  onSelect,
  buttonRef,
  onKeyDown,
}) => {
  const isBoard = result.type === 'board';

  return (
    <button
      ref={buttonRef}
      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none dark:hover:bg-slate-700 dark:focus:bg-slate-700"
      onClick={() => onSelect(result)}
      onKeyDown={onKeyDown}
    >
      {isBoard && result.background ? (
        /* 32×20 px background thumbnail for board results */
        <span
          className="relative flex h-5 w-8 flex-shrink-0 overflow-hidden rounded"
          aria-hidden="true"
        >
          <img
            src={result.background}
            alt=""
            className="h-full w-full object-cover"
          />
        </span>
      ) : (
        <span
          className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-white ${
            isBoard ? 'bg-indigo-500' : 'bg-emerald-500'
          }`}
          aria-hidden="true"
        >
          {isBoard
            ? <RectangleStackIcon className="h-4 w-4" />
            : <DocumentTextIcon className="h-4 w-4" />}
        </span>
      )}
      <span className="truncate font-medium text-gray-800 dark:text-slate-200">{result.title}</span>
      <span className="ml-auto text-xs text-gray-400 dark:text-slate-500">{isBoard ? 'Board' : 'Card'}</span>
    </button>
  );
};

export default SearchResultItem;
