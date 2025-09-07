'use client';

import { useState, useEffect } from 'react';
import { searchUsers } from '@/lib/database';
import { debounce } from 'lodash';
import colors from '../app/colors';

export default function SoldierSearch({ onSelectSoldier, onSearchResults }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchType, setSearchType] = useState('text'); // 'text' or 'date'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Simple text search
  const handleTextSearch = async (term) => {
    if (!term || term.trim().length < 2) {
      setSearchResults([]);
      if (onSearchResults) onSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchUsers(term);
      setSearchResults(results);
      if (onSearchResults) onSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
      if (onSearchResults) onSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Date range search
  const handleDateSearch = async () => {
    if (!startDate || !endDate) {
      alert('Please select both start and end dates');
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchUsers('', { startDate, endDate });
      setSearchResults(results);
      if (onSearchResults) onSearchResults(results);
    } catch (error) {
      console.error('Date search error:', error);
      setSearchResults([]);
      if (onSearchResults) onSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced text search
  const debouncedSearch = debounce(handleTextSearch, 300);

  useEffect(() => {
    if (searchType === 'text') {
      debouncedSearch(searchTerm);
    }
    return () => debouncedSearch.cancel();
  }, [searchTerm, searchType]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setShowResults(value.length > 0);
    if (value.length === 0) {
      setSearchResults([]);
      if (onSearchResults) onSearchResults([]);
    }
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
    setSearchResults([]);
    setShowResults(false);
    if (onSearchResults) onSearchResults([]);
  };

  return (
    <div className="relative">
      {/* Search Type Toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setSearchType('text')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-105 ${
            searchType === 'text' 
              ? 'text-white' 
              : 'text-gray-700'
          }`}
          style={{ 
            background: searchType === 'text' ? colors.primaryGreen : 'transparent',
            border: searchType === 'text' ? 'none' : `2px solid ${colors.primaryGreen}`,
            color: searchType === 'text' ? colors.white : colors.primaryGreen,
            boxShadow: searchType === 'text' ? '0 4px 12px rgba(7, 99, 50, 0.3)' : 'none'
          }}
        >
          Text Search
        </button>
        <button
          onClick={() => setSearchType('date')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-105 ${
            searchType === 'date' 
              ? 'text-white' 
              : 'text-gray-700'
          }`}
          style={{ 
            background: searchType === 'date' ? colors.primaryGreen : 'transparent',
            border: searchType === 'date' ? 'none' : `2px solid ${colors.primaryGreen}`,
            color: searchType === 'date' ? colors.white : colors.primaryGreen,
            boxShadow: searchType === 'date' ? '0 4px 12px rgba(7, 99, 50, 0.3)' : 'none'
          }}
        >
          Date Range
        </button>
      </div>

      {/* Text Search */}
      {searchType === 'text' && (
        <div className="relative mb-4">
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search by name, phone, room, unit, battalion, personal number..."
            className="w-full pl-4 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
          />
          
          {searchTerm && (
            <button
              onClick={handleClearSearch}
              className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Date Range Search */}
      {searchType === 'date' && (
        <div className="mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
            </div>
          </div>
          <button
            onClick={handleDateSearch}
            disabled={!startDate || !endDate || isSearching}
            className="w-full py-3 px-4 rounded-xl font-semibold transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ 
              background: colors.primaryGreen, 
              color: colors.white,
              boxShadow: '0 4px 12px rgba(7, 99, 50, 0.3)'
            }}
          >
            {isSearching ? 'Searching...' : 'Search by Date Range'}
          </button>
        </div>
      )}

    </div>
  );
}
