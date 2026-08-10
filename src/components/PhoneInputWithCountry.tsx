'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLanguage } from '@/context/LanguageContext';

export interface CountryCode {
  code: string;
  nameEn: string;
  nameHe: string;
  flag: string;
  prefix: string;
  placeholder: string;
}

export const COUNTRIES: CountryCode[] = [
  { code: 'IL', nameEn: 'Israel', nameHe: 'ישראל', flag: '🇮🇱', prefix: '+972', placeholder: '050-123-4567' },
  { code: 'US', nameEn: 'United States / Canada', nameHe: 'ארה"ב / קנדה', flag: '🇺🇸', prefix: '+1', placeholder: '(555) 019-2834' },
  { code: 'GB', nameEn: 'United Kingdom', nameHe: 'בריטניה', flag: '🇬🇧', prefix: '+44', placeholder: '7911 123456' },
  { code: 'FR', nameEn: 'France', nameHe: 'צרפת', flag: '🇫🇷', prefix: '+33', placeholder: '6 12 34 56 78' },
  { code: 'DE', nameEn: 'Germany', nameHe: 'גרמניה', flag: '🇩🇪', prefix: '+49', placeholder: '151 12345678' },
  { code: 'AU', nameEn: 'Australia', nameHe: 'אוסטרליה', flag: '🇦🇺', prefix: '+61', placeholder: '412 345 678' },
  { code: 'AE', nameEn: 'United Arab Emirates', nameHe: 'איחוד האמירויות', flag: '🇦🇪', prefix: '+971', placeholder: '50 123 4567' },
  { code: 'RU', nameEn: 'Russia', nameHe: 'רוסיה', flag: '🇷🇺', prefix: '+7', placeholder: '912 345-67-89' },
  { code: 'UA', nameEn: 'Ukraine', nameHe: 'אוקראינה', flag: '🇺🇦', prefix: '+380', placeholder: '50 123 4567' },
  { code: 'CN', nameEn: 'China', nameHe: 'סין', flag: '🇨🇳', prefix: '+86', placeholder: '138 0013 8000' },
  { code: 'IN', nameEn: 'India', nameHe: 'הודו', flag: '🇮🇳', prefix: '+91', placeholder: '98123 45678' },
  { code: 'ES', nameEn: 'Spain', nameHe: 'ספרד', flag: '🇪🇸', prefix: '+34', placeholder: '612 34 56 78' },
  { code: 'IT', nameEn: 'Italy', nameHe: 'איטליה', flag: '🇮🇹', prefix: '+39', placeholder: '312 345 6789' },
  { code: 'NL', nameEn: 'Netherlands', nameHe: 'הולנד', flag: '🇳🇱', prefix: '+31', placeholder: '6 12345678' },
  { code: 'CH', nameEn: 'Switzerland', nameHe: 'שוויץ', flag: '🇨🇭', prefix: '+41', placeholder: '78 123 45 67' },
  { code: 'BE', nameEn: 'Belgium', nameHe: 'בלגיה', flag: '🇧🇪', prefix: '+32', placeholder: '470 12 34 56' },
  { code: 'BR', nameEn: 'Brazil', nameHe: 'ברזיל', flag: '🇧🇷', prefix: '+55', placeholder: '11 91234-5678' },
  { code: 'MX', nameEn: 'Mexico', nameHe: 'מקסיקו', flag: '🇲🇽', prefix: '+52', placeholder: '55 1234 5678' },
  { code: 'AR', nameEn: 'Argentina', nameHe: 'ארגנטינה', flag: '🇦🇷', prefix: '+54', placeholder: '9 11 1234-5678' },
  { code: 'ZA', nameEn: 'South Africa', nameHe: 'דרום אפריקה', flag: '🇿🇦', prefix: '+27', placeholder: '82 123 4567' },
  { code: 'JP', nameEn: 'Japan', nameHe: 'יפן', flag: '🇯🇵', prefix: '+81', placeholder: '90 1234 5678' },
  { code: 'KR', nameEn: 'South Korea', nameHe: 'דרום קוריאה', flag: '🇰🇷', prefix: '+82', placeholder: '10 1234 5678' },
  { code: 'SG', nameEn: 'Singapore', nameHe: 'סינגפור', flag: '🇸🇬', prefix: '+65', placeholder: '8123 4567' },
  { code: 'SA', nameEn: 'Saudi Arabia', nameHe: 'ערב הסעודית', flag: '🇸🇦', prefix: '+966', placeholder: '50 123 4567' },
  { code: 'GR', nameEn: 'Greece', nameHe: 'יוון', flag: '🇬🇷', prefix: '+30', placeholder: '691 234 5678' },
  { code: 'PL', nameEn: 'Poland', nameHe: 'פולין', flag: '🇵🇱', prefix: '+48', placeholder: '512 345 678' },
  { code: 'CZ', nameEn: 'Czech Republic', nameHe: 'צ\'כיה', flag: '🇨🇿', prefix: '+420', placeholder: '601 123 456' },
  { code: 'RO', nameEn: 'Romania', nameHe: 'רומניה', flag: '🇷🇴', prefix: '+40', placeholder: '712 345 678' },
  { code: 'TR', nameEn: 'Turkey', nameHe: 'טורקיה', flag: '🇹🇷', prefix: '+90', placeholder: '532 123 45 67' },
  { code: 'CY', nameEn: 'Cyprus', nameHe: 'קפריסין', flag: '🇨🇾', prefix: '+357', placeholder: '99 123456' },
  { code: 'PT', nameEn: 'Portugal', nameHe: 'פורטוגל', flag: '🇵🇹', prefix: '+351', placeholder: '912 345 678' },
  { code: 'SE', nameEn: 'Sweden', nameHe: 'שוודיה', flag: '🇸🇪', prefix: '+46', placeholder: '70 123 45 67' },
  { code: 'NO', nameEn: 'Norway', nameHe: 'נורווגיה', flag: '🇳🇴', prefix: '+47', placeholder: '412 34 567' },
  { code: 'DK', nameEn: 'Denmark', nameHe: 'דנמרק', flag: '🇩🇰', prefix: '+45', placeholder: '20 12 34 56' },
  { code: 'FI', nameEn: 'Finland', nameHe: 'פינלנד', flag: '🇫🇮', prefix: '+358', placeholder: '40 1234567' },
  { code: 'AT', nameEn: 'Austria', nameHe: 'אוסטריה', flag: '🇦🇹', prefix: '+43', placeholder: '650 1234567' },
  { code: 'IE', nameEn: 'Ireland', nameHe: 'אירלנד', flag: '🇮🇪', prefix: '+353', placeholder: '85 123 4567' },
  { code: 'NZ', nameEn: 'New Zealand', nameHe: 'ניו זילנד', flag: '🇳🇿', prefix: '+64', placeholder: '21 123 4567' },
];

