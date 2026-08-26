import { describe, expect, it, vi } from 'vitest';
import { checkLink, type Fetch, type ResolveHostname } from '../scripts/check-data-links';

const references = [{ file: 'project.yaml', path: 'projects.project.website' }];
const resolveHostname: ResolveHostname = async () => [{ address: '93.184.216.34', family: 4 }];
const options = { maxAttempts: 3, retryDelayMs: 0, resolveHostname, timeoutMs: 100 };

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

  it('warns after repeated temporary server failures', async () => {
    const fetchImpl = vi.fn<Fetch>().mockResolvedValue(new Response(null, { status: 502 }));

    await expect(
      checkLink('https://example.com', references, fetchImpl, options),
    ).resolves.toMatchObject({
      status: 'warn',
      message: 'HTTP 502 after 3 attempts; temporary server failure was not treated as broken',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(6);
  });

  it('fails immediately when redirects form a loop', async () => {
    const fetchImpl = vi.fn<Fetch>((input) => {
      const url = new URL(input.toString());
      const location =
        url.hostname === 'example.com' ? 'https://docs.example.com/' : 'https://example.com/';
      return Promise.resolve(new Response(null, { status: 301, headers: { Location: location } }));
    });

    await expect(
      checkLink('https://example.com/', references, fetchImpl, options),
    ).resolves.toMatchObject({
      status: 'fail',
      message: 'Redirect loop detected at https://example.com/',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('rejects literal and resolved private addresses without fetching them', async () => {
    const fetchImpl = vi.fn<Fetch>();

    await expect(
      checkLink('http://127.0.0.1/', references, fetchImpl, options),
    ).resolves.toMatchObject({
      status: 'fail',
      message: expect.stringContaining('Blocked non-public address'),
    });
    await expect(
      checkLink('https://internal.example.com/', references, fetchImpl, {
        ...options,
        resolveHostname: async () => [{ address: '10.0.0.5', family: 4 }],
      }),
    ).resolves.toMatchObject({
      status: 'fail',
      message: expect.stringContaining('Blocked non-public address'),
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('does not confuse public IPv4 addresses with IPv4-mapped IPv6 addresses', async () => {
    const fetchImpl = vi.fn<Fetch>().mockResolvedValue(new Response(null, { status: 200 }));

    await expect(
      checkLink('https://example.com/', references, fetchImpl, {
        ...options,
        resolveHostname: async () => [{ address: '104.18.43.134', family: 4 }],
      }),
    ).resolves.toMatchObject({ status: 'ok' });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('validates redirect targets before following them', async () => {
    const fetchImpl = vi
      .fn<Fetch>()
      .mockResolvedValue(
        new Response(null, { status: 302, headers: { Location: 'http://169.254.169.254/' } }),
      );

    await expect(
      checkLink('https://example.com', references, fetchImpl, options),
    ).resolves.toMatchObject({
      status: 'fail',
      message: expect.stringContaining('Blocked non-public address'),
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('rejects credentials and nonstandard ports', async () => {
    const fetchImpl = vi.fn<Fetch>();

    await expect(
      checkLink('https://user:password@example.com/', references, fetchImpl, options),
    ).resolves.toMatchObject({ status: 'fail' });
    await expect(
      checkLink('https://example.com:8443/', references, fetchImpl, options),
    ).resolves.toMatchObject({ status: 'fail' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
