/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render } from '@testing-library/react';

describe('Dialog Import Check', () => {
  test('Dialog components should be defined', () => {
    const Dialog = require('@/components/ui/dialog');
    
    console.log('Dialog exports:', Object.keys(Dialog));
    console.log('Dialog:', Dialog.Dialog);
    console.log('DialogContent:', Dialog.DialogContent);
    
    expect(Dialog.Dialog).toBeDefined();
    expect(Dialog.DialogContent).toBeDefined();
    expect(Dialog.DialogHeader).toBeDefined();
    expect(Dialog.DialogTitle).toBeDefined();
    expect(Dialog.DialogDescription).toBeDefined();
    expect(Dialog.DialogFooter).toBeDefined();
  });
  
  test('Can render Dialog', () => {
    const { Dialog, DialogContent } = require('@/components/ui/dialog');
    
    const { container } = render(
      <Dialog open={true}>
        <DialogContent>Test Content</DialogContent>
      </Dialog>
    );
    
    expect(container).toBeTruthy();
  });
});