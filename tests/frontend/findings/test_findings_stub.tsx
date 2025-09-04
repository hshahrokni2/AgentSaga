// Minimal stub component for testing purposes
import React from 'react';

export function FindingsTriageInterface({ supplierId }: { supplierId?: string }) {
  return (
    <div data-testid="findings-container">
      <h1>Findings Triage Interface</h1>
      <p>Supplier ID: {supplierId || 'None'}</p>
    </div>
  );
}