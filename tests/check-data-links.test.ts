import { describe, expect, it, vi } from 'vitest';
import { checkLink, type Fetch } from '../scripts/check-data-links';

const references = [{ file: 'project.yaml', path: 'projects.project.website' }];
const options = { maxAttempts: 3, retryDelayMs: 0, timeoutMs: 100 };

describe('data link checker', () => {
  it('retries transient fetch failures', async () => {
    const fetchImpl = vi.fn<Fetch>();
    fetchImpl.mockRejectedValueOnce(new TypeError('fetch failed'));
    fetchImpl.mockRejectedValueOnce(new TypeError('fetch failed'));
    fetchImpl.mockResolvedValue(new Response(null, { status: 200 }));

    await expect(
      checkLink('https://example.com', references, fetchImpl, options),
    ).resolves.toMatchObject({
      status: 'ok',
      message: 'HTTP 200 after 2 attempts',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('does not retry a definite broken-link response', async () => {
    const fetchImpl = vi.fn<Fetch>().mockResolvedValue(new Response(null, { status: 404 }));

    await expect(
      checkLink('https://example.com', references, fetchImpl, options),
    ).resolves.toMatchObject({
      status: 'fail',
      message: 'HTTP 404',
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('fails after repeated transport errors', async () => {
    const fetchImpl = vi.fn<Fetch>().mockRejectedValue(new TypeError('fetch failed'));

    await expect(
      checkLink('https://example.com', references, fetchImpl, options),
    ).resolves.toMatchObject({
      status: 'fail',
      message: 'fetch failed after 3 attempts',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(6);
  });

  it('keeps protected links as warnings without retrying', async () => {
    const fetchImpl = vi.fn<Fetch>().mockResolvedValue(new Response(null, { status: 403 }));

    await expect(
      checkLink('https://example.com', references, fetchImpl, options),
    ).resolves.toMatchObject({
      status: 'warn',
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
