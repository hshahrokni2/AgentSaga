/**
 * Mock Tooltip components for testing
 * Replaces Radix UI Tooltip which may cause issues in test environment
 */

import React from 'react';

export const TooltipProvider = ({ children }: any) => {
  return <>{children}</>;
};

export const Tooltip = ({ children }: any) => {
  return <>{children}</>;
};

export const TooltipTrigger = ({ children, asChild, ...props }: any) => {
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, props);
  }
  return <span {...props}>{children}</span>;
};

export const TooltipContent = ({ children, className, ...props }: any) => {
  return (
    <div 
      data-testid="mock-tooltip-content" 
      className={className}
      {...props}
    >
      {children}
    </div>
  );
};