import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dbAgent } from './db-agent';
import * as portfolioTools from '../tools/portfolio';
import * as comparisonTools from '../tools/comparison';
import * as riskTools from '../tools/risk';

vi.mock('../logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

vi.mock('../tools/portfolio', () => ({
  getPortfolioSummary: vi.fn(),
  getHoldingDetail: vi.fn(),
}));

vi.mock('../tools/comparison', () => ({
  compareFunds: vi.fn(),
}));

vi.mock('../tools/risk', () => ({
  getFundRiskMetrics: vi.fn(),
}));

describe('DB-Agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('portfolio_summary task', () => {
    it('should successfully return portfolio summary', async () => {
      const mockSummary = { hasData: true, totalValue: 10000 };
      vi.mocked(portfolioTools.getPortfolioSummary).mockResolvedValueOnce(mockSummary as any);

      const result = await dbAgent({
        task: 'portfolio_summary',
        params: {}
      });

      expect(result.status).toBe('success');
      expect(result.data).toEqual(mockSummary);
      expect(portfolioTools.getPortfolioSummary).toHaveBeenCalledTimes(1);
    });
  });

  describe('holding_detail task', () => {
    it('should return error if fundCode is missing', async () => {
      const result = await dbAgent({
        task: 'holding_detail',
        params: {} // missing fundCode
      });

      expect(result.status).toBe('error');
      expect(result.error).toMatch(/requires params\.fundCode/);
    });

    it('should return holding details when fundCode is provided', async () => {
      const mockDetail = { fundCode: '000001', shares: 100 };
      vi.mocked(portfolioTools.getHoldingDetail).mockResolvedValueOnce(mockDetail as any);

      const result = await dbAgent({
        task: 'holding_detail',
        params: { fundCode: '000001' }
      });

      expect(result.status).toBe('success');
      expect(result.data).toEqual(mockDetail);
      expect(portfolioTools.getHoldingDetail).toHaveBeenCalledWith('000001');
    });
  });

  describe('compare_funds task', () => {
    it('should return error if no fundCodes provided', async () => {
      const result = await dbAgent({
        task: 'compare_funds',
        params: {} // missing both fundCode and fundCodes
      });

      expect(result.status).toBe('error');
      expect(result.error).toMatch(/requires at least one fund code/);
    });

    it('should call compareFunds with array of codes', async () => {
      vi.mocked(comparisonTools.compareFunds).mockResolvedValueOnce({ funds: [] } as any);

      const result = await dbAgent({
        task: 'compare_funds',
        params: { fundCodes: ['000001', '110011'] }
      });

      expect(result.status).toBe('success');
      expect(comparisonTools.compareFunds).toHaveBeenCalledWith(['000001', '110011']);
    });
  });

  describe('risk_metrics task', () => {
    it('should return error if fundCode is missing', async () => {
      const result = await dbAgent({
        task: 'risk_metrics',
        params: {} 
      });

      expect(result.status).toBe('error');
      expect(result.error).toMatch(/requires params\.fundCode/);
    });

    it('should call getFundRiskMetrics with period', async () => {
      vi.mocked(riskTools.getFundRiskMetrics).mockResolvedValueOnce({ riskLevel: 'low' } as any);

      const result = await dbAgent({
        task: 'risk_metrics',
        params: { fundCode: '000001', period: '3y' }
      });

      expect(result.status).toBe('success');
      expect(riskTools.getFundRiskMetrics).toHaveBeenCalledWith('000001', '3y');
    });
  });

  describe('invalid task', () => {
    it('should catch generic errors and return status:error', async () => {
      const result = await dbAgent({
        task: 'unknown_task' as any,
        params: {}
      });

      expect(result.status).toBe('error');
      expect(result.error).toMatch(/Unknown DB-Agent task/);
    });
  });
});
