import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAuthedFetch = vi.fn();

vi.mock('@/lib/authFetch', () => ({
  authedFetch: (...args) => mockAuthedFetch(...args),
}));

describe('soldierDataService', () => {
  beforeEach(() => {
    vi.resetModules();
    mockAuthedFetch.mockReset();
  });

  it('searchSoldiersByName returns early for short terms', async () => {
    const { searchSoldiersByName } = await import('../soldierDataService.js');
    const results = await searchSoldiersByName('a');
    expect(results).toEqual([]);
    expect(mockAuthedFetch).not.toHaveBeenCalled();
  });

  it('searchSoldiersByName supports 200-record result sets', async () => {
    const { searchSoldiersByName } = await import('../soldierDataService.js');
    const rows = Array.from({ length: 200 }, (_, index) => ({
      fullName: `Soldier ${index}`,
      idNumber: `${100000000 + index}`,
      roomNumber: `${(index % 20) + 1}`,
    }));

    mockAuthedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ soldiers: rows }),
    });

    const results = await searchSoldiersByName('Soldier');
    expect(results).toHaveLength(200);
    expect(results[0].fullName).toBe('Soldier 0');
    expect(results[199].fullName).toBe('Soldier 199');
  });

  it('getSoldiersWithCache caches successful responses', async () => {
    const { getSoldiersWithCache, clearSoldiersCache } = await import('../soldierDataService.js');
    clearSoldiersCache();

    const first = await getSoldiersWithCache();
    const second = await getSoldiersWithCache();

    expect(first).toEqual([]);
    expect(second).toEqual([]);
  });
});
