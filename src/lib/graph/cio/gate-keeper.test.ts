import { describe, it, expect, vi } from 'vitest';
import { gateKeeperNode, gateKeeperRouter } from './gate-keeper';
import { GraphState } from '../state';

vi.mock('../../logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })
}));

describe('GateKeeper', () => {
  it('should return errors for critical missing data', async () => {
    const mockState: any = {
      plan: {
        requiresDebate: true,
        tasks: [
          { agent: 'db-agent', task: 'portfolio_summary', priority: 1, canSkip: false }
        ]
      },
      collectedData: {
        // Missing the data for db-agent
      }
    };

    const result = await gateKeeperNode(mockState);
    expect(result.errors?.length).toBeGreaterThan(0);
    expect(result.warnings?.length).toBe(0);
    expect(result.errors?.[0]).toMatch(/致命/);
  });

  it('should route to planning_loop if tasks were executed', () => {
    const route = gateKeeperRouter({
      errors: [],
      plan: { 
        requiresDebate: true,
        tasks: [{ agent: 'db-agent', task: 'portfolio_summary' }]
      }
    } as any);
    expect(route).toBe('planning_loop');
  });

  it('should route to optimistic if no tasks were in the last plan and debate is required', () => {
    const route = gateKeeperRouter({
      errors: [],
      plan: { 
        requiresDebate: true,
        tasks: [] // Empty tasks mean CIO finished planning
      }
    } as any);
    expect(route).toBe('optimistic');
  });

  it('should route to end_failure if state has critical errors', () => {
    const route = gateKeeperRouter({
      errors: ['[致命] 任务失败']
    } as any);
    expect(route).toBe('end_failure');
  });

  it('should route to direct_summary if requiresDebate is false', () => {
    const route = gateKeeperRouter({
      errors: [],
      plan: { requiresDebate: false }
    } as any);
    expect(route).toBe('direct_summary');
  });

  it('should yield warnings for skippable missing data', async () => {
    const mockState: any = {
      plan: {
        requiresDebate: true,
        tasks: [
          { agent: 'web-agent', task: 'market_news', priority: 1, canSkip: true }
        ]
      },
      collectedData: {
        'web-agent_market_news_0': { status: 'error', error: 'Timeout' }
      }
    };

    const result = await gateKeeperNode(mockState);
    expect(result.errors?.length).toBe(0);
    expect(result.warnings?.length).toBe(1);
  });
});
