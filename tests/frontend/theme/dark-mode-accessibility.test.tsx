/**
 * @jest-environment jsdom
 * Dark Mode and Accessibility Test Suite
 * Testing theme persistence, contrast ratios, screen reader support, and WCAG compliance
 * Coverage Target: 100% accessibility compliance, 95% theme functionality
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import '@testing-library/jest-dom';
import {
  ThemeProvider,
  useTheme,
  ThemeToggle,
} from '@/providers/theme-provider';
import {
  AccessibilityProvider,
  ScreenReaderAnnouncer,
  FocusManager,
  SkipLinks,
} from '@/providers/accessibility-provider';
import { ContrastChecker } from '@/utils/contrast-checker';
import { ColorBlindnessSimulator } from '@/utils/color-blindness';

expect.extend(toHaveNoViolations);

// Mock system preferences
const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
};

// WCAG contrast ratio requirements
const WCAG_AA = {
  normal: 4.5,
  large: 3,
};

const WCAG_AAA = {
  normal: 7,
  large: 4.5,
};

// Helper to check contrast ratio
const getContrastRatio = (foreground: string, background: string): number => {
  // Simplified contrast calculation for testing
  const getLuminance = (color: string) => {
    const rgb = color.match(/\d+/g)?.map(Number) || [0, 0, 0];
    const [r, g, b] = rgb.map(val => {
      const normalized = val / 255;
      return normalized <= 0.03928
        ? normalized / 12.92
        : Math.pow((normalized + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const l1 = getLuminance(foreground);
  const l2 = getLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  
  return (lighter + 0.05) / (darker + 0.05);
};

describe('Dark Mode and Theme Management', () => {
  describe('System Preference Detection', () => {
    it('should detect and apply system dark mode preference', () => {
      mockMatchMedia(true); // System prefers dark
      
      render(
        <ThemeProvider>
          <div data-testid="themed-content">Content</div>
        </ThemeProvider>
      );
      
      const root = document.documentElement;
      expect(root).toHaveClass('dark');
      expect(root).toHaveAttribute('data-theme', 'dark');
    });

    it('should detect and apply system light mode preference', () => {
      mockMatchMedia(false); // System prefers light
      
      render(
        <ThemeProvider>
          <div data-testid="themed-content">Content</div>
        </ThemeProvider>
      );
      
      const root = document.documentElement;
      expect(root).not.toHaveClass('dark');
      expect(root).toHaveAttribute('data-theme', 'light');
    });

    it('should respond to system theme changes', async () => {
      const mockMediaQueryList = {
        matches: false,
        media: '(prefers-color-scheme: dark)',
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      };
      
      window.matchMedia = jest.fn().mockReturnValue(mockMediaQueryList);
      
      render(
        <ThemeProvider>
          <div data-testid="themed-content">Content</div>
        </ThemeProvider>
      );
      
      // Simulate system theme change
      const changeHandler = mockMediaQueryList.addEventListener.mock.calls[0][1];
      changeHandler({ matches: true });
      
      await waitFor(() => {
        expect(document.documentElement).toHaveClass('dark');
      });
    });
  });

  describe('Manual Theme Toggle', () => {
    it('should toggle between light and dark themes', async () => {
      const user = userEvent.setup();
      
      render(
        <ThemeProvider defaultTheme="light">
          <ThemeToggle />
        </ThemeProvider>
      );
      
      const toggleButton = screen.getByRole('button', { name: /toggle theme/i });
      expect(document.documentElement).not.toHaveClass('dark');
      
      await user.click(toggleButton);
      expect(document.documentElement).toHaveClass('dark');
      
      await user.click(toggleButton);
      expect(document.documentElement).not.toHaveClass('dark');
    });

    it('should override system preference when manually set', async () => {
      const user = userEvent.setup();
      mockMatchMedia(true); // System prefers dark
      
      render(
        <ThemeProvider>
          <ThemeToggle />
        </ThemeProvider>
      );
      
      // Initially follows system (dark)
      expect(document.documentElement).toHaveClass('dark');
      
      // Manual override to light
      const toggleButton = screen.getByRole('button', { name: /toggle theme/i });
      await user.click(toggleButton);
      
      expect(document.documentElement).not.toHaveClass('dark');
      expect(localStorage.getItem('theme-preference')).toBe('light');
    });

    it('should provide keyboard shortcut for theme toggle', async () => {
      const user = userEvent.setup();
      
      render(
        <ThemeProvider defaultTheme="light">
          <div data-testid="content">Content</div>
        </ThemeProvider>
      );
      
      // Ctrl+Shift+D for dark mode toggle
      await user.keyboard('{Control>}{Shift>}d{/Shift}{/Control}');
      
      expect(document.documentElement).toHaveClass('dark');
      
      // Toggle back
      await user.keyboard('{Control>}{Shift>}d{/Shift}{/Control}');
      
      expect(document.documentElement).not.toHaveClass('dark');
    });
  });

  describe('Theme Persistence', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('should persist theme preference in localStorage', async () => {
      const user = userEvent.setup();
      
      render(
        <ThemeProvider defaultTheme="light">
          <ThemeToggle />
        </ThemeProvider>
      );
      
      const toggleButton = screen.getByRole('button', { name: /toggle theme/i });
      await user.click(toggleButton);
      
      expect(localStorage.getItem('theme-preference')).toBe('dark');
      
      // Remount component
      render(
        <ThemeProvider>
          <div data-testid="remounted">Remounted</div>
        </ThemeProvider>
      );
      
      expect(document.documentElement).toHaveClass('dark');
    });

    it('should sync theme across browser tabs', async () => {
      render(
        <ThemeProvider defaultTheme="light">
          <div data-testid="tab1">Tab 1</div>
        </ThemeProvider>
      );
      
      // Simulate storage event from another tab
      const storageEvent = new StorageEvent('storage', {
        key: 'theme-preference',
        newValue: 'dark',
        oldValue: 'light',
      });
      
      window.dispatchEvent(storageEvent);
      
      await waitFor(() => {
        expect(document.documentElement).toHaveClass('dark');
      });
    });

    it('should handle corrupted localStorage gracefully', () => {
      localStorage.setItem('theme-preference', 'invalid-theme');
      
      render(
        <ThemeProvider>
          <div data-testid="content">Content</div>
        </ThemeProvider>
      );
      
      // Should fall back to system preference
      expect(document.documentElement).toHaveAttribute('data-theme');
      expect(['light', 'dark']).toContain(
        document.documentElement.getAttribute('data-theme')
      );
    });
  });

  describe('Theme Transition Animations', () => {
    it('should apply smooth transitions when changing themes', async () => {
      const user = userEvent.setup();
      
      render(
        <ThemeProvider defaultTheme="light" enableTransitions>
          <ThemeToggle />
          <div data-testid="content" className="bg-white dark:bg-gray-900">
            Content
          </div>
        </ThemeProvider>
      );
      
      const content = screen.getByTestId('content');
      expect(content).toHaveStyle({
        transition: 'background-color 0.3s ease, color 0.3s ease',
      });
      
      await user.click(screen.getByRole('button', { name: /toggle theme/i }));
      
      // Check transition is applied
      expect(content).toHaveClass('transition-colors');
    });

    it('should respect prefers-reduced-motion for theme transitions', () => {
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }));
      
      render(
        <ThemeProvider defaultTheme="light" enableTransitions>
          <div data-testid="content" className="bg-white dark:bg-gray-900">
            Content
          </div>
        </ThemeProvider>
      );
      
      const content = screen.getByTestId('content');
      expect(content).not.toHaveStyle({ transition: expect.any(String) });
    });
  });
});

describe('WCAG Accessibility Compliance', () => {
  describe('Color Contrast Ratios', () => {
    const testContrastCombinations = [
      { fg: 'rgb(0, 0, 0)', bg: 'rgb(255, 255, 255)', theme: 'light' },
      { fg: 'rgb(255, 255, 255)', bg: 'rgb(0, 0, 0)', theme: 'dark' },
      { fg: 'rgb(59, 130, 246)', bg: 'rgb(255, 255, 255)', theme: 'light' }, // blue-500 on white
      { fg: 'rgb(147, 197, 253)', bg: 'rgb(17, 24, 39)', theme: 'dark' }, // blue-300 on gray-900
    ];

    testContrastCombinations.forEach(({ fg, bg, theme }) => {
      it(`should meet WCAG AA contrast requirements in ${theme} mode`, () => {
        render(
          <ThemeProvider defaultTheme={theme}>
            <div 
              data-testid="contrast-test"
              style={{ color: fg, backgroundColor: bg }}
            >
              Test Text
            </div>
          </ThemeProvider>
        );
        
        const ratio = getContrastRatio(fg, bg);
        expect(ratio).toBeGreaterThanOrEqual(WCAG_AA.normal);
      });
    });

    it('should maintain AAA contrast ratios for critical UI elements', () => {
      render(
        <ThemeProvider defaultTheme="dark">
          <button className="bg-red-600 text-white">Critical Action</button>
          <div className="bg-green-600 text-white">Success Message</div>
          <div className="bg-yellow-500 text-black">Warning</div>
        </ThemeProvider>
      );
      
      // Error button
      const errorButton = screen.getByRole('button', { name: /critical action/i });
      const errorStyles = window.getComputedStyle(errorButton);
      const errorRatio = getContrastRatio(
        errorStyles.color,
        errorStyles.backgroundColor
      );
      expect(errorRatio).toBeGreaterThanOrEqual(WCAG_AAA.normal);
    });

    it('should provide sufficient contrast for disabled states', () => {
      render(
        <ThemeProvider defaultTheme="light">
          <button disabled className="disabled:opacity-50">
            Disabled Button
          </button>
          <input disabled placeholder="Disabled input" />
        </ThemeProvider>
      );
      
      const button = screen.getByRole('button');
      const input = screen.getByRole('textbox');
      
      // Even disabled elements should meet minimum contrast
      const buttonStyles = window.getComputedStyle(button);
      const buttonRatio = getContrastRatio(
        buttonStyles.color,
        buttonStyles.backgroundColor
      );
      expect(buttonRatio).toBeGreaterThanOrEqual(3); // Reduced requirement for disabled
      
      const inputStyles = window.getComputedStyle(input);
      const inputRatio = getContrastRatio(
        inputStyles.color,
        inputStyles.backgroundColor
      );
      expect(inputRatio).toBeGreaterThanOrEqual(3);
    });

    it('should ensure contrast for focus indicators', async () => {
      const user = userEvent.setup();
      
      render(
        <ThemeProvider defaultTheme="dark">
          <button className="focus:ring-2 focus:ring-blue-500">
            Focusable Button
          </button>
        </ThemeProvider>
      );
      
      const button = screen.getByRole('button');
      await user.tab();
      
      expect(button).toHaveFocus();
      expect(button).toHaveClass('focus:ring-2', 'focus:ring-blue-500');
      
      // Check focus ring contrast
      const styles = window.getComputedStyle(button);
      const ringColor = 'rgb(59, 130, 246)'; // blue-500
      const bgColor = styles.backgroundColor;
      const ratio = getContrastRatio(ringColor, bgColor);
      
      expect(ratio).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Screen Reader Support', () => {
    it('should announce theme changes to screen readers', async () => {
      const user = userEvent.setup();
      
      render(
        <AccessibilityProvider>
          <ThemeProvider defaultTheme="light">
            <ThemeToggle />
            <ScreenReaderAnnouncer />
          </ThemeProvider>
        </AccessibilityProvider>
      );
      
      const announcer = screen.getByRole('status', { name: /announcements/i });
      
      await user.click(screen.getByRole('button', { name: /toggle theme/i }));
      
      await waitFor(() => {
        expect(announcer).toHaveTextContent('Dark mode activated');
      });
      
      await user.click(screen.getByRole('button', { name: /toggle theme/i }));
      
      await waitFor(() => {
        expect(announcer).toHaveTextContent('Light mode activated');
      });
    });

    it('should properly label theme toggle button for screen readers', () => {
      render(
        <ThemeProvider defaultTheme="light">
          <ThemeToggle />
        </ThemeProvider>
      );
      
      const button = screen.getByRole('button', { name: /toggle theme/i });
      
      expect(button).toHaveAttribute('aria-label');
      expect(button).toHaveAttribute('aria-pressed', 'false');
      
      // Should indicate current state
      expect(button.getAttribute('aria-label')).toMatch(/switch to dark mode/i);
    });

    it('should provide screen reader descriptions for color-coded information', () => {
      render(
        <ThemeProvider defaultTheme="dark">
          <div className="bg-red-500" role="alert">
            <span className="sr-only">Error:</span>
            <span>Something went wrong</span>
          </div>
          <div className="bg-green-500" role="status">
            <span className="sr-only">Success:</span>
            <span>Operation completed</span>
          </div>
        </ThemeProvider>
      );
      
      expect(screen.getByText('Error:')).toHaveClass('sr-only');
      expect(screen.getByText('Success:')).toHaveClass('sr-only');
    });

    it('should maintain semantic HTML structure in both themes', () => {
      const { rerender } = render(
        <ThemeProvider defaultTheme="light">
          <main>
            <h1>Page Title</h1>
            <nav aria-label="Main">
              <ul>
                <li><a href="/home">Home</a></li>
              </ul>
            </nav>
            <section aria-labelledby="section-title">
              <h2 id="section-title">Section</h2>
              <p>Content</p>
            </section>
          </main>
        </ThemeProvider>
      );
      
      // Check structure in light mode
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      expect(screen.getByRole('navigation')).toBeInTheDocument();
      
      // Switch to dark mode
      rerender(
        <ThemeProvider defaultTheme="dark">
          <main>
            <h1>Page Title</h1>
            <nav aria-label="Main">
              <ul>
                <li><a href="/home">Home</a></li>
              </ul>
            </nav>
            <section aria-labelledby="section-title">
              <h2 id="section-title">Section</h2>
              <p>Content</p>
            </section>
          </main>
        </ThemeProvider>
      );
      
      // Structure should be identical
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });
  });

  describe('Focus Management', () => {
    it('should maintain focus visibility in both themes', async () => {
      const user = userEvent.setup();
      
      const { rerender } = render(
        <ThemeProvider defaultTheme="light">
          <FocusManager>
            <button>Button 1</button>
            <input type="text" />
            <a href="#">Link</a>
          </FocusManager>
        </ThemeProvider>
      );
      
      // Check focus in light mode
      await user.tab();
      let focused = document.activeElement;
      expect(focused).toHaveClass('focus:ring-2');
      
      // Switch to dark mode
      rerender(
        <ThemeProvider defaultTheme="dark">
          <FocusManager>
            <button>Button 1</button>
            <input type="text" />
            <a href="#">Link</a>
          </FocusManager>
        </ThemeProvider>
      );
      
      // Focus should still be visible
      focused = document.activeElement;
      expect(focused).toHaveClass('focus:ring-2');
    });

    it('should trap focus in modals regardless of theme', async () => {
      const user = userEvent.setup();
      
      render(
        <ThemeProvider defaultTheme="dark">
          <div role="dialog" aria-modal="true" data-testid="modal">
            <button>First</button>
            <button>Second</button>
            <button>Close</button>
          </div>
          <button data-testid="outside">Outside Modal</button>
        </ThemeProvider>
      );
      
      const modal = screen.getByTestId('modal');
      const buttons = within(modal).getAllByRole('button');
      
      // Focus first button
      buttons[0].focus();
      
      // Tab through modal
      await user.tab();
      expect(buttons[1]).toHaveFocus();
      
      await user.tab();
      expect(buttons[2]).toHaveFocus();
      
      // Should wrap back to first
      await user.tab();
      expect(buttons[0]).toHaveFocus();
      
      // Outside button should not be reachable
      const outsideButton = screen.getByTestId('outside');
      expect(outsideButton).not.toHaveFocus();
    });

    it('should restore focus after theme toggle', async () => {
      const user = userEvent.setup();
      
      render(
        <ThemeProvider defaultTheme="light">
          <input type="text" data-testid="input" />
          <ThemeToggle />
        </ThemeProvider>
      );
      
      const input = screen.getByTestId('input');
      input.focus();
      expect(input).toHaveFocus();
      
      // Toggle theme
      await user.click(screen.getByRole('button', { name: /toggle theme/i }));
      
      // Focus should return to input
      expect(input).toHaveFocus();
    });
  });

  describe('Skip Links', () => {
    it('should provide skip links for keyboard navigation', async () => {
      const user = userEvent.setup();
      
      render(
        <AccessibilityProvider>
          <ThemeProvider defaultTheme="light">
            <SkipLinks />
            <nav id="navigation">Navigation</nav>
            <main id="main">Main Content</main>
            <footer id="footer">Footer</footer>
          </ThemeProvider>
        </AccessibilityProvider>
      );
      
      // Tab to reveal skip links
      await user.tab();
      
      const skipToMain = screen.getByText(/skip to main content/i);
      expect(skipToMain).toBeVisible();
      expect(skipToMain).toHaveFocus();
      
      // Activate skip link
      await user.keyboard('{Enter}');
      
      // Focus should move to main
      expect(document.getElementById('main')).toHaveFocus();
    });

    it('should style skip links appropriately in both themes', async () => {
      const user = userEvent.setup();
      
      const { rerender } = render(
        <AccessibilityProvider>
          <ThemeProvider defaultTheme="light">
            <SkipLinks />
          </ThemeProvider>
        </AccessibilityProvider>
      );
      
      await user.tab();
      let skipLink = screen.getByText(/skip to main content/i);
      
      // Check light theme styling
      expect(skipLink).toHaveClass('bg-white', 'text-black');
      
      // Switch to dark theme
      rerender(
        <AccessibilityProvider>
          <ThemeProvider defaultTheme="dark">
            <SkipLinks />
          </ThemeProvider>
        </AccessibilityProvider>
      );
      
      await user.tab();
      skipLink = screen.getByText(/skip to main content/i);
      
      // Check dark theme styling
      expect(skipLink).toHaveClass('bg-gray-900', 'text-white');
    });
  });

  describe('High Contrast Mode', () => {
    it('should support Windows High Contrast Mode', () => {
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-contrast: high)',
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }));
      
      render(
        <ThemeProvider>
          <button className="bg-blue-500 text-white">Button</button>
        </ThemeProvider>
      );
      
      const button = screen.getByRole('button');
      
      // Should use system colors in high contrast mode
      expect(button).toHaveStyle({
        backgroundColor: 'ButtonFace',
        color: 'ButtonText',
        borderColor: 'ButtonBorder',
      });
    });

    it('should provide forced colors mode support', () => {
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(forced-colors: active)',
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }));
      
      render(
        <ThemeProvider>
          <div className="border-2 border-gray-300">
            Content with border
          </div>
        </ThemeProvider>
      );
      
      const div = screen.getByText(/content with border/i).parentElement;
      
      // Should use forced colors
      expect(div).toHaveStyle({
        borderColor: 'CanvasText',
      });
    });
  });

  describe('Color Blindness Support', () => {
    const colorBlindnessTypes = [
      'protanopia',
      'deuteranopia',
      'tritanopia',
      'achromatopsia',
    ];

    colorBlindnessTypes.forEach(type => {
      it(`should provide adequate contrast for ${type}`, () => {
        const simulator = new ColorBlindnessSimulator(type);
        
        render(
          <ThemeProvider defaultTheme="light">
            <div className="text-red-500">Error Text</div>
            <div className="text-green-500">Success Text</div>
            <div className="text-blue-500">Info Text</div>
          </ThemeProvider>
        );
        
        // Simulate color blindness
        const errorColor = simulator.simulate('rgb(239, 68, 68)');
        const successColor = simulator.simulate('rgb(34, 197, 94)');
        const infoColor = simulator.simulate('rgb(59, 130, 246)');
        
        // Check contrast ratios with simulated colors
        const bgColor = 'rgb(255, 255, 255)';
        
        expect(getContrastRatio(errorColor, bgColor)).toBeGreaterThanOrEqual(3);
        expect(getContrastRatio(successColor, bgColor)).toBeGreaterThanOrEqual(3);
        expect(getContrastRatio(infoColor, bgColor)).toBeGreaterThanOrEqual(3);
      });
    });

    it('should not rely solely on color to convey information', () => {
      render(
        <ThemeProvider defaultTheme="light">
          <div className="text-red-500" role="alert">
            <span aria-hidden="true">⚠️</span>
            <span>Error: Invalid input</span>
          </div>
          <div className="text-green-500" role="status">
            <span aria-hidden="true">✓</span>
            <span>Success: Saved</span>
          </div>
        </ThemeProvider>
      );
      
      // Check that icons and text provide redundant information
      expect(screen.getByText('⚠️')).toBeInTheDocument();
      expect(screen.getByText(/error:/i)).toBeInTheDocument();
      expect(screen.getByText('✓')).toBeInTheDocument();
      expect(screen.getByText(/success:/i)).toBeInTheDocument();
    });
  });

  describe('Axe Accessibility Tests', () => {
    it('should have no violations in light mode', async () => {
      const { container } = render(
        <ThemeProvider defaultTheme="light">
          <main>
            <h1>Page Title</h1>
            <form>
              <label htmlFor="input">Input Label</label>
              <input id="input" type="text" />
              <button type="submit">Submit</button>
            </form>
          </main>
        </ThemeProvider>
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no violations in dark mode', async () => {
      const { container } = render(
        <ThemeProvider defaultTheme="dark">
          <main>
            <h1>Page Title</h1>
            <form>
              <label htmlFor="input">Input Label</label>
              <input id="input" type="text" />
              <button type="submit">Submit</button>
            </form>
          </main>
        </ThemeProvider>
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no violations with complex UI components', async () => {
      const { container } = render(
        <AccessibilityProvider>
          <ThemeProvider defaultTheme="dark">
            <div role="tablist" aria-label="Settings">
              <button role="tab" aria-selected="true" aria-controls="panel-1">
                General
              </button>
              <button role="tab" aria-selected="false" aria-controls="panel-2">
                Advanced
              </button>
            </div>
            <div role="tabpanel" id="panel-1">
              General settings content
            </div>
          </ThemeProvider>
        </AccessibilityProvider>
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Performance', () => {
    it('should apply theme without layout shift', async () => {
      const { rerender } = render(
        <ThemeProvider defaultTheme="light">
          <div style={{ height: '100px', width: '100px' }}>
            Fixed size content
          </div>
        </ThemeProvider>
      );
      
      const element = screen.getByText(/fixed size content/i).parentElement;
      const initialRect = element?.getBoundingClientRect();
      
      // Switch theme
      rerender(
        <ThemeProvider defaultTheme="dark">
          <div style={{ height: '100px', width: '100px' }}>
            Fixed size content
          </div>
        </ThemeProvider>
      );
      
      const newRect = element?.getBoundingClientRect();
      
      // Dimensions should remain the same
      expect(newRect?.width).toBe(initialRect?.width);
      expect(newRect?.height).toBe(initialRect?.height);
    });

    it('should load theme CSS efficiently', () => {
      const startTime = performance.now();
      
      render(
        <ThemeProvider defaultTheme="dark">
          <div className="bg-white dark:bg-gray-900">Content</div>
        </ThemeProvider>
      );
      
      const loadTime = performance.now() - startTime;
      
      // Theme should apply quickly
      expect(loadTime).toBeLessThan(50);
    });

    it('should batch theme-related DOM updates', async () => {
      const user = userEvent.setup();
      let updateCount = 0;
      
      const observer = new MutationObserver(() => {
        updateCount++;
      });
      
      render(
        <ThemeProvider defaultTheme="light">
          <ThemeToggle />
          <div className="theme-aware">Content 1</div>
          <div className="theme-aware">Content 2</div>
          <div className="theme-aware">Content 3</div>
        </ThemeProvider>
      );
      
      observer.observe(document.documentElement, {
        attributes: true,
        subtree: true,
      });
      
      await user.click(screen.getByRole('button', { name: /toggle theme/i }));
      
      // Should batch updates
      expect(updateCount).toBeLessThanOrEqual(5); // Reasonable batch size
      
      observer.disconnect();
    });
  });
});