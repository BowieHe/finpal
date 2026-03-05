import { describe, it, expect } from 'vitest';
import LoadingDots from './LoadingDots';

describe('LoadingDots', () => {
  it('should be defined', () => {
    expect(LoadingDots).toBeDefined();
  });

  it('should be a function component', () => {
    expect(typeof LoadingDots).toBe('function');
  });
});
