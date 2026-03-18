import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
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
import {
  getOrCreateAnonymousId,
  isDisabled,
  trackCommand,
} from '../../src/lib/telemetry';
import { captureTestEnv } from '../helpers';

const testConfigDir = join(tmpdir(), `resend-telemetry-test-${process.pid}`);
const testResendDir = join(testConfigDir, 'resend');

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
  let fetchSpy: MockInstance;
  let stderrSpy: MockInstance;

  beforeEach(() => {
    mkdirSync(testResendDir, { recursive: true });
    process.env.XDG_CONFIG_HOME = testConfigDir;
    delete process.env.DO_NOT_TRACK;
    delete process.env.RESEND_TELEMETRY_DISABLED;

    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
    } as Response);

    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    stderrSpy.mockRestore();
    restoreEnv();
    if (existsSync(testConfigDir)) {
      rmSync(testConfigDir, { recursive: true, force: true });
    }
  });

  function parsePayload() {
    const [, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    return JSON.parse(options.body as string);
  }

  test('sends correct payload to PostHog endpoint', () => {
    trackCommand('emails send', { json: true });

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://us.i.posthog.com/capture/');
    expect(options.method).toBe('POST');

    const body = parsePayload();
    expect(body.event).toBe('cli.used');
    expect(body.properties.command).toBe('emails send');
    expect(body.properties.os).toBe(process.platform);
    expect(body.properties.arch).toBe(process.arch);
    expect(body.properties.node_version).toBe(process.version);
    expect(body.api_key).toBeTruthy();
    expect(body.distinct_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
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

    trackCommand('emails list', {});
    expect(parsePayload().properties.interactive).toBe(true);
  });

  test('does nothing when disabled', () => {
    process.env.RESEND_TELEMETRY_DISABLED = '1';
    trackCommand('emails send', {});
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('handles fetch failures gracefully', () => {
    fetchSpy.mockRejectedValue(new Error('network error'));
    expect(() => trackCommand('emails send', {})).not.toThrow();
  });

  test('shows first-run notice only once', () => {
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
