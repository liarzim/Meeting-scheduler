'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations, type Language, type TranslationKey } from '@/lib/i18n';

interface LanguageContextType {
  language: Language;
  dir: 'ltr' | 'rtl';
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  // Detect language based on user's computer / browser settings on initial load
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // 1. Check if user already manually selected a preferred language
      const saved = localStorage.getItem('app_language') as Language;
      if (saved && (saved === 'en' || saved === 'he')) {
        setLanguageState(saved);
        return;
      }

      // 2. Check pre-computed initial lang from head script
      const initialWindowLang = (window as any).__INITIAL_LANG__;
      if (initialWindowLang === 'he' || initialWindowLang === 'en') {
        setLanguageState(initialWindowLang);
        return;
      }

      // 3. Check browser & OS languages (navigator.languages and navigator.language)
      const browserLangs = navigator.languages || [navigator.language || ''];
      for (const l of browserLangs) {
        if (!l) continue;
        const lower = l.toLowerCase();
        // 'he', 'he-IL', 'iw', 'iw-IL' (iw is legacy Hebrew code)
        if (lower.startsWith('he') || lower.startsWith('iw')) {
          setLanguageState('he');
          return;
        }
      }

      // 4. Check system timezone as fallback for Israeli systems
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        if (tz.includes('Jerusalem') || tz.includes('Tel_Aviv')) {
          setLanguageState('he');
          return;
        }
      } catch (e) {
        console.error('Error detecting timezone for language:', e);
      }

      // Default fallback
      setLanguageState('en');
    }
  }, []);

  // Update HTML document dir and lang attributes on language change
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const dir = language === 'he' ? 'rtl' : 'ltr';
      document.documentElement.dir = dir;
      document.documentElement.lang = language;
    }
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('app_language', lang);
    }
  };

  const toggleLanguage = () => {
    const nextLang = language === 'en' ? 'he' : 'en';
    setLanguage(nextLang);
  };

  const t = (key: TranslationKey): string => {
    return translations[language][key] || translations['en'][key] || key;
  };

  const dir = language === 'he' ? 'rtl' : 'ltr';

  return (
    <LanguageContext.Provider value={{ language, dir, setLanguage, toggleLanguage, t }}>
      <div dir={dir} className={dir}>
        {children}
      </div>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
