import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  type MockInstance,
  test,
  vi,
} from 'vitest';

vi.hoisted(() => {
  process.env.POSTHOG_PUBLIC_KEY = 'phc_test_key';
});

import {
  flushFromFile,
  flushPayload,
  getOrCreateAnonymousId,
  isDisabled,
  trackCommand,
} from '../../src/lib/telemetry';
import { captureTestEnv } from '../helpers';

const testConfigDir = join(tmpdir(), `resend-telemetry-test-${process.pid}`);
const testResendDir = join(testConfigDir, 'resend');

vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => ({ unref: vi.fn() })),
}));

describe('isDisabled', () => {
  const restoreEnv = captureTestEnv();

  afterEach(() => {
    restoreEnv();
  });

  test('returns true when DO_NOT_TRACK=1', () => {
    process.env.DO_NOT_TRACK = '1';
    delete process.env.RESEND_TELEMETRY_DISABLED;
    expect(isDisabled()).toBe(true);
  });

  test('returns true when RESEND_TELEMETRY_DISABLED=1', () => {
    delete process.env.DO_NOT_TRACK;
    process.env.RESEND_TELEMETRY_DISABLED = '1';
    expect(isDisabled()).toBe(true);
  });

  test('returns false when neither env var set', () => {
    delete process.env.DO_NOT_TRACK;
    delete process.env.RESEND_TELEMETRY_DISABLED;
    expect(isDisabled()).toBe(false);
  });
});

describe('getOrCreateAnonymousId', () => {
  const restoreEnv = captureTestEnv();

  beforeEach(() => {
    mkdirSync(testResendDir, { recursive: true });
    process.env.XDG_CONFIG_HOME = testConfigDir;
  });

  afterEach(() => {
    restoreEnv();
    if (existsSync(testConfigDir)) {
      rmSync(testConfigDir, { recursive: true, force: true });
    }
  });

  test('creates and persists a UUID', () => {
    const id = getOrCreateAnonymousId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );

    const stored = readFileSync(join(testResendDir, 'telemetry-id'), 'utf-8');
    expect(stored).toBe(id);
  });

  test('returns same ID on subsequent calls', () => {
    const first = getOrCreateAnonymousId();
    const second = getOrCreateAnonymousId();
    expect(first).toBe(second);
  });
});

