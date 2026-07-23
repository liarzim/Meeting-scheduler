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

  // Load language preference from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('app_language') as Language;
      if (saved && (saved === 'en' || saved === 'he')) {
        setLanguageState(saved);
      }
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
    setLanguage(language === 'en' ? 'he' : 'en');
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
