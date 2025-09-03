/**
 * @jest-environment jsdom
 * Navigation Shell Responsiveness Test Suite
 * Testing responsive design, touch targets, keyboard navigation, and mobile optimizations
 * Coverage Target: 95% navigation interactions, 100% WCAG compliance
 */

import React from 'react';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import '@testing-library/jest-dom';
import {
  NavigationShell,
  Sidebar,
  TopBar,
  MobileMenu,
  CommandPalette,
  BreadcrumbNav,
  TabNavigation,
  UserMenu,
} from '@/components/navigation';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useRouter } from 'next/navigation';

expect.extend(toHaveNoViolations);

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(() => '/insights'),
}));

// Mock viewport sizes
const viewports = {
  mobile: { width: 360, height: 640 },
  mobileL: { width: 425, height: 812 },
  tablet: { width: 768, height: 1024 },
  laptop: { width: 1024, height: 768 },
  desktop: { width: 1440, height: 900 },
  wide: { width: 1920, height: 1080 },
};

const setViewport = (viewport: keyof typeof viewports) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: viewports[viewport].width,
  });
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: viewports[viewport].height,
  });
  window.dispatchEvent(new Event('resize'));
};

describe('Navigation Shell Responsiveness', () => {
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({
      push: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      prefetch: jest.fn(),
    });
  });

  describe('Responsive Breakpoints', () => {
    it('should show mobile menu on screens < 768px', () => {
      setViewport('mobile');
      
      render(
        <NavigationShell>
          <div>Content</div>
        </NavigationShell>
      );
      
      expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
      expect(screen.queryByRole('navigation', { name: /main navigation/i })).not.toBeVisible();
    });

    it('should show sidebar on screens >= 768px', () => {
      setViewport('tablet');
      
      render(
        <NavigationShell>
          <div>Content</div>
        </NavigationShell>
      );
      
      expect(screen.queryByRole('button', { name: /open menu/i })).not.toBeInTheDocument();
      expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeVisible();
    });

    it('should adapt layout between 360px-1920px viewports', () => {
      Object.entries(viewports).forEach(([name, { width }]) => {
        setViewport(name as keyof typeof viewports);
        
        const { container } = render(
          <NavigationShell>
            <div>Responsive content</div>
          </NavigationShell>
        );
        
        const shell = container.querySelector('[data-navigation-shell]');
        expect(shell).toBeInTheDocument();
        
        if (width < 768) {
          expect(shell).toHaveClass('mobile-layout');
        } else if (width < 1024) {
          expect(shell).toHaveClass('tablet-layout');
        } else {
          expect(shell).toHaveClass('desktop-layout');
        }
      });
    });

    it('should handle viewport rotation gracefully', async () => {
      // Start in portrait
      setViewport('mobile');
      
      const { container } = render(
        <NavigationShell>
          <div>Rotatable content</div>
        </NavigationShell>
      );
      
      expect(container.querySelector('[data-orientation]')).toHaveAttribute('data-orientation', 'portrait');
      
      // Rotate to landscape
      Object.defineProperty(window, 'innerWidth', { value: 640 });
      Object.defineProperty(window, 'innerHeight', { value: 360 });
      window.dispatchEvent(new Event('orientationchange'));
      
      await waitFor(() => {
        expect(container.querySelector('[data-orientation]')).toHaveAttribute('data-orientation', 'landscape');
      });
    });

    it('should maintain scroll position during responsive changes', () => {
      const { container } = render(
        <NavigationShell>
          <div style={{ height: '200vh' }}>Long content</div>
        </NavigationShell>
      );
      
      // Scroll down
      window.scrollTo(0, 500);
      const initialScrollY = window.scrollY;
      
      // Change viewport
      setViewport('tablet');
      window.dispatchEvent(new Event('resize'));
      
      // Scroll position should be maintained
      expect(window.scrollY).toBe(initialScrollY);
    });
  });

  describe('Touch Target Accessibility', () => {
    it('should ensure all interactive elements meet 44px minimum touch target', () => {
      setViewport('mobile');
      
      const { container } = render(
        <NavigationShell>
          <Sidebar>
            <button>Home</button>
            <button>Insights</button>
            <button>Reports</button>
            <a href="/settings">Settings</a>
          </Sidebar>
        </NavigationShell>
      );
      
      const interactiveElements = container.querySelectorAll('button, a, [role="button"], [role="link"]');
      
      interactiveElements.forEach(element => {
        const rect = element.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(element);
        const totalHeight = rect.height + 
          parseFloat(computedStyle.paddingTop) + 
          parseFloat(computedStyle.paddingBottom);
        const totalWidth = rect.width + 
          parseFloat(computedStyle.paddingLeft) + 
          parseFloat(computedStyle.paddingRight);
        
        expect(totalHeight).toBeGreaterThanOrEqual(44);
        expect(totalWidth).toBeGreaterThanOrEqual(44);
      });
    });

    it('should provide adequate spacing between touch targets', () => {
      setViewport('mobile');
      
      render(
        <NavigationShell>
          <div className="flex flex-col">
            <button data-testid="btn-1">Button 1</button>
            <button data-testid="btn-2">Button 2</button>
            <button data-testid="btn-3">Button 3</button>
          </div>
        </NavigationShell>
      );
      
      const btn1 = screen.getByTestId('btn-1').getBoundingClientRect();
      const btn2 = screen.getByTestId('btn-2').getBoundingClientRect();
      const btn3 = screen.getByTestId('btn-3').getBoundingClientRect();
      
      // Check vertical spacing
      const spacing1to2 = btn2.top - btn1.bottom;
      const spacing2to3 = btn3.top - btn2.bottom;
      
      expect(spacing1to2).toBeGreaterThanOrEqual(8); // Minimum 8px spacing
      expect(spacing2to3).toBeGreaterThanOrEqual(8);
    });

    it('should handle touch gestures for mobile menu', async () => {
      setViewport('mobile');
      
      render(
        <NavigationShell>
          <MobileMenu />
        </NavigationShell>
      );
      
      const menuButton = screen.getByRole('button', { name: /open menu/i });
      
      // Simulate touch
      fireEvent.touchStart(menuButton, {
        touches: [{ clientX: 0, clientY: 0 }],
      });
      fireEvent.touchEnd(menuButton);
      
      await waitFor(() => {
        expect(screen.getByRole('navigation', { name: /mobile navigation/i })).toBeVisible();
      });
      
      // Test swipe to close
      const menu = screen.getByRole('navigation', { name: /mobile navigation/i });
      fireEvent.touchStart(menu, {
        touches: [{ clientX: 200, clientY: 100 }],
      });
      fireEvent.touchMove(menu, {
        touches: [{ clientX: 50, clientY: 100 }],
      });
      fireEvent.touchEnd(menu);
      
      await waitFor(() => {
        expect(menu).not.toBeVisible();
      });
    });

    it('should support pinch-to-zoom without interfering with navigation', () => {
      setViewport('mobile');
      
      const { container } = render(
        <NavigationShell>
          <div data-testid="content">Zoomable content</div>
        </NavigationShell>
      );
      
      const content = screen.getByTestId('content');
      
      // Simulate pinch gesture
      fireEvent.touchStart(content, {
        touches: [
          { clientX: 100, clientY: 100 },
          { clientX: 200, clientY: 200 },
        ],
      });
      
      fireEvent.touchMove(content, {
        touches: [
          { clientX: 50, clientY: 50 },
          { clientX: 250, clientY: 250 },
        ],
      });
      
      fireEvent.touchEnd(content);
      
      // Navigation should remain accessible
      expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support full keyboard navigation through menu items', async () => {
      const user = userEvent.setup();
      
      render(
        <NavigationShell>
          <Sidebar>
            <nav role="navigation" aria-label="Main navigation">
              <ul>
                <li><a href="/home">Home</a></li>
                <li><a href="/insights">Insights</a></li>
                <li><a href="/reports">Reports</a></li>
                <li><a href="/settings">Settings</a></li>
              </ul>
            </nav>
          </Sidebar>
        </NavigationShell>
      );
      
      // Tab through navigation
      await user.tab();
      expect(screen.getByRole('link', { name: /home/i })).toHaveFocus();
      
      await user.tab();
      expect(screen.getByRole('link', { name: /insights/i })).toHaveFocus();
      
      // Use arrow keys
      await user.keyboard('{ArrowDown}');
      expect(screen.getByRole('link', { name: /reports/i })).toHaveFocus();
      
      await user.keyboard('{ArrowUp}');
      expect(screen.getByRole('link', { name: /insights/i })).toHaveFocus();
      
      // Activate with Enter
      await user.keyboard('{Enter}');
      expect(useRouter().push).toHaveBeenCalledWith('/insights');
    });

    it('should trap focus in mobile menu when open', async () => {
      const user = userEvent.setup();
      setViewport('mobile');
      
      render(
        <NavigationShell>
          <MobileMenu>
            <button>First Button</button>
            <button>Second Button</button>
            <button>Close Menu</button>
          </MobileMenu>
        </NavigationShell>
      );
      
      // Open menu
      const menuButton = screen.getByRole('button', { name: /open menu/i });
      await user.click(menuButton);
      
      // Focus should be trapped in menu
      await user.tab();
      expect(screen.getByRole('button', { name: /first button/i })).toHaveFocus();
      
      await user.tab();
      expect(screen.getByRole('button', { name: /second button/i })).toHaveFocus();
      
      await user.tab();
      expect(screen.getByRole('button', { name: /close menu/i })).toHaveFocus();
      
      // Should cycle back to first
      await user.tab();
      expect(screen.getByRole('button', { name: /first button/i })).toHaveFocus();
      
      // Escape should close menu
      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /first button/i })).not.toBeVisible();
      });
    });

    it('should support keyboard shortcuts for navigation', async () => {
      const user = userEvent.setup();
      const router = useRouter();
      
      render(
        <NavigationShell>
          <CommandPalette />
        </NavigationShell>
      );
      
      // Cmd+K to open command palette
      await user.keyboard('{Meta>}k{/Meta}');
      
      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /command palette/i })).toBeVisible();
      });
      
      // Type to search
      await user.type(screen.getByRole('searchbox'), 'insights');
      
      // Select with Enter
      await user.keyboard('{Enter}');
      expect(router.push).toHaveBeenCalledWith('/insights');
      
      // Alt+← for back navigation
      await user.keyboard('{Alt>}{ArrowLeft}{/Alt}');
      expect(router.back).toHaveBeenCalled();
      
      // Alt+→ for forward navigation
      await user.keyboard('{Alt>}{ArrowRight}{/Alt}');
      expect(router.forward).toHaveBeenCalled();
    });

    it('should provide skip links for keyboard users', async () => {
      const user = userEvent.setup();
      
      render(
        <NavigationShell>
          <a href="#main" className="sr-only focus:not-sr-only">
            Skip to main content
          </a>
          <nav id="navigation">Navigation content</nav>
          <main id="main">Main content</main>
        </NavigationShell>
      );
      
      // Tab to reveal skip link
      await user.tab();
      const skipLink = screen.getByText(/skip to main content/i);
      
      expect(skipLink).toHaveFocus();
      expect(skipLink).toBeVisible();
      
      // Activate skip link
      await user.keyboard('{Enter}');
      
      // Focus should move to main content
      expect(document.activeElement?.id).toBe('main');
    });

    it('should announce navigation changes to screen readers', async () => {
      const user = userEvent.setup();
      
      render(
        <NavigationShell>
          <nav aria-live="polite" aria-atomic="true">
            <button data-testid="nav-home">Home</button>
            <button data-testid="nav-insights">Insights</button>
          </nav>
          <div role="status" aria-live="polite" data-testid="announcer" />
        </NavigationShell>
      );
      
      const announcer = screen.getByTestId('announcer');
      
      // Navigate to insights
      await user.click(screen.getByTestId('nav-insights'));
      
      await waitFor(() => {
        expect(announcer).toHaveTextContent('Navigated to Insights');
      });
    });
  });

  describe('Mobile-Specific Optimizations', () => {
    it('should implement pull-to-refresh on mobile', async () => {
      setViewport('mobile');
      const onRefresh = jest.fn();
      
      const { container } = render(
        <NavigationShell onPullToRefresh={onRefresh}>
          <div data-testid="content">Pull to refresh content</div>
        </NavigationShell>
      );
      
      const content = screen.getByTestId('content');
      
      // Simulate pull gesture
      fireEvent.touchStart(content, {
        touches: [{ clientX: 100, clientY: 50 }],
      });
      
      fireEvent.touchMove(content, {
        touches: [{ clientX: 100, clientY: 150 }],
      });
      
      fireEvent.touchEnd(content);
      
      await waitFor(() => {
        expect(onRefresh).toHaveBeenCalled();
      });
      
      // Should show refresh indicator
      expect(screen.getByRole('progressbar', { name: /refreshing/i })).toBeInTheDocument();
    });

    it('should hide address bar on scroll (mobile browsers)', () => {
      setViewport('mobile');
      
      const { container } = render(
        <NavigationShell>
          <div style={{ height: '200vh' }}>Scrollable content</div>
        </NavigationShell>
      );
      
      // Simulate scroll
      window.scrollY = 100;
      window.dispatchEvent(new Event('scroll'));
      
      const header = container.querySelector('header');
      expect(header).toHaveClass('minimal-header');
      
      // Scroll back up
      window.scrollY = 0;
      window.dispatchEvent(new Event('scroll'));
      
      expect(header).not.toHaveClass('minimal-header');
    });

    it('should optimize for one-handed mobile use', () => {
      setViewport('mobile');
      
      render(
        <NavigationShell>
          <MobileMenu position="bottom" />
        </NavigationShell>
      );
      
      const menu = screen.getByRole('navigation');
      const menuRect = menu.getBoundingClientRect();
      
      // Important actions should be in thumb-reach zone (bottom 60% of screen)
      const thumbReachZone = window.innerHeight * 0.4;
      expect(menuRect.top).toBeGreaterThanOrEqual(thumbReachZone);
      
      // Primary actions should be on the right for right-handed use
      const primaryActions = menu.querySelectorAll('[data-priority="high"]');
      primaryActions.forEach(action => {
        const rect = action.getBoundingClientRect();
        expect(rect.left).toBeGreaterThanOrEqual(window.innerWidth / 2);
      });
    });

    it('should handle iOS safe areas correctly', () => {
      setViewport('mobileL');
      
      // Mock iOS environment
      Object.defineProperty(navigator, 'userAgent', {
        value: 'iPhone',
        writable: true,
      });
      
      const { container } = render(
        <NavigationShell>
          <div>iOS content</div>
        </NavigationShell>
      );
      
      const shell = container.querySelector('[data-navigation-shell]');
      
      // Should have safe area padding
      expect(shell).toHaveStyle({
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      });
    });

    it('should disable hover effects on touch devices', () => {
      setViewport('mobile');
      
      // Mock touch device
      Object.defineProperty(navigator, 'maxTouchPoints', {
        value: 1,
        writable: true,
      });
      
      const { container } = render(
        <NavigationShell>
          <button className="hover:bg-blue-500">Touch Button</button>
        </NavigationShell>
      );
      
      const button = container.querySelector('button');
      
      // Should have touch-specific styles
      expect(button).toHaveClass('touch:bg-blue-600');
      expect(button).not.toHaveClass('hover:bg-blue-500');
    });
  });

  describe('Breadcrumb Navigation', () => {
    it('should render breadcrumb trail with proper hierarchy', () => {
      const breadcrumbs = [
        { label: 'Home', href: '/' },
        { label: 'Insights', href: '/insights' },
        { label: 'INS-2024-09-001', href: '/insights/INS-2024-09-001' },
      ];
      
      render(
        <NavigationShell>
          <BreadcrumbNav items={breadcrumbs} />
        </NavigationShell>
      );
      
      const nav = screen.getByRole('navigation', { name: /breadcrumb/i });
      const links = within(nav).getAllByRole('link');
      
      expect(links).toHaveLength(2); // Last item shouldn't be a link
      expect(screen.getByText('INS-2024-09-001')).toHaveAttribute('aria-current', 'page');
      
      // Check separators
      const separators = nav.querySelectorAll('[aria-hidden="true"]');
      expect(separators).toHaveLength(2);
    });

    it('should collapse breadcrumbs on mobile', () => {
      setViewport('mobile');
      
      const breadcrumbs = [
        { label: 'Home', href: '/' },
        { label: 'Insights', href: '/insights' },
        { label: 'Critical', href: '/insights/critical' },
        { label: 'INS-2024-09-001', href: '/insights/critical/INS-2024-09-001' },
      ];
      
      render(
        <NavigationShell>
          <BreadcrumbNav items={breadcrumbs} collapsible />
        </NavigationShell>
      );
      
      // Should show first and last with ellipsis
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('...')).toBeInTheDocument();
      expect(screen.getByText('INS-2024-09-001')).toBeInTheDocument();
      
      // Middle items should be hidden
      expect(screen.queryByText('Insights')).not.toBeInTheDocument();
      expect(screen.queryByText('Critical')).not.toBeInTheDocument();
    });
  });

  describe('Tab Navigation', () => {
    it('should support horizontal tab navigation with keyboard', async () => {
      const user = userEvent.setup();
      
      const tabs = [
        { id: 'overview', label: 'Overview' },
        { id: 'findings', label: 'Findings' },
        { id: 'insights', label: 'Insights' },
        { id: 'reports', label: 'Reports' },
      ];
      
      render(
        <NavigationShell>
          <TabNavigation tabs={tabs} activeTab="overview" />
        </NavigationShell>
      );
      
      const tabList = screen.getByRole('tablist');
      const tabButtons = within(tabList).getAllByRole('tab');
      
      // First tab should be selected
      expect(tabButtons[0]).toHaveAttribute('aria-selected', 'true');
      
      // Navigate with arrow keys
      tabButtons[0].focus();
      await user.keyboard('{ArrowRight}');
      expect(tabButtons[1]).toHaveFocus();
      
      await user.keyboard('{ArrowLeft}');
      expect(tabButtons[0]).toHaveFocus();
      
      // Wrap around
      await user.keyboard('{ArrowLeft}');
      expect(tabButtons[3]).toHaveFocus();
    });

    it('should scroll tabs horizontally on mobile when overflowing', () => {
      setViewport('mobile');
      
      const tabs = Array.from({ length: 10 }, (_, i) => ({
        id: `tab-${i}`,
        label: `Tab ${i + 1}`,
      }));
      
      const { container } = render(
        <NavigationShell>
          <TabNavigation tabs={tabs} activeTab="tab-0" scrollable />
        </NavigationShell>
      );
      
      const tabContainer = container.querySelector('[role="tablist"]');
      expect(tabContainer).toHaveClass('overflow-x-auto');
      expect(tabContainer).toHaveStyle({ scrollSnapType: 'x mandatory' });
      
      // Each tab should have scroll snap
      const tabButtons = container.querySelectorAll('[role="tab"]');
      tabButtons.forEach(tab => {
        expect(tab).toHaveStyle({ scrollSnapAlign: 'start' });
      });
    });
  });

  describe('User Menu', () => {
    it('should position user menu appropriately on different screen sizes', async () => {
      const user = userEvent.setup();
      
      // Desktop - dropdown below
      setViewport('desktop');
      const { rerender } = render(
        <NavigationShell>
          <UserMenu />
        </NavigationShell>
      );
      
      await user.click(screen.getByRole('button', { name: /user menu/i }));
      const desktopMenu = screen.getByRole('menu');
      expect(desktopMenu).toHaveClass('top-full');
      
      // Mobile - full screen overlay
      setViewport('mobile');
      rerender(
        <NavigationShell>
          <UserMenu />
        </NavigationShell>
      );
      
      await user.click(screen.getByRole('button', { name: /user menu/i }));
      const mobileMenu = screen.getByRole('menu');
      expect(mobileMenu).toHaveClass('fixed', 'inset-0');
    });
  });

  describe('Performance', () => {
    it('should render navigation within 100ms', () => {
      const start = performance.now();
      
      render(
        <NavigationShell>
          <Sidebar />
          <TopBar />
          <BreadcrumbNav items={[]} />
          <div>Content</div>
        </NavigationShell>
      );
      
      const end = performance.now();
      expect(end - start).toBeLessThan(100);
    });

    it('should debounce resize events', async () => {
      const handleResize = jest.fn();
      
      render(
        <NavigationShell onResize={handleResize}>
          <div>Resizable content</div>
        </NavigationShell>
      );
      
      // Fire multiple resize events quickly
      for (let i = 0; i < 10; i++) {
        window.dispatchEvent(new Event('resize'));
      }
      
      // Should only call handler once after debounce
      await waitFor(() => {
        expect(handleResize).toHaveBeenCalledTimes(1);
      }, { timeout: 300 });
    });

    it('should lazy load mobile menu until needed', () => {
      setViewport('mobile');
      
      const { container } = render(
        <NavigationShell>
          <div>Content</div>
        </NavigationShell>
      );
      
      // Mobile menu should not be in DOM initially
      expect(container.querySelector('[data-mobile-menu-content]')).not.toBeInTheDocument();
      
      // Click to open
      const menuButton = screen.getByRole('button', { name: /open menu/i });
      fireEvent.click(menuButton);
      
      // Now it should be loaded
      expect(container.querySelector('[data-mobile-menu-content]')).toBeInTheDocument();
    });
  });

  describe('Accessibility Compliance', () => {
    it('should have no WCAG violations in navigation shell', async () => {
      const { container } = render(
        <NavigationShell>
          <Sidebar />
          <TopBar />
          <main>
            <h1>Page Title</h1>
            <p>Page content</p>
          </main>
        </NavigationShell>
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should properly label all navigation regions', () => {
      render(
        <NavigationShell>
          <Sidebar />
          <BreadcrumbNav items={[]} />
          <TabNavigation tabs={[]} />
        </NavigationShell>
      );
      
      expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument();
      expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument();
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    it('should maintain focus visibility throughout navigation', async () => {
      const user = userEvent.setup();
      
      render(
        <NavigationShell>
          <button>Button 1</button>
          <a href="#">Link 1</a>
          <input type="text" />
        </NavigationShell>
      );
      
      // Tab through elements
      await user.tab();
      let focused = document.activeElement;
      expect(focused).toHaveClass('focus:ring-2');
      
      await user.tab();
      focused = document.activeElement;
      expect(focused).toHaveClass('focus:ring-2');
      
      await user.tab();
      focused = document.activeElement;
      expect(focused).toHaveClass('focus:ring-2');
    });
  });
});