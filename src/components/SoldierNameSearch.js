// src/components/SoldierNameSearch.js

'use client';
import { useState, useEffect, useRef } from 'react';
import { searchSoldiersByName } from '@/lib/soldierDataService';
import colors from '../app/colors';

/**
 * Soldier Name Search Component
 * Provides autocomplete functionality for selecting soldiers from Google Sheets
 */
export default function SoldierNameSearch({ 
  onSoldierSelect, 
  placeholder = "חיפוש לפי שם מלא...",
  disabled = false,
  error = null 
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSoldier, setIsLoadingSoldier] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSoldier, setSelectedSoldier] = useState(null);
  
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Debounced search function
  const performSearch = async (term) => {
    if (term.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoading(true);
    try {
      const results = await searchSoldiersByName(term);
      
      setSuggestions(results);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Error searching soldiers:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle input change with debouncing
  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Set new timeout for search
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  };

  // Handle suggestion selection
  const handleSuggestionClick = (soldier) => {
    setSearchTerm(soldier.fullName || soldier['שם מלא                                  (מילוי אוטומטי: לא לגעת)'] || '');
    setSelectedSoldier(soldier);
    setShowSuggestions(false);
    setSuggestions([]);
    
    // Use the soldier data we already have from the search
    onSoldierSelect(soldier);
  };

  // Handle input focus
  const handleInputFocus = () => {
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  // Handle input blur
  const handleInputBlur = (e) => {
    // Delay hiding suggestions to allow clicking on them
    setTimeout(() => {
      setShowSuggestions(false);
    }, 150);
  };

  // Handle key navigation
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setShowSuggestions(false);
      inputRef.current?.blur();
    }
  };

  // Clear selection
  const clearSelection = () => {
    setSearchTerm('');
    setSelectedSoldier(null);
    setSuggestions([]);
    setShowSuggestions(false);
    onSoldierSelect(null);
    inputRef.current?.focus();
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="relative w-full">
      {/* Input Field */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchTerm || ''}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={`
            w-full px-4 py-3 border-2 rounded-lg text-right
            focus:outline-none focus:ring-2 focus:ring-opacity-50
            transition-all duration-200
            ${error 
              ? 'border-red-500 focus:ring-red-500' 
              : 'border-gray-300 focus:ring-blue-500'
            }
            ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
          `}
          style={{
            fontSize: '1.1rem',
            fontWeight: 500,
            direction: 'rtl' // Ensure Hebrew text displays correctly
          }}
        />
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
          </div>
        )}
        
        {/* Loading soldier data indicator */}
        {isLoadingSoldier && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-green-500 border-t-transparent"></div>
          </div>
        )}
        
        {/* Clear button */}
        {searchTerm && !disabled && (
          <button
            type="button"
            onClick={clearSelection}
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {suggestions.map((soldier, index) => (
            <div
              key={`${soldier.fullName || 'soldier'}-${index}`}
              onClick={() => handleSuggestionClick(soldier)}
              className="px-4 py-3 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
            >
              <div className="text-right">
                <div className="font-medium text-gray-900" style={{ fontSize: '1rem' }}>
                  {soldier.fullName || soldier['שם מלא                                  (מילוי אוטומטי: לא לגעת)'] || 'No name'}
                </div>
                {(soldier.roomNumber || soldier['חדר']) && (
                  <div className="text-sm text-gray-500 mt-1">
                    חדר: {soldier.roomNumber || soldier['חדר']}
                    {(soldier.building || soldier['בניין']) && `, בניין: ${soldier.building || soldier['בניין']}`}
                    {(soldier.floor || soldier['קומה']) && `, קומה: ${soldier.floor || soldier['קומה']}`}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No results message */}
      {showSuggestions && suggestions.length === 0 && searchTerm.length >= 2 && !isLoading && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 text-center text-gray-500">
          לא נמצאו תוצאות עבור &quot;{searchTerm}&quot;
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mt-2 text-sm text-red-600 text-right">
          {error}
        </div>
      )}
    </div>
  );
}
