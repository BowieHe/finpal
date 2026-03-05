import { describe, it, expect } from 'vitest';
import TypewriterText from './TypewriterText';

describe('TypewriterText', () => {
  it('should be defined', () => {
    expect(TypewriterText).toBeDefined();
  });

  it('should be a function component', () => {
    expect(typeof TypewriterText).toBe('function');
  });
});
