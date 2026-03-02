// src/components/SoldierNameSearch.js

'use client';
import { useState, useEffect, useRef } from 'react';
import { getSoldiersWithCache } from '@/lib/soldierDataService';
import colors from '../app/colors';

const FULL_NAME_COL = 'שם מלא                                  (מילוי אוטומטי: לא לגעת)';
const ID_COL = 'מספר זהות';
const ROOM_COL = 'חדר';

/**
 * Soldier Search Component — search by name or ID number.
 * Loads all soldiers once and filters client-side for instant results.
 */
export default function SoldierNameSearch({
  onSoldierSelect,
  onLoadingChange,
  placeholder = 'חיפוש לפי שם או ת.ז...',
  disabled = false,
  error = null
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [allSoldiers, setAllSoldiers] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSoldier, setSelectedSoldier] = useState(null);

  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  // Load all soldiers once on mount (single API call, then instant client-side search)
  useEffect(() => {
    let cancelled = false;
    getSoldiersWithCache()
      .then((soldiers) => {
        if (!cancelled) {
          setAllSoldiers(soldiers || []);
        }
      })
      .catch((err) => {
        console.error('Error loading soldiers:', err);
        if (!cancelled) setAllSoldiers([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    onLoadingChange?.(isLoading);
  }, [isLoading, onLoadingChange]);

  // Filter soldiers by name or ID (client-side, instant)
  const filterSoldiers = (term) => {
    const t = String(term || '').trim();
    if (t.length < 1) return [];

    const tLower = t.toLowerCase();
    const isNumeric = /^\d+$/.test(t);

    return allSoldiers.filter((s) => {
      const fullName = String(s[FULL_NAME_COL] || s.fullName || '').replace(/\s+/g, ' ').trim();
      const idNum = String(s[ID_COL] || s.idNumber || '').trim();

      if (isNumeric) {
        return idNum.includes(t) || idNum.endsWith(t) || idNum.startsWith(t);
      }
      const nameWords = fullName.toLowerCase().split(/\s+/).filter(Boolean);
      const searchWords = tLower.split(/\s+/).filter(Boolean);
      return searchWords.every((sw) =>
        nameWords.some((nw) => nw.includes(sw) || nw.startsWith(sw))
      );
    });
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);

    if (value.trim().length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const results = filterSoldiers(value);
    setSuggestions(results);
    setShowSuggestions(true);
  };

  const handleSuggestionClick = (soldier) => {
    const name = soldier[FULL_NAME_COL] || soldier.fullName || '';
    setSearchTerm(name);
    setSelectedSoldier(soldier);
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
    setSelectedSoldier(null);
    setSuggestions([]);
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
          disabled={disabled || isLoading}
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
        
        {/* Loading indicator (initial soldier list) */}
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
          ref={suggestionsRef}
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
      {showSuggestions && suggestions.length === 0 && searchTerm.trim().length >= 1 && !isLoading && (
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
