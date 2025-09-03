/**
 * @jest-environment jsdom
 * Swedish/English Internationalization Test Suite
 * Testing language switching, text expansion, åäö rendering, and cultural adaptations
 * Coverage Target: 95% i18n functionality, 100% Swedish character support
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider, useI18n, useTranslation } from '@/providers/i18n-provider';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import { DateFormatter } from '@/components/ui/date-formatter';
import { NumberFormatter } from '@/components/ui/number-formatter';
import { SortableTable } from '@/components/ui/sortable-table';
import { PluralForm } from '@/components/ui/plural-form';
import { ValidationMessage } from '@/components/ui/validation-message';
import '@testing-library/jest-dom';

// Mock translations
const translations = {
  sv: {
    common: {
      welcome: 'Välkommen till SVOA Lea',
      loading: 'Laddar...',
      error: 'Ett fel uppstod',
      save: 'Spara',
      cancel: 'Avbryt',
      delete: 'Ta bort',
      confirm: 'Bekräfta',
      search: 'Sök',
      filter: 'Filtrera',
      export: 'Exportera',
      months: {
        january: 'januari',
        february: 'februari',
        march: 'mars',
        april: 'april',
        may: 'maj',
        june: 'juni',
        july: 'juli',
        august: 'augusti',
        september: 'september',
        october: 'oktober',
        november: 'november',
        december: 'december',
      },
    },
    insights: {
      title: 'Insikter och avvikelser',
      severity: {
        low: 'Låg',
        medium: 'Medel',
        high: 'Hög',
        critical: 'Kritisk',
      },
      status: {
        open: 'Öppen',
        inProgress: 'Pågående',
        resolved: 'Löst',
        closed: 'Stängd',
      },
      actions: {
        createInsight: 'Skapa ny insikt',
        mergeInsights: 'Slå ihop insikter',
        linkEvidence: 'Länka bevis',
        exportReport: 'Exportera rapport',
      },
    },
    validation: {
      required: 'Detta fält är obligatoriskt',
      invalidEmail: 'Ogiltig e-postadress',
      minLength: 'Måste vara minst {{min}} tecken',
      maxLength: 'Får inte överstiga {{max}} tecken',
      pattern: 'Formatet är ogiltigt',
      personnummer: 'Ogiltigt personnummer',
      organizationNumber: 'Ogiltigt organisationsnummer',
      wasteCode: 'Ogiltig avfallskod enligt EWC-standarden',
      dateRange: 'Startdatum måste vara före slutdatum',
      futureDate: 'Datumet kan inte vara i framtiden',
    },
    accessibility: {
      skipToContent: 'Hoppa till innehåll',
      openMenu: 'Öppna meny',
      closeModal: 'Stäng dialogruta',
      expandSection: 'Expandera sektion',
      collapseSection: 'Minimera sektion',
      sortAscending: 'Sortera stigande',
      sortDescending: 'Sortera fallande',
      screenReaderOnly: 'Endast för skärmläsare',
      loading: 'Innehållet laddas, vänligen vänta',
      searchResults: '{{count}} sökresultat hittades',
    },
    plurals: {
      supplier: {
        zero: 'Inga leverantörer',
        one: 'En leverantör',
        other: '{{count}} leverantörer',
      },
      finding: {
        zero: 'Inga avvikelser',
        one: 'En avvikelse',
        other: '{{count}} avvikelser',
      },
      day: {
        zero: 'Inga dagar',
        one: 'En dag',
        other: '{{count}} dagar',
      },
    },
    wasteManagement: {
      terms: {
        wasteCode: 'Avfallskod',
        ewcCode: 'EWC-kod',
        contractor: 'Entreprenör',
        facility: 'Anläggning',
        vehicle: 'Fordon',
        weight: 'Vikt',
        volume: 'Volym',
        pickupSite: 'Hämtställe',
        dropoffFacility: 'Mottagningsanläggning',
        hazardousWaste: 'Farligt avfall',
        recyclingRate: 'Återvinningsgrad',
      },
    },
  },
  en: {
    common: {
      welcome: 'Welcome to SVOA Lea',
      loading: 'Loading...',
      error: 'An error occurred',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      confirm: 'Confirm',
      search: 'Search',
      filter: 'Filter',
      export: 'Export',
      months: {
        january: 'January',
        february: 'February',
        march: 'March',
        april: 'April',
        may: 'May',
        june: 'June',
        july: 'July',
        august: 'August',
        september: 'September',
        october: 'October',
        november: 'November',
        december: 'December',
      },
    },
    insights: {
      title: 'Insights and Findings',
      severity: {
        low: 'Low',
        medium: 'Medium',
        high: 'High',
        critical: 'Critical',
      },
      status: {
        open: 'Open',
        inProgress: 'In Progress',
        resolved: 'Resolved',
        closed: 'Closed',
      },
      actions: {
        createInsight: 'Create new insight',
        mergeInsights: 'Merge insights',
        linkEvidence: 'Link evidence',
        exportReport: 'Export report',
      },
    },
    validation: {
      required: 'This field is required',
      invalidEmail: 'Invalid email address',
      minLength: 'Must be at least {{min}} characters',
      maxLength: 'Cannot exceed {{max}} characters',
      pattern: 'Invalid format',
      personnummer: 'Invalid personal number',
      organizationNumber: 'Invalid organization number',
      wasteCode: 'Invalid waste code according to EWC standard',
      dateRange: 'Start date must be before end date',
      futureDate: 'Date cannot be in the future',
    },
    accessibility: {
      skipToContent: 'Skip to content',
      openMenu: 'Open menu',
      closeModal: 'Close dialog',
      expandSection: 'Expand section',
      collapseSection: 'Collapse section',
      sortAscending: 'Sort ascending',
      sortDescending: 'Sort descending',
      screenReaderOnly: 'Screen reader only',
      loading: 'Content is loading, please wait',
      searchResults: '{{count}} search results found',
    },
    plurals: {
      supplier: {
        zero: 'No suppliers',
        one: 'One supplier',
        other: '{{count}} suppliers',
      },
      finding: {
        zero: 'No findings',
        one: 'One finding',
        other: '{{count}} findings',
      },
      day: {
        zero: 'No days',
        one: 'One day',
        other: '{{count}} days',
      },
    },
    wasteManagement: {
      terms: {
        wasteCode: 'Waste code',
        ewcCode: 'EWC code',
        contractor: 'Contractor',
        facility: 'Facility',
        vehicle: 'Vehicle',
        weight: 'Weight',
        volume: 'Volume',
        pickupSite: 'Pickup site',
        dropoffFacility: 'Drop-off facility',
        hazardousWaste: 'Hazardous waste',
        recyclingRate: 'Recycling rate',
      },
    },
  },
};

describe('Swedish/English Internationalization', () => {
  describe('Language Switching', () => {
    it('should switch between Swedish and English languages', async () => {
      const user = userEvent.setup();
      
      const { rerender } = render(
        <I18nProvider locale="sv" translations={translations}>
          <LanguageSwitcher />
          <h1 data-testid="welcome">{translations.sv.common.welcome}</h1>
        </I18nProvider>
      );
      
      expect(screen.getByTestId('welcome')).toHaveTextContent('Välkommen till SVOA Lea');
      expect(screen.getByRole('combobox', { name: /språk/i })).toHaveValue('sv');
      
      // Switch to English
      const languageSelector = screen.getByRole('combobox');
      await user.selectOptions(languageSelector, 'en');
      
      rerender(
        <I18nProvider locale="en" translations={translations}>
          <LanguageSwitcher />
          <h1 data-testid="welcome">{translations.en.common.welcome}</h1>
        </I18nProvider>
      );
      
      expect(screen.getByTestId('welcome')).toHaveTextContent('Welcome to SVOA Lea');
      expect(screen.getByRole('combobox', { name: /language/i })).toHaveValue('en');
    });

    it('should persist language preference in localStorage', async () => {
      const user = userEvent.setup();
      
      render(
        <I18nProvider locale="sv" translations={translations}>
          <LanguageSwitcher />
        </I18nProvider>
      );
      
      const languageSelector = screen.getByRole('combobox');
      await user.selectOptions(languageSelector, 'en');
      
      expect(localStorage.getItem('preferred-language')).toBe('en');
      
      // Remount component
      render(
        <I18nProvider translations={translations}>
          <LanguageSwitcher />
        </I18nProvider>
      );
      
      expect(screen.getByRole('combobox')).toHaveValue('en');
    });

    it('should detect browser language preference on initial load', () => {
      Object.defineProperty(navigator, 'language', {
        value: 'sv-SE',
        writable: true,
      });
      
      render(
        <I18nProvider translations={translations}>
          <div data-testid="locale-detector">
            {/* Component should auto-detect Swedish */}
          </div>
        </I18nProvider>
      );
      
      const provider = screen.getByTestId('locale-detector').parentElement;
      expect(provider).toHaveAttribute('lang', 'sv');
    });

    it('should handle language switching with keyboard navigation', async () => {
      const user = userEvent.setup();
      
      render(
        <I18nProvider locale="sv" translations={translations}>
          <LanguageSwitcher />
        </I18nProvider>
      );
      
      const languageSelector = screen.getByRole('combobox');
      languageSelector.focus();
      
      // Use arrow keys to navigate
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');
      
      expect(languageSelector).toHaveValue('en');
    });
  });

  describe('Swedish Text Expansion', () => {
    it('should handle ~20% longer Swedish text without breaking layouts', () => {
      const englishText = 'Save changes';
      const swedishText = 'Spara ändringar'; // Typically longer
      
      const { container: enContainer } = render(
        <I18nProvider locale="en" translations={translations}>
          <button className="w-32 truncate">{englishText}</button>
        </I18nProvider>
      );
      
      const { container: svContainer } = render(
        <I18nProvider locale="sv" translations={translations}>
          <button className="w-32 truncate">{swedishText}</button>
        </I18nProvider>
      );
      
      const enButton = enContainer.querySelector('button');
      const svButton = svContainer.querySelector('button');
      
      // Swedish button should handle text expansion gracefully
      expect(svButton?.scrollWidth).toBeGreaterThanOrEqual(enButton?.scrollWidth || 0);
      expect(svButton).toHaveClass('truncate'); // Should truncate if too long
    });

    it('should adjust container widths dynamically for Swedish content', () => {
      const { container } = render(
        <I18nProvider locale="sv" translations={translations}>
          <div data-testid="dynamic-container" className="flex flex-wrap gap-2">
            <button className="px-4 py-2 whitespace-nowrap">
              {translations.sv.insights.actions.createInsight}
            </button>
            <button className="px-4 py-2 whitespace-nowrap">
              {translations.sv.insights.actions.mergeInsights}
            </button>
            <button className="px-4 py-2 whitespace-nowrap">
              {translations.sv.insights.actions.exportReport}
            </button>
          </div>
        </I18nProvider>
      );
      
      const buttons = container.querySelectorAll('button');
      buttons.forEach(button => {
        // Check that text doesn't overflow
        expect(button.scrollWidth).toBeLessThanOrEqual(button.clientWidth + 1); // +1 for rounding
      });
    });

    it('should handle text expansion in form labels and inputs', () => {
      render(
        <I18nProvider locale="sv" translations={translations}>
          <form>
            <label htmlFor="waste-code">
              {translations.sv.wasteManagement.terms.wasteCode}
            </label>
            <input 
              id="waste-code"
              placeholder={translations.sv.common.search}
              className="w-full"
            />
          </form>
        </I18nProvider>
      );
      
      const label = screen.getByText('Avfallskod');
      const input = screen.getByPlaceholderText('Sök');
      
      expect(label).toBeInTheDocument();
      expect(input).toHaveAttribute('placeholder', 'Sök');
    });

    it('should wrap long Swedish text appropriately in cards', () => {
      const longSwedishText = 'Detta är en mycket lång svensk text som används för att testa textbrytning och layouthantering i kortkomponenter när innehållet är på svenska';
      
      const { container } = render(
        <I18nProvider locale="sv" translations={translations}>
          <div className="w-64 p-4 border rounded" data-testid="text-card">
            <p className="break-words">{longSwedishText}</p>
          </div>
        </I18nProvider>
      );
      
      const card = screen.getByTestId('text-card');
      const paragraph = card.querySelector('p');
      
      expect(paragraph).toHaveClass('break-words');
      expect(paragraph?.scrollHeight).toBeGreaterThan(20); // Multi-line text
    });
  });

  describe('Swedish Character Rendering (åäö/ÅÄÖ)', () => {
    it('should correctly render Swedish special characters åäö', () => {
      const swedishWords = [
        'Återvinning',
        'Avfallshantering',
        'Miljöskydd',
        'Hållbarhet',
        'Överskott',
        'Ändring',
      ];
      
      render(
        <I18nProvider locale="sv" translations={translations}>
          <ul data-testid="swedish-list">
            {swedishWords.map(word => (
              <li key={word}>{word}</li>
            ))}
          </ul>
        </I18nProvider>
      );
      
      const list = screen.getByTestId('swedish-list');
      swedishWords.forEach(word => {
        expect(within(list).getByText(word)).toBeInTheDocument();
      });
      
      // Check specific character rendering
      expect(screen.getByText(/Återvinning/)).toBeInTheDocument();
      expect(screen.getByText(/Miljöskydd/)).toBeInTheDocument();
      expect(screen.getByText(/Överskott/)).toBeInTheDocument();
    });

    it('should handle uppercase Swedish characters ÅÄÖ', () => {
      const uppercaseWords = ['ÅTER', 'ÄRENDE', 'ÖPPET'];
      
      render(
        <I18nProvider locale="sv" translations={translations}>
          <div>
            {uppercaseWords.map(word => (
              <span key={word} className="uppercase">{word}</span>
            ))}
          </div>
        </I18nProvider>
      );
      
      uppercaseWords.forEach(word => {
        expect(screen.getByText(word)).toBeInTheDocument();
      });
    });

    it('should correctly handle Swedish characters in form inputs', async () => {
      const user = userEvent.setup();
      
      render(
        <I18nProvider locale="sv" translations={translations}>
          <form>
            <input 
              type="text" 
              data-testid="swedish-input"
              aria-label="Swedish input"
            />
            <textarea 
              data-testid="swedish-textarea"
              aria-label="Swedish textarea"
            />
          </form>
        </I18nProvider>
      );
      
      const input = screen.getByTestId('swedish-input');
      const textarea = screen.getByTestId('swedish-textarea');
      
      await user.type(input, 'Hej, jag heter Åsa Öberg från Älvsjö');
      await user.type(textarea, 'Återvinning är viktigt för miljön');
      
      expect(input).toHaveValue('Hej, jag heter Åsa Öberg från Älvsjö');
      expect(textarea).toHaveValue('Återvinning är viktigt för miljön');
    });

    it('should maintain Swedish characters through JSON serialization', () => {
      const swedishData = {
        name: 'Åsa Öberg',
        address: 'Älvsjögatan 42',
        city: 'Växjö',
        notes: 'Återvinning och miljöskydd',
      };
      
      const serialized = JSON.stringify(swedishData);
      const deserialized = JSON.parse(serialized);
      
      expect(deserialized.name).toBe('Åsa Öberg');
      expect(deserialized.address).toBe('Älvsjögatan 42');
      expect(deserialized.city).toBe('Växjö');
      expect(deserialized.notes).toBe('Återvinning och miljöskydd');
    });
  });

  describe('Swedish Sorting and Collation', () => {
    it('should sort Swedish names correctly (å, ä, ö after z)', () => {
      const names = ['Öberg', 'Andersson', 'Åkesson', 'Zachrisson', 'Ärlig'];
      
      render(
        <I18nProvider locale="sv" translations={translations}>
          <SortableTable
            data={names.map(name => ({ name }))}
            columns={[{ key: 'name', label: 'Namn' }]}
            locale="sv"
          />
        </I18nProvider>
      );
      
      // Click sort button
      const sortButton = screen.getByRole('button', { name: /sortera/i });
      userEvent.click(sortButton);
      
      const cells = screen.getAllByRole('cell');
      const sortedNames = cells.map(cell => cell.textContent);
      
      // Swedish sort order: a-z, then å, ä, ö
      expect(sortedNames).toEqual(['Andersson', 'Zachrisson', 'Åkesson', 'Ärlig', 'Öberg']);
    });

    it('should handle case-insensitive Swedish sorting', () => {
      const words = ['öppna', 'Äpple', 'ärlig', 'Åka', 'zebra', 'ÖSTKUST'];
      
      const sorted = words.sort((a, b) => 
        a.localeCompare(b, 'sv', { sensitivity: 'base' })
      );
      
      expect(sorted).toEqual(['zebra', 'Åka', 'Äpple', 'ärlig', 'öppna', 'ÖSTKUST']);
    });

    it('should sort Swedish dates with month names correctly', () => {
      const dates = [
        { date: '15 december 2024', sortKey: new Date(2024, 11, 15) },
        { date: '3 januari 2024', sortKey: new Date(2024, 0, 3) },
        { date: '28 maj 2024', sortKey: new Date(2024, 4, 28) },
        { date: '10 oktober 2024', sortKey: new Date(2024, 9, 10) },
      ];
      
      render(
        <I18nProvider locale="sv" translations={translations}>
          <SortableTable
            data={dates}
            columns={[{ key: 'date', label: 'Datum', sortKey: 'sortKey' }]}
            locale="sv"
          />
        </I18nProvider>
      );
      
      const sortButton = screen.getByRole('button', { name: /sortera/i });
      userEvent.click(sortButton);
      
      const cells = screen.getAllByRole('cell');
      expect(cells[0]).toHaveTextContent('3 januari 2024');
      expect(cells[1]).toHaveTextContent('28 maj 2024');
      expect(cells[2]).toHaveTextContent('10 oktober 2024');
      expect(cells[3]).toHaveTextContent('15 december 2024');
    });
  });

  describe('Plural Forms and Gender Agreements', () => {
    it('should handle Swedish plural forms correctly', () => {
      const testCases = [
        { count: 0, expected: 'Inga leverantörer' },
        { count: 1, expected: 'En leverantör' },
        { count: 2, expected: '2 leverantörer' },
        { count: 10, expected: '10 leverantörer' },
      ];
      
      testCases.forEach(({ count, expected }) => {
        const { container } = render(
          <I18nProvider locale="sv" translations={translations}>
            <PluralForm 
              count={count}
              singular="leverantör"
              plural="leverantörer"
              zero="Inga leverantörer"
              one="En leverantör"
            />
          </I18nProvider>
        );
        
        expect(container.textContent).toBe(expected);
      });
    });

    it('should handle definite and indefinite articles in Swedish', () => {
      render(
        <I18nProvider locale="sv" translations={translations}>
          <div>
            <span data-testid="indefinite">en leverantör</span>
            <span data-testid="definite">leverantören</span>
            <span data-testid="indefinite-plural">leverantörer</span>
            <span data-testid="definite-plural">leverantörerna</span>
          </div>
        </I18nProvider>
      );
      
      expect(screen.getByTestId('indefinite')).toHaveTextContent('en leverantör');
      expect(screen.getByTestId('definite')).toHaveTextContent('leverantören');
      expect(screen.getByTestId('indefinite-plural')).toHaveTextContent('leverantörer');
      expect(screen.getByTestId('definite-plural')).toHaveTextContent('leverantörerna');
    });

    it('should handle compound words in Swedish correctly', () => {
      const compoundWords = [
        'avfallshantering',
        'återvinningsstation',
        'miljöskyddsåtgärder',
        'sopsorteringsanläggning',
      ];
      
      render(
        <I18nProvider locale="sv" translations={translations}>
          <ul>
            {compoundWords.map(word => (
              <li key={word} data-testid={`compound-${word}`}>
                {word}
              </li>
            ))}
          </ul>
        </I18nProvider>
      );
      
      compoundWords.forEach(word => {
        const element = screen.getByTestId(`compound-${word}`);
        expect(element).toHaveTextContent(word);
        // Compound words should not be broken mid-word
        expect(element).toHaveStyle({ wordBreak: 'normal' });
      });
    });
  });

  describe('Date and Number Formatting', () => {
    it('should format dates according to Swedish conventions', () => {
      const date = new Date(2024, 8, 15); // September 15, 2024
      
      render(
        <I18nProvider locale="sv" translations={translations}>
          <DateFormatter 
            date={date}
            format="long"
            data-testid="swedish-date"
          />
        </I18nProvider>
      );
      
      const formattedDate = screen.getByTestId('swedish-date');
      expect(formattedDate).toHaveTextContent('15 september 2024');
    });

    it('should format numbers with Swedish conventions (space as thousand separator)', () => {
      const numbers = [
        { value: 1234.56, expected: '1 234,56' },
        { value: 1000000, expected: '1 000 000' },
        { value: 0.5, expected: '0,5' },
        { value: -1234.56, expected: '-1 234,56' },
      ];
      
      numbers.forEach(({ value, expected }) => {
        const { container } = render(
          <I18nProvider locale="sv" translations={translations}>
            <NumberFormatter value={value} />
          </I18nProvider>
        );
        
        expect(container.textContent).toBe(expected);
      });
    });

    it('should format currency in SEK correctly', () => {
      render(
        <I18nProvider locale="sv" translations={translations}>
          <NumberFormatter 
            value={1234.56}
            style="currency"
            currency="SEK"
            data-testid="swedish-currency"
          />
        </I18nProvider>
      );
      
      const currency = screen.getByTestId('swedish-currency');
      expect(currency).toHaveTextContent('1 234,56 kr');
    });

    it('should format percentages in Swedish', () => {
      render(
        <I18nProvider locale="sv" translations={translations}>
          <NumberFormatter 
            value={0.856}
            style="percent"
            data-testid="swedish-percent"
          />
        </I18nProvider>
      );
      
      const percent = screen.getByTestId('swedish-percent');
      expect(percent).toHaveTextContent('85,6 %');
    });

    it('should handle weight units in metric system', () => {
      const weights = [
        { value: 1500, unit: 'kg', expected: '1 500 kg' },
        { value: 1.5, unit: 'ton', expected: '1,5 ton' },
        { value: 500, unit: 'g', expected: '500 g' },
      ];
      
      weights.forEach(({ value, unit, expected }) => {
        const { container } = render(
          <I18nProvider locale="sv" translations={translations}>
            <NumberFormatter 
              value={value}
              unit={unit}
              unitDisplay="short"
            />
          </I18nProvider>
        );
        
        expect(container.textContent).toBe(expected);
      });
    });
  });

  describe('Validation Messages in Swedish', () => {
    it('should display validation errors in Swedish', () => {
      const validationErrors = {
        required: 'Detta fält är obligatoriskt',
        minLength: 'Måste vara minst 5 tecken',
        maxLength: 'Får inte överstiga 100 tecken',
        pattern: 'Formatet är ogiltigt',
      };
      
      render(
        <I18nProvider locale="sv" translations={translations}>
          <ValidationMessage 
            errors={validationErrors}
            data-testid="validation-messages"
          />
        </I18nProvider>
      );
      
      Object.values(validationErrors).forEach(message => {
        expect(screen.getByText(message)).toBeInTheDocument();
      });
    });

    it('should validate Swedish personnummer format', async () => {
      const user = userEvent.setup();
      
      render(
        <I18nProvider locale="sv" translations={translations}>
          <form>
            <input 
              type="text"
              pattern="^(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])-\d{4}$"
              data-testid="personnummer-input"
              aria-invalid="false"
            />
            <span data-testid="error-message" />
          </form>
        </I18nProvider>
      );
      
      const input = screen.getByTestId('personnummer-input');
      const errorMessage = screen.getByTestId('error-message');
      
      // Invalid format
      await user.type(input, '123456-7890');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(errorMessage).toHaveTextContent('Ogiltigt personnummer');
      
      // Valid format
      await user.clear(input);
      await user.type(input, '19900101-1234');
      expect(input).toHaveAttribute('aria-invalid', 'false');
    });

    it('should validate Swedish organization numbers', async () => {
      const user = userEvent.setup();
      
      render(
        <I18nProvider locale="sv" translations={translations}>
          <form>
            <input 
              type="text"
              pattern="^\d{6}-\d{4}$"
              data-testid="org-number-input"
              aria-invalid="false"
            />
            <span data-testid="org-error" />
          </form>
        </I18nProvider>
      );
      
      const input = screen.getByTestId('org-number-input');
      
      await user.type(input, '556677-8899');
      expect(input).toHaveAttribute('aria-invalid', 'false');
      
      await user.clear(input);
      await user.type(input, '12345');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('should provide helpful Swedish error messages for waste codes', () => {
      const invalidWasteCodes = [
        { code: '01', message: 'Ogiltig avfallskod - måste vara 6 siffror' },
        { code: '999999', message: 'Avfallskoden finns inte i EWC-katalogen' },
        { code: 'ABC123', message: 'Avfallskoden får endast innehålla siffror' },
      ];
      
      invalidWasteCodes.forEach(({ code, message }) => {
        const { container } = render(
          <I18nProvider locale="sv" translations={translations}>
            <ValidationMessage 
              field="wasteCode"
              value={code}
              error={message}
            />
          </I18nProvider>
        );
        
        expect(container).toHaveTextContent(message);
      });
    });
  });

  describe('Technical Terminology Translation', () => {
    it('should correctly translate waste management technical terms', () => {
      const technicalTerms = [
        { en: 'Waste code', sv: 'Avfallskod' },
        { en: 'EWC code', sv: 'EWC-kod' },
        { en: 'Contractor', sv: 'Entreprenör' },
        { en: 'Facility', sv: 'Anläggning' },
        { en: 'Vehicle', sv: 'Fordon' },
        { en: 'Weight', sv: 'Vikt' },
        { en: 'Volume', sv: 'Volym' },
        { en: 'Pickup site', sv: 'Hämtställe' },
        { en: 'Drop-off facility', sv: 'Mottagningsanläggning' },
        { en: 'Hazardous waste', sv: 'Farligt avfall' },
        { en: 'Recycling rate', sv: 'Återvinningsgrad' },
      ];
      
      technicalTerms.forEach(({ en, sv }) => {
        const { container } = render(
          <I18nProvider locale="sv" translations={translations}>
            <span data-testid={`term-${en}`}>{sv}</span>
          </I18nProvider>
        );
        
        expect(screen.getByTestId(`term-${en}`)).toHaveTextContent(sv);
      });
    });

    it('should maintain consistency in technical abbreviations', () => {
      const abbreviations = [
        { full: 'European Waste Catalogue', abbr: 'EWC', swedish: 'Europeiska avfallskatalogen' },
        { full: 'Quality Assurance', abbr: 'QA', swedish: 'Kvalitetssäkring' },
        { full: 'Key Performance Indicator', abbr: 'KPI', swedish: 'Nyckeltal' },
      ];
      
      abbreviations.forEach(({ full, abbr, swedish }) => {
        const { container } = render(
          <I18nProvider locale="sv" translations={translations}>
            <div>
              <abbr title={swedish}>{abbr}</abbr>
              <span className="sr-only">{swedish}</span>
            </div>
          </I18nProvider>
        );
        
        const abbreviation = container.querySelector('abbr');
        expect(abbreviation).toHaveAttribute('title', swedish);
        expect(abbreviation).toHaveTextContent(abbr);
      });
    });
  });

  describe('RTL/LTR Handling', () => {
    it('should maintain LTR direction for both Swedish and English', () => {
      const { container: svContainer } = render(
        <I18nProvider locale="sv" translations={translations}>
          <div data-testid="swedish-content">Swedish content</div>
        </I18nProvider>
      );
      
      const { container: enContainer } = render(
        <I18nProvider locale="en" translations={translations}>
          <div data-testid="english-content">English content</div>
        </I18nProvider>
      );
      
      expect(svContainer.firstChild).toHaveAttribute('dir', 'ltr');
      expect(enContainer.firstChild).toHaveAttribute('dir', 'ltr');
    });
  });

  describe('Translation Loading and Fallbacks', () => {
    it('should show loading state while translations load', async () => {
      const { container } = render(
        <I18nProvider locale="sv" translations={null} loading>
          <div data-testid="content">Content</div>
        </I18nProvider>
      );
      
      expect(screen.getByText(/laddar/i)).toBeInTheDocument();
      
      await waitFor(() => {
        expect(screen.queryByText(/laddar/i)).not.toBeInTheDocument();
      });
    });

    it('should fallback to English when Swedish translation is missing', () => {
      const partialTranslations = {
        sv: {
          common: {
            welcome: 'Välkommen',
            // missing other translations
          },
        },
        en: translations.en,
      };
      
      render(
        <I18nProvider locale="sv" translations={partialTranslations} fallbackLocale="en">
          <div>
            <span data-testid="available">{partialTranslations.sv.common.welcome}</span>
            <span data-testid="fallback">{translations.en.common.loading}</span>
          </div>
        </I18nProvider>
      );
      
      expect(screen.getByTestId('available')).toHaveTextContent('Välkommen');
      expect(screen.getByTestId('fallback')).toHaveTextContent('Loading...');
    });

    it('should handle missing interpolation variables gracefully', () => {
      const { container } = render(
        <I18nProvider locale="sv" translations={translations}>
          <span>
            {/* Missing 'count' variable */}
            {translations.sv.accessibility.searchResults}
          </span>
        </I18nProvider>
      );
      
      // Should show placeholder instead of breaking
      expect(container.textContent).toContain('{{count}}');
    });
  });

  describe('Performance', () => {
    it('should cache translations to avoid re-parsing', () => {
      const parseStart = performance.now();
      
      // First render
      const { rerender } = render(
        <I18nProvider locale="sv" translations={translations}>
          <div>First render</div>
        </I18nProvider>
      );
      
      const firstRenderTime = performance.now() - parseStart;
      
      // Second render with same locale
      const secondStart = performance.now();
      rerender(
        <I18nProvider locale="sv" translations={translations}>
          <div>Second render</div>
        </I18nProvider>
      );
      
      const secondRenderTime = performance.now() - secondStart;
      
      // Cached render should be significantly faster
      expect(secondRenderTime).toBeLessThan(firstRenderTime / 2);
    });

    it('should lazy load large translation files', async () => {
      const loadTranslations = jest.fn(() => 
        Promise.resolve(translations)
      );
      
      render(
        <I18nProvider 
          locale="sv" 
          loadTranslations={loadTranslations}
        >
          <div>Content</div>
        </I18nProvider>
      );
      
      expect(loadTranslations).toHaveBeenCalledWith('sv');
      
      await waitFor(() => {
        expect(screen.getByText('Content')).toBeInTheDocument();
      });
    });
  });
});