interface PhoneInputWithCountryProps {
  value: string;
  onChange: (fullPhoneNumber: string) => void;
  required?: boolean;
}

export function PhoneInputWithCountry({
  value,
  onChange,
  required = false,
}: PhoneInputWithCountryProps) {
  const { language, dir } = useLanguage();
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(COUNTRIES[0]); // Default Israel (+972)
  const [localNumber, setLocalNumber] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Parse incoming value when it changes from outside
  useEffect(() => {
    if (!value) {
      setLocalNumber('');
      return;
    }

    const trimmed = value.trim();

    // Check if starts with a known country prefix
    const matchedCountry = COUNTRIES.find((c) => trimmed.startsWith(c.prefix));
    if (matchedCountry) {
      setSelectedCountry(matchedCountry);
      const remainder = trimmed.substring(matchedCountry.prefix.length).trim();
      setLocalNumber(remainder);
      return;
    }

    // If starts with 972... (without +)
    if (trimmed.startsWith('972')) {
      const ilCountry = COUNTRIES.find((c) => c.code === 'IL') || COUNTRIES[0];
      setSelectedCountry(ilCountry);
      setLocalNumber(trimmed.substring(3).trim());
      return;
    }

    // Default fallback
    setLocalNumber(trimmed);
  }, [value]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) return COUNTRIES;
    const q = searchQuery.toLowerCase().trim();
    return COUNTRIES.filter(
      (c) =>
        c.nameEn.toLowerCase().includes(q) ||
        c.nameHe.toLowerCase().includes(q) ||
        c.prefix.includes(q) ||
        c.code.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const emitFullPhone = (country: CountryCode, num: string) => {
    const cleanNum = num.trim();
    if (!cleanNum) {
      onChange('');
      return;
    }

    // Strip leading 0 if present e.g. 0522888491 -> 522888491 with +972
    let sanitized = cleanNum;
    if (sanitized.startsWith('0')) {
      sanitized = sanitized.substring(1);
    }
    // Remove duplicate prefix if typed
    if (sanitized.startsWith(country.prefix.replace('+', ''))) {
      sanitized = sanitized.substring(country.prefix.length - 1);
    }

    const fullPhone = `${country.prefix}${sanitized.replace(/[^0-9]/g, '')}`;
    onChange(fullPhone);
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalNumber(val);
    emitFullPhone(selectedCountry, val);
  };

  const handleSelectCountry = (country: CountryCode) => {
    setSelectedCountry(country);
    setIsOpen(false);
    setSearchQuery('');
    emitFullPhone(country, localNumber);
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div
        className="flex items-center rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all shadow-sm overflow-hidden"
        dir="ltr"
      >
        {/* Country Code Dropdown Trigger */}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-100/80 dark:bg-slate-900/80 hover:bg-slate-200/80 dark:hover:bg-slate-800 border-r border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 transition-colors shrink-0 select-none"
          title={language === 'he' ? 'בחר קידומת מדינה' : 'Select country code'}
        >
          <span className="text-base leading-none">{selectedCountry.flag}</span>
          <span className="font-mono">{selectedCountry.prefix}</span>
          <span className="text-[10px] opacity-60">▼</span>
        </button>

        {/* Local Number Input */}
        <input
          type="tel"
          value={localNumber}
          onChange={handleNumberChange}
          required={required}
          placeholder={selectedCountry.placeholder}
          className="w-full px-3 py-2.5 bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none text-sm font-mono"
        />
      </div>

      {/* Country Selection Dropdown Menu */}
      {isOpen && (
        <div
          className={`absolute top-full mt-1.5 z-50 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-scaleUp ${
            dir === 'rtl' ? 'right-0' : 'left-0'
          }`}
          dir={dir}
        >
          {/* Search Box */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === 'he' ? 'חפש מדינה או קידומת...' : 'Search country or code...'}
              className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* List of Countries */}
          <div className="max-h-56 overflow-y-auto p-1 space-y-0.5 text-xs">
            {filteredCountries.length === 0 ? (
              <div className="p-3 text-center text-slate-400 text-xs">
                {language === 'he' ? 'לא נמצאה מדינה' : 'No country found'}
              </div>
            ) : (
              filteredCountries.map((c) => {
                const isSelected = c.code === selectedCountry.code;
                const countryName = language === 'he' ? c.nameHe : c.nameEn;

                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => handleSelectCountry(c)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-colors text-start ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-base leading-none shrink-0">{c.flag}</span>
                      <span className="truncate">{countryName}</span>
                    </div>
                    <span className="font-mono text-xs text-slate-400 dark:text-slate-500 shrink-0 ml-2" dir="ltr">
                      {c.prefix}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
