import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

// Import built-in locales
import plTranslations from './locales/pl.json';
import enTranslations from './locales/en.json';

// Types
export interface LocaleMeta {
  name: string;
  code: string;
  author: string;
}

export interface Translations {
  meta: LocaleMeta;
  [key: string]: any;
}

export interface I18nContextType {
  locale: string;
  translations: Translations;
  availableLocales: { code: string; name: string; isCustom: boolean }[];
  t: (key: string, params?: Record<string, string | number>) => string;
  setLocale: (locale: string) => void;
  loadCustomLocale: (translations: Translations) => void;
}

// Built-in translations
const builtInTranslations: Record<string, Translations> = {
  pl: plTranslations as Translations,
  en: enTranslations as Translations,
};

// Default context value
const defaultContextValue: I18nContextType = {
  locale: 'pl',
  translations: plTranslations as Translations,
  availableLocales: [],
  t: () => '',
  setLocale: () => {},
  loadCustomLocale: () => {},
};

// Create context
const I18nContext = createContext<I18nContextType>(defaultContextValue);

// Utility function to get nested value from object using dot notation
function getNestedValue(obj: any, path: string): string | undefined {
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current === undefined || current === null) {
      return undefined;
    }
    current = current[key];
  }
  
  return typeof current === 'string' ? current : undefined;
}

// Provider component
interface I18nProviderProps {
  children: ReactNode;
  initialLocale?: string;
  onLocaleChange?: (locale: string) => void;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({
  children,
  initialLocale = 'pl',
  onLocaleChange,
}) => {
  const [locale, setLocaleState] = useState(initialLocale);
  const [translations, setTranslations] = useState<Translations>(
    builtInTranslations[initialLocale] || builtInTranslations.pl
  );
  const [customLocales, setCustomLocales] = useState<Record<string, Translations>>({});

  // Get available locales
  const availableLocales = [
    ...Object.entries(builtInTranslations).map(([code, trans]) => ({
      code,
      name: trans.meta.name,
      isCustom: false,
    })),
    ...Object.entries(customLocales).map(([code, trans]) => ({
      code,
      name: trans.meta.name,
      isCustom: true,
    })),
  ];

  // Set locale function
  const setLocale = useCallback((newLocale: string) => {
    const allTranslations = { ...builtInTranslations, ...customLocales };
    
    if (allTranslations[newLocale]) {
      setLocaleState(newLocale);
      setTranslations(allTranslations[newLocale]);
      onLocaleChange?.(newLocale);
    } else {
      console.warn(`Locale "${newLocale}" not found, falling back to "en"`);
      setLocaleState('en');
      setTranslations(builtInTranslations.en);
    }
  }, [customLocales, onLocaleChange]);

  // Load custom locale
  const loadCustomLocale = useCallback((newTranslations: Translations) => {
    if (!newTranslations.meta?.code || !newTranslations.meta?.name) {
      console.error('Custom locale must have meta.code and meta.name');
      return;
    }

    setCustomLocales((prev) => ({
      ...prev,
      [newTranslations.meta.code]: newTranslations,
    }));
  }, []);

  // Translation function
  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    let value = getNestedValue(translations, key);
    
    // Fallback to English if key not found
    if (value === undefined && locale !== 'en') {
      value = getNestedValue(builtInTranslations.en, key);
    }
    
    // Return key if translation not found
    if (value === undefined) {
      console.warn(`Translation key "${key}" not found`);
      return key;
    }
    
    // Replace parameters
    if (params) {
      Object.entries(params).forEach(([paramKey, paramValue]) => {
        value = value!.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
      });
    }
    
    return value;
  }, [translations, locale]);

  // Update translations when locale changes externally
  useEffect(() => {
    if (initialLocale !== locale) {
      setLocale(initialLocale);
    }
  }, [initialLocale]);

  const contextValue: I18nContextType = {
    locale,
    translations,
    availableLocales,
    t,
    setLocale,
    loadCustomLocale,
  };

  return (
    <I18nContext.Provider value={contextValue}>
      {children}
    </I18nContext.Provider>
  );
};

// Hook to use i18n
export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  
  return context;
};

// Utility hook for just the translation function
export const useTranslation = () => {
  const { t, locale } = useI18n();
  return { t, locale };
};

export default I18nContext;