describe('trackCommand', () => {
  const restoreEnv = captureTestEnv();
  let spawnMock: MockInstance;
  let stderrSpy: MockInstance;
  let unrefMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mkdirSync(testResendDir, { recursive: true });
    process.env.XDG_CONFIG_HOME = testConfigDir;
    delete process.env.DO_NOT_TRACK;
    delete process.env.RESEND_TELEMETRY_DISABLED;

    unrefMock = vi.fn();
    const cp = await import('node:child_process');
    spawnMock = vi
      .mocked(cp.spawn)
      // @ts-expect-error -- only unref() is needed for this test
      .mockReturnValue({ unref: unrefMock });

    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
  });

  afterEach(() => {
    for (const call of spawnMock.mock.calls) {
      const args = call[1] as string[];
      const filePath = args[args.length - 1];
      if (filePath?.endsWith('.json') && existsSync(filePath)) {
        rmSync(filePath, { force: true });
      }
    }
    spawnMock.mockClear();
    stderrSpy.mockRestore();
    restoreEnv();
    if (existsSync(testConfigDir)) {
      rmSync(testConfigDir, { recursive: true, force: true });
    }
  });

  function parsePayload() {
    const args = spawnMock.mock.calls[0][1] as string[];
    const filePath = args[args.length - 1];
    const content = readFileSync(filePath, 'utf-8');
    rmSync(filePath, { force: true });
    return JSON.parse(content);
  }

  test('spawns detached process with payload in temp file', () => {
    trackCommand('emails send', { json: true });

    expect(spawnMock).toHaveBeenCalledOnce();
    const [execPath, args, options] = spawnMock.mock.calls[0];
    expect(execPath).toBe(process.execPath);
    expect(args).toContain('telemetry');
    expect(args).toContain('flush');
    const filePath = args[args.length - 1] as string;
    expect(filePath).toMatch(/resend-telemetry-.*\.json$/);
    expect(options.detached).toBe(true);
    expect(options.stdio).toBe('ignore');
    expect(options.env.RESEND_TELEMETRY_DISABLED).toBe('1');

    const body = parsePayload();
    expect(body.event).toBe('cli.used');
    expect(body.properties.command).toBe('emails send');
    expect(body.properties.os).toBeTypeOf('string');
    expect(body.properties.node_version).toBe(process.version);
    expect(body.api_key).toBeTruthy();
    expect(body.distinct_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  test('calls child.unref()', () => {
    trackCommand('emails send', {});
    expect(unrefMock).toHaveBeenCalledOnce();
  });

  test('interactive is false when --json flag is set', () => {
    Object.defineProperty(process.stdin, 'isTTY', {
      value: true,
      writable: true,
    });
    Object.defineProperty(process.stdout, 'isTTY', {
      value: true,
      writable: true,
    });
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;

    trackCommand('emails send', { json: true });
    expect(parsePayload().properties.interactive).toBe(false);
  });

  test('interactive is false when not a TTY', () => {
    Object.defineProperty(process.stdin, 'isTTY', {
      value: undefined,
      writable: true,
    });
    Object.defineProperty(process.stdout, 'isTTY', {
      value: undefined,
      writable: true,
    });

    trackCommand('emails list', {});
    expect(parsePayload().properties.interactive).toBe(false);
  });

  test('interactive is false in CI even with TTY', () => {
    Object.defineProperty(process.stdin, 'isTTY', {
      value: true,
      writable: true,
    });
    Object.defineProperty(process.stdout, 'isTTY', {
      value: true,
      writable: true,
    });
    process.env.CI = 'true';

    trackCommand('emails list', {});
    expect(parsePayload().properties.interactive).toBe(false);
  });

  test('interactive is true with TTY and no --json', () => {
    Object.defineProperty(process.stdin, 'isTTY', {
      value: true,
      writable: true,
    });
    Object.defineProperty(process.stdout, 'isTTY', {
      value: true,
      writable: true,
    });
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;
    delete process.env.TERM;

    trackCommand('emails list', {});
    expect(parsePayload().properties.interactive).toBe(true);
  });

  test('includes flags in payload when provided', () => {
    trackCommand('emails send', {
      flags: ['to', 'subject'],
      globalFlags: ['json'],
    });
    const body = parsePayload();
    expect(body.properties.flags).toEqual(['to', 'subject']);
    expect(body.properties.global_flags).toEqual(['json']);
  });

  test('omits flags from payload when empty', () => {
    trackCommand('emails list', {});
    const body = parsePayload();
    expect(body.properties.flags).toBeUndefined();
    expect(body.properties.global_flags).toBeUndefined();
  });

  test('omits flags from payload when arrays are empty', () => {
    trackCommand('emails list', { flags: [], globalFlags: [] });
    const body = parsePayload();
    expect(body.properties.flags).toBeUndefined();
    expect(body.properties.global_flags).toBeUndefined();
  });

  test('does nothing when disabled', () => {
    process.env.RESEND_TELEMETRY_DISABLED = '1';
    trackCommand('emails send', {});
    expect(spawnMock).not.toHaveBeenCalled();
  });

  test('handles spawn failures gracefully', () => {
    spawnMock.mockImplementation(() => {
      throw new Error('spawn error');
    });
    expect(() => trackCommand('emails send', {})).not.toThrow();
  });

  test('shows first-run notice only once', () => {
    Object.defineProperty(process.stdin, 'isTTY', {
      value: true,
      writable: true,
    });
    Object.defineProperty(process.stdout, 'isTTY', {
      value: true,
      writable: true,
    });
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;
    delete process.env.TERM;

    trackCommand('emails send', {});
    const notice1 = stderrSpy.mock.calls.length;

    trackCommand('domains list', {});
    const notice2 = stderrSpy.mock.calls.length;

    expect(notice1).toBe(1);
    expect(notice2).toBe(1);

    expect(existsSync(join(testResendDir, 'telemetry-notice-shown'))).toBe(
      true,
    );
  });
});

describe('flushPayload', () => {
  let fetchSpy: MockInstance;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
    } as Response);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  test('POSTs payload to PostHog endpoint', async () => {
    const payload = JSON.stringify({
      api_key: 'test-key',
      distinct_id: 'test-id',
      event: 'cli.used',
      properties: { command: 'emails send' },
    });

    await flushPayload(payload);

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://us.i.posthog.com/capture/');
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(options.body).toBe(payload);
  });

  test('rejects invalid JSON', async () => {
    await expect(flushPayload('not json')).rejects.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('propagates fetch errors', async () => {
    fetchSpy.mockRejectedValue(new Error('network error'));
    await expect(flushPayload('{}')).rejects.toThrow('network error');
  });

  test('throws on non-ok HTTP response', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 400 } as Response);
    await expect(flushPayload('{}')).rejects.toThrow('telemetry flush failed');
  });
});

describe('flushFromFile', () => {
  let fetchSpy: MockInstance;
  const tmpFile = join(tmpdir(), `resend-telemetry-${process.pid}-0.json`);

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
    } as Response);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    if (existsSync(tmpFile)) {
      rmSync(tmpFile);
    }
  });

  test('reads file, sends payload, then deletes it', async () => {
    const payload = JSON.stringify({ event: 'test' });
    writeFileSync(tmpFile, payload);

    await flushFromFile(tmpFile);

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(options.body).toBe(payload);
    expect(existsSync(tmpFile)).toBe(false);
  });

  test('preserves file when flush fails', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 500 } as Response);
    const payload = JSON.stringify({ event: 'test' });
    writeFileSync(tmpFile, payload);

    await expect(flushFromFile(tmpFile)).rejects.toThrow();
    expect(existsSync(tmpFile)).toBe(true);
  });
});
