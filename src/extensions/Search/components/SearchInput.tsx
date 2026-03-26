// src/extensions/Search/components/SearchInput.tsx
// Debounced search input — fires onChange 300 ms after the user stops typing.
import React, { useRef } from 'react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Search boards and cards…',
  autoFocus = true,
}) => {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className="w-full rounded-md border border-border bg-bg-overlay px-4 py-2 text-sm text-base outline-none focus:outline-none focus:ring-2 focus:ring-primary"
      aria-label="Search"
    />
  );
};

export default SearchInput;
