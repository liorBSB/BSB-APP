// src/components/SoldierNameSearch.js

'use client';
import { useState, useEffect, useRef } from 'react';
import { searchSoldiersByName } from '@/lib/soldierDataService';

const FULL_NAME_COL = 'שם מלא                                  (מילוי אוטומטי: לא לגעת)';
const ID_COL = 'מספר זהות';
const ROOM_COL = 'חדר';

/**
 * Soldier Search Component — search by name or ID number.
 * Uses server-side search to avoid downloading full roster to clients.
 */
export default function SoldierNameSearch({
  onSoldierSelect,
  placeholder = 'חיפוש לפי שם או ת.ז...',
  disabled = false,
  error = null
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [queryError, setQueryError] = useState('');

  const inputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const normalized = searchTerm.trim();
    setQueryError('');

    if (normalized.length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      return () => { cancelled = true; };
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const results = await searchSoldiersByName(normalized);
        if (!cancelled) {
          setSuggestions(results);
          setShowSuggestions(true);
        }
      } catch (err) {
        if (!cancelled) {
          setSuggestions([]);
          setQueryError('Search is temporarily unavailable');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchTerm]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);

    if (value.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
  };

  const handleSuggestionClick = (soldier) => {
    const name = soldier[FULL_NAME_COL] || soldier.fullName || '';
    setSearchTerm(name);
    setShowSuggestions(false);
    setSuggestions([]);
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
    setSuggestions([]);
    setQueryError('');
    setShowSuggestions(false);
    onSoldierSelect(null);
    inputRef.current?.focus();
  };

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
              : 'border-gray-300 focus:ring-green-500'
            }
            ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
          `}
          style={{
            fontSize: '1.1rem',
            fontWeight: 500,
            direction: 'rtl' // Ensure Hebrew text displays correctly
          }}
        />
        
        {/* Small loading indicator while searching */}
        {isLoading && (
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
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
          style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
        >
          {suggestions.map((soldier, index) => {
            const idNum = String(soldier[ID_COL] || soldier.idNumber || '');
            const lastFour = idNum.length >= 4 ? idNum.slice(-4) : idNum;
            const name = soldier[FULL_NAME_COL] || soldier.fullName || '';
            const room = soldier[ROOM_COL] || soldier.roomNumber;
            return (
              <div
                key={`${idNum || name}-${index}`}
                onClick={() => handleSuggestionClick(soldier)}
                className="px-4 py-3 hover:bg-green-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors duration-150"
              >
                <div className="text-right">
                  <div className="font-medium text-gray-900 flex items-center justify-end gap-2" style={{ fontSize: '1rem' }}>
                    <span>{name || '—'}</span>
                    {lastFour && (
                      <span className="text-xs text-gray-400 font-normal" dir="ltr">
                        (ת.ז ...{lastFour})
                      </span>
                    )}
                  </div>
                  {room && (
                    <div className="text-sm text-gray-500 mt-1">
                      חדר: {room}
                      {(soldier['בניין'] || soldier.building) && `, בניין: ${soldier['בניין'] || soldier.building}`}
                      {(soldier['קומה'] || soldier.floor) && `, קומה: ${soldier['קומה'] || soldier.floor}`}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* No results message */}
      {showSuggestions && suggestions.length === 0 && searchTerm.trim().length >= 2 && !isLoading && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 text-center text-gray-500">
          לא נמצאו תוצאות עבור &quot;{searchTerm}&quot;
        </div>
      )}

      {/* Error message */}
      {(error || queryError) && (
        <div className="mt-2 text-sm text-red-600 text-right">
          {error || queryError}
        </div>
      )}
    </div>
  );
}
