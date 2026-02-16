# 🌍 Translator's Guide - Adding Custom Languages

This guide explains how to create and add custom language translations to Mr_Brodacz - CLIENT.

## 📁 Translation File Format

Translations use **JSON** format for ease of editing and validation. Each language file must follow the structure below.

## 🚀 Quick Start

### 1. Copy the Template

Start by copying an existing language file as a template:

```bash
# Copy English template
cp src/renderer/i18n/locales/en.json src/renderer/i18n/locales/YOUR_LANGUAGE_CODE.json
```

### 2. Edit the Metadata

Every translation file must have a `meta` section:

```json
{
  "meta": {
    "name": "Language Name",     // Display name (e.g., "Deutsch", "日本語")
    "code": "language_code",     // ISO 639-1 code (e.g., "de", "ja")
    "author": "Your Name"        // Translator credit
  },
  // ... translations
}
```

### 3. Translate the Strings

Keep the JSON keys (left side) unchanged, only translate the values (right side):

```json
{
  "common": {
    "loading": "Loading...",        // Original
    "loading": "Ładowanie...",      // Polish
    "loading": "Laden...",          // German
  }
}
```

## 📋 Translation File Structure

```json
{
  "meta": {
    "name": "Your Language",
    "code": "xx",
    "author": "Your Name"
  },
  "common": {
    // Common UI elements
  },
  "sidebar": {
    // Sidebar navigation
  },
  "titleBar": {
    // Title bar and user menu
  },
  "home": {
    // Home page
  },
  "mods": {
    // Mods page
  },
  "settings": {
    // Settings page (nested structure)
  },
  "auth": {
    // Authentication messages
  },
  "notifications": {
    // Notification panel
  },
  "console": {
    // Console panel
  },
  "errors": {
    // Error messages
  }
}
```

## 🔤 Translation Guidelines

### Do's ✅

- **Maintain JSON structure** - Keep all keys exactly as they are
- **Use proper encoding** - Save files as UTF-8
- **Keep placeholders** - Variables like `{total}` must remain unchanged
- **Match context** - Consider where the text appears in the UI
- **Test your translation** - Load it in the launcher to verify

### Don'ts ❌

- **Never change JSON keys** - Only change the values
- **Don't remove entries** - Keep all keys, even if unchanged
- **Don't add extra keys** - Only translate existing entries
- **Avoid machine translation** - Use it as reference, but review manually

## 🔧 Placeholders

Some strings contain placeholders that get replaced with dynamic values:

```json
{
  "settings": {
    "memory": {
      "description": "Available: {total} GB, recommended: {recommended} GB"
    }
  }
}
```

**Keep placeholders unchanged:**
- `{total}` → Will be replaced with actual total memory
- `{recommended}` → Will be replaced with recommended memory

## 📂 Loading Custom Languages

### Method 1: Built-in Languages (for contributions)

Add your file to `src/renderer/i18n/locales/` and import it in `I18nContext.tsx`:

```typescript
// In I18nContext.tsx
import deTranslations from './locales/de.json';

const builtInTranslations: Record<string, Translations> = {
  pl: plTranslations,
  en: enTranslations,
  de: deTranslations,  // Add new language
};
```

### Method 2: Custom Language Files (for users)

Place your JSON file in the launcher's custom languages folder:

```
Windows: %APPDATA%/MinecraftLauncher/languages/
macOS:   ~/Library/Application Support/MinecraftLauncher/languages/
Linux:   ~/.config/MinecraftLauncher/languages/
```

The launcher will automatically detect and load custom language files on startup.

## 📝 Complete Example

Here's a minimal German translation example:

```json
{
  "meta": {
    "name": "Deutsch",
    "code": "de",
    "author": "Max Mustermann"
  },
  "common": {
    "loading": "Laden...",
    "save": "Speichern",
    "cancel": "Abbrechen",
    "reset": "Zurücksetzen",
    "close": "Schließen",
    "confirm": "Bestätigen",
    "error": "Fehler",
    "success": "Erfolg",
    "warning": "Warnung",
    "info": "Information",
    "yes": "Ja",
    "no": "Nein",
    "search": "Suchen",
    "download": "Herunterladen",
    "install": "Installieren",
    "uninstall": "Deinstallieren",
    "update": "Aktualisieren",
    "version": "Version",
    "all": "Alle"
  },
  "sidebar": {
    "home": "Startseite",
    "mods": "Mods",
    "settings": "Einstellungen",
    "console": "Konsole"
  }
  // ... continue with other sections
}
```

## 🔍 Validation

Before submitting, validate your JSON:

1. **Syntax Check**: Use a JSON validator (e.g., jsonlint.com)
2. **Completeness**: Ensure all keys from `en.json` are present
3. **Encoding**: Verify UTF-8 encoding (especially for non-Latin characters)
4. **Test in App**: Load the language and navigate through all pages

## 🤝 Contributing Translations

1. Fork the repository
2. Create your language file: `src/renderer/i18n/locales/XX.json`
3. Update `I18nContext.tsx` to import your language
4. Test thoroughly
5. Submit a Pull Request with:
   - Language file
   - Updated `I18nContext.tsx`
   - Any relevant screenshots

## 📧 Questions?

If you have questions about translations:
- Open an issue on GitHub
- Tag it with `translation` label

Thank you for helping make Mr_Brodacz - CLIENT accessible to more players! 🎮
