'use client';

import { useState, useEffect } from 'react';
import { searchSoldiers } from '@/lib/database';
import { debounce } from 'lodash';

export default function SoldierSearch({ onSelectSoldier }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Debounced search function
  const debouncedSearch = debounce(async (term) => {
    if (!term || term.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchSoldiers(term);
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, 300);

  useEffect(() => {
    debouncedSearch(searchTerm);
    return () => debouncedSearch.cancel();
  }, [searchTerm]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setShowResults(value.length > 0);
  };

  const handleResultClick = (soldier) => {
    if (onSelectSoldier) {
      onSelectSoldier(soldier);
    }
    setShowResults(false);
    setSearchTerm('');
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setSearchResults([]);
    setShowResults(false);
  };

  const renderSearchResult = (soldier) => {
    return (
      <div 
        key={soldier.id}
        onClick={() => handleResultClick(soldier)}
        className="p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-blue-600 text-lg">👤</span>
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-gray-800 truncate">
                {soldier.basicInfo && soldier.basicInfo.fullName ? soldier.basicInfo.fullName : 'Unknown Name'}
              </h4>
              <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
                Soldier
              </span>
            </div>
            
            <div className="text-sm text-gray-600 mb-1">
              <span>ID: {soldier.id}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="relative">
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        
        <input
          type="text"
          value={searchTerm}
          onChange={handleSearchChange}
          placeholder="Search soldiers..."
          className="w-full pl-4 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        
        {searchTerm && (
          <button
            onClick={handleClearSearch}
            className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Search Results */}
      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto z-50">
          {isSearching ? (
            <div className="p-4 text-center text-gray-500">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
              Searching...
            </div>
          ) : searchResults.length > 0 ? (
            <div>
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-sm text-gray-600">
                Found {searchResults.length} results
              </div>
              {searchResults.map(renderSearchResult)}
            </div>
          ) : searchTerm.length >= 2 ? (
            <div className="p-4 text-center text-gray-500">
              No results found for "{searchTerm}"
            </div>
          ) : null}
        </div>
      )}

      {/* Search Tips */}
      {!searchTerm && (
        <div className="mt-2 text-xs text-gray-500">
          💡 Tip: Search by name, room number, ID, or other details
        </div>
      )}
    </div>
  );
}
