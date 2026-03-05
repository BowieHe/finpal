import { describe, it, expect } from 'vitest';
import DebateBubble from './DebateBubble';

describe('DebateBubble', () => {
  it('should be defined', () => {
    expect(DebateBubble).toBeDefined();
  });

  it('should be a function component', () => {
    expect(typeof DebateBubble).toBe('function');
  });
});
