import { describe, it, expect } from 'vitest';
import {
  calcAnnualizedVolatility,
  calcMaxDrawdown,
  calcAnnualReturn,
  calcSharpeRatio,
  calcCalmarRatio,
  quantAgent,
} from './quant-agent';

describe('Quant-Agent Math Utilities', () => {
  describe('calcAnnualizedVolatility', () => {
    it('should return null for less than 20 data points', () => {
      const returns = new Array(19).fill(1.5);
      expect(calcAnnualizedVolatility(returns)).toBeNull();
    });

    it('should calculate correct volatility for a known series', () => {
      // 20 points, some variance
      const returns = [
        1.2, -0.5, 0.8, -1.0, 2.1, 0.3, -0.2, 1.5, -1.2, 0.5,
        0.8, -0.4, 1.1, -0.8, 1.5, 0.2, -0.1, 1.3, -0.9, 0.4
      ];
      const vol = calcAnnualizedVolatility(returns);
      
      // Calculate by hand or Python:
      // mean = 0.23
      // variance = 0.8621
      // stddev = 0.92849
      // annulized_vol = 0.92849 * sqrt(252) ~= 14.739 -> rounded to 14.74
      expect(vol).toBeCloseTo(14.74, 1);
    });
  });

  describe('calcMaxDrawdown', () => {
    it('should calculate correct MAX drawdown', () => {
      const navs = [1.0, 1.2, 0.8, 0.9, 0.7, 1.5];
      // Peak 1: 1.2 -> dips to 0.7 -> drawdown = (1.2-0.7)/1.2 = 0.4166 (41.67%)
      const mdd = calcMaxDrawdown(navs);
      expect(mdd).toBe(41.67);
    });

    it('should return 0 when monotonically increasing', () => {
      const navs = [1.0, 1.1, 1.2, 1.3];
      expect(calcMaxDrawdown(navs)).toBe(0);
    });
    
    it('should return null for less than 2 data points', () => {
      expect(calcMaxDrawdown([1.0])).toBeNull();
    });
  });

  describe('calcAnnualReturn', () => {
    it('should calculate annualized return correctly', () => {
      // 1.0 to 1.1 in 365 days -> 10%
      expect(calcAnnualReturn(1.0, 1.1, 365)).toBe(10.00);
      // 1.0 to 1.21 in 730 days -> 10%
      expect(calcAnnualReturn(1.0, 1.21, 730)).toBe(10.00);
    });

    it('should return null for invalid inputs', () => {
      expect(calcAnnualReturn(0, 1.1, 365)).toBeNull();
      expect(calcAnnualReturn(1.0, 1.1, 0)).toBeNull();
    });
  });

  describe('calcSharpeRatio', () => {
    it('should calculate Sharpe correctly', () => {
      // Return 10%, RiskFree 2.5%, Vol 15%
      // (0.10 - 0.025) / 0.15 = 0.075 / 0.15 = 0.5
      expect(calcSharpeRatio(10, 15, 0.025)).toBe(0.5);
    });

    it('should return null if volatility is 0', () => {
      expect(calcSharpeRatio(10, 0, 0.025)).toBeNull();
    });
  });

  describe('calcCalmarRatio', () => {
    it('should calculate Calmar correctly', () => {
      // Return 10%, Max Drawdown 20%
      // 10 / 20 = 0.5
      expect(calcCalmarRatio(10, 20)).toBe(0.5);
    });

    it('should return null if maxDrawdown is 0', () => {
      expect(calcCalmarRatio(10, 0)).toBeNull();
    });
  });
});

describe('Quant-Agent Node', () => {
  it('should generate complete output for sufficient data', async () => {
    // Generate 25 data points
    let currentNav = 1.0;
    const history = [currentNav];
    for (let i = 0; i < 24; i++) {
        currentNav *= 1.01; // 1% daily return
        history.push(currentNav);
    }
    // 25 points, strictly increasing

    const result = await quantAgent({
      fundCode: 'TEST01',
      priceHistory: history,
      riskFreeRate: 0.025
    });

    expect(result.agentId).toBe('quant-agent');
    expect(result.fundCode).toBe('TEST01');
    expect(result.insufficientData).toBe(false);
    expect(result.dataPoints).toBe(25);
    
    // Check fields exist and are numbers (not null)
    expect(typeof result.annualReturn).toBe('number');
    expect(typeof result.annualizedVolatility).toBe('number');
    expect(typeof result.maxDrawdown).toBe('number');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    
    // Max drawdown for strictly increasing should be 0, Calmar should be null 
    expect(result.maxDrawdown).toBe(0);
    expect(result.calmarRatio).toBeNull(); 
  });

  it('should return insufficientData flag when points < 20', async () => {
    const history = [1.0, 1.1, 1.05]; // Only 3 points

    const result = await quantAgent({
      fundCode: 'TEST02',
      priceHistory: history
    });

    expect(result.insufficientData).toBe(true);
    expect(result.annualReturn).toBeNull();
    expect(result.sharpeRatio).toBeNull();
    expect(result.maxDrawdown).toBeNull();
    expect(result.dataPoints).toBe(3);
  });
});
