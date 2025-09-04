/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render } from '@testing-library/react';

// Test each UI component import individually
describe('Debug Component Imports', () => {
  test('Button should be defined', () => {
    const { Button } = require('@/components/ui/button');
    expect(Button).toBeDefined();
  });

  test('Input should be defined', () => {
    const { Input } = require('@/components/ui/input');
    expect(Input).toBeDefined();
  });

  test('Badge should be defined', () => {
    const { Badge } = require('@/components/ui/badge');
    expect(Badge).toBeDefined();
  });

  test('Checkbox should be defined', () => {
    const { Checkbox } = require('@/components/ui/checkbox');
    expect(Checkbox).toBeDefined();
  });

  test('Select components should be defined', () => {
    const Select = require('@/components/ui/select');
    expect(Select.Select).toBeDefined();
    expect(Select.SelectContent).toBeDefined();
    expect(Select.SelectItem).toBeDefined();
    expect(Select.SelectTrigger).toBeDefined();
    expect(Select.SelectValue).toBeDefined();
  });

  test('DropdownMenu components should be defined', () => {
    const DropdownMenu = require('@/components/ui/dropdown-menu');
    expect(DropdownMenu.DropdownMenu).toBeDefined();
    expect(DropdownMenu.DropdownMenuContent).toBeDefined();
    expect(DropdownMenu.DropdownMenuItem).toBeDefined();
    expect(DropdownMenu.DropdownMenuSeparator).toBeDefined();
    expect(DropdownMenu.DropdownMenuTrigger).toBeDefined();
    expect(DropdownMenu.DropdownMenuCheckboxItem).toBeDefined();
    expect(DropdownMenu.DropdownMenuLabel).toBeDefined();
  });

  test('Dialog components should be defined', () => {
    const Dialog = require('@/components/ui/dialog');
    expect(Dialog.Dialog).toBeDefined();
    expect(Dialog.DialogContent).toBeDefined();
    expect(Dialog.DialogDescription).toBeDefined();
    expect(Dialog.DialogFooter).toBeDefined();
    expect(Dialog.DialogHeader).toBeDefined();
    expect(Dialog.DialogTitle).toBeDefined();
  });

  test('Tooltip components should be defined', () => {
    const Tooltip = require('@/components/ui/tooltip');
    expect(Tooltip.Tooltip).toBeDefined();
    expect(Tooltip.TooltipContent).toBeDefined();
    expect(Tooltip.TooltipProvider).toBeDefined();
    expect(Tooltip.TooltipTrigger).toBeDefined();
  });

  test('Alert components should be defined', () => {
    const Alert = require('@/components/ui/alert');
    expect(Alert.Alert).toBeDefined();
    expect(Alert.AlertDescription).toBeDefined();
  });

  test('Progress should be defined', () => {
    const { Progress } = require('@/components/ui/progress');
    expect(Progress).toBeDefined();
  });

  test('Tabs components should be defined', () => {
    const Tabs = require('@/components/ui/tabs');
    expect(Tabs.Tabs).toBeDefined();
    expect(Tabs.TabsList).toBeDefined();
    expect(Tabs.TabsTrigger).toBeDefined();
    expect(Tabs.TabsContent).toBeDefined();
  });

  test('Card components should be defined', () => {
    const Card = require('@/components/ui/card');
    expect(Card.Card).toBeDefined();
    expect(Card.CardContent).toBeDefined();
    expect(Card.CardDescription).toBeDefined();
    expect(Card.CardHeader).toBeDefined();
    expect(Card.CardTitle).toBeDefined();
  });

  test('GlassCard should be defined', () => {
    const { GlassCard } = require('@/components/ui/glass-card');
    expect(GlassCard).toBeDefined();
  });
});