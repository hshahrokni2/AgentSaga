/**
 * Mock Dialog component for testing
 * Replaces Radix UI Dialog which causes issues in test environment
 */

import React from 'react';

export const Dialog = ({ children, open, onOpenChange }: any) => {
  if (!open) return null;
  return <div data-testid="mock-dialog">{children}</div>;
};

export const DialogContent = ({ children, className }: any) => {
  return (
    <div data-testid="mock-dialog-content" className={className}>
      {children}
    </div>
  );
};

export const DialogHeader = ({ children, className }: any) => {
  return (
    <div data-testid="mock-dialog-header" className={className}>
      {children}
    </div>
  );
};

export const DialogTitle = ({ children, className }: any) => {
  return (
    <h2 data-testid="mock-dialog-title" className={className}>
      {children}
    </h2>
  );
};

export const DialogDescription = ({ children, className }: any) => {
  return (
    <p data-testid="mock-dialog-description" className={className}>
      {children}
    </p>
  );
};

export const DialogFooter = ({ children, className }: any) => {
  return (
    <div data-testid="mock-dialog-footer" className={className}>
      {children}
    </div>
  );
};

export const DialogTrigger = ({ children, asChild, ...props }: any) => {
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, props);
  }
  return <button {...props}>{children}</button>;
};

export const DialogClose = ({ children, ...props }: any) => {
  return <button data-testid="mock-dialog-close" {...props}>{children}</button>;
};