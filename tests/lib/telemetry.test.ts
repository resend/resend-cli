import {
  existsSync,
  linkSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';

vi.hoisted(() => {
  process.env.POSTHOG_PUBLIC_KEY = 'phc_test_key';
});

import {
  flushFromFile,
  flushPayload,
  getOrCreateAnonymousId,
  getSpoolDir,
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

  it('returns true when DO_NOT_TRACK=1', () => {
    process.env.DO_NOT_TRACK = '1';
    delete process.env.RESEND_TELEMETRY_DISABLED;
    expect(isDisabled()).toBe(true);
  });

  it('returns true when RESEND_TELEMETRY_DISABLED=1', () => {
    delete process.env.DO_NOT_TRACK;
    process.env.RESEND_TELEMETRY_DISABLED = '1';
    expect(isDisabled()).toBe(true);
  });

  it('returns false when neither env var set', () => {
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

  it('creates and persists a UUID', () => {
    const id = getOrCreateAnonymousId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );

    const stored = readFileSync(join(testResendDir, 'telemetry-id'), 'utf-8');
    expect(stored).toBe(id);
  });

  it('returns same ID on subsequent calls', () => {
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

  it('spawns detached process with payload in temp file', () => {
    trackCommand('emails send', { json: true });

    expect(spawnMock).toHaveBeenCalledOnce();
    const [execPath, args, options] = spawnMock.mock.calls[0];
    expect(execPath).toBe(process.execPath);
    expect(args).toContain('telemetry');
    expect(args).toContain('flush');
    const filePath = args[args.length - 1] as string;
    expect(filePath).toMatch(
      /resend-telemetry-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json$/,
    );
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
    expect(body._nonce).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('calls child.unref()', () => {
    trackCommand('emails send', {});
    expect(unrefMock).toHaveBeenCalledOnce();
  });

  it('interactive is false when --json flag is set', () => {
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

  it('interactive is false when not a TTY', () => {
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

  it('interactive is false in CI even with TTY', () => {
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

  it('interactive is true with TTY and no --json', () => {
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

  it('includes flags in payload when provided', () => {
    trackCommand('emails send', {
      flags: ['to', 'subject'],
      globalFlags: ['json'],
    });
    const body = parsePayload();
    expect(body.properties.flags).toEqual(['to', 'subject']);
    expect(body.properties.global_flags).toEqual(['json']);
  });

  it('omits flags from payload when empty', () => {
    trackCommand('emails list', {});
    const body = parsePayload();
    expect(body.properties.flags).toBeUndefined();
    expect(body.properties.global_flags).toBeUndefined();
  });

  it('omits flags from payload when arrays are empty', () => {
    trackCommand('emails list', { flags: [], globalFlags: [] });
    const body = parsePayload();
    expect(body.properties.flags).toBeUndefined();
    expect(body.properties.global_flags).toBeUndefined();
  });

  it('does nothing when disabled', () => {
    process.env.RESEND_TELEMETRY_DISABLED = '1';
    trackCommand('emails send', {});
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('handles spawn failures gracefully', () => {
    spawnMock.mockImplementation(() => {
      throw new Error('spawn error');
    });
    expect(() => trackCommand('emails send', {})).not.toThrow();
  });

  it('does not follow symlinks when writing temp file', () => {
    if (process.platform === 'win32') {
      return;
    }

    const targetFile = join(testConfigDir, 'clobber-target.txt');
    writeFileSync(targetFile, 'original content');

    const originalRandomUUID = crypto.randomUUID.bind(crypto);
    const fixedUUID = originalRandomUUID();
    const uuidMock = vi.spyOn(crypto, 'randomUUID').mockReturnValue(fixedUUID);

    const spoolDir = getSpoolDir();
    const symlinkPath = join(spoolDir, `resend-telemetry-${fixedUUID}.json`);
    symlinkSync(targetFile, symlinkPath);

    try {
      trackCommand('emails send', {});
      expect(readFileSync(targetFile, 'utf-8')).toBe('original content');
    } finally {
      uuidMock.mockRestore();
      if (existsSync(symlinkPath)) {
        rmSync(symlinkPath, { force: true });
      }
      if (existsSync(targetFile)) {
        rmSync(targetFile, { force: true });
      }
    }
  });

  it('shows first-run notice only once', () => {
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

  const validPayload = JSON.stringify({
    api_key: 'test-key',
    distinct_id: 'test-id',
    event: 'cli.used',
    properties: { command: 'emails send' },
    _nonce: crypto.randomUUID(),
  });

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
    } as Response);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('POSTs payload to PostHog endpoint with nonce stripped', async () => {
    await flushPayload(validPayload);

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://us.i.posthog.com/capture/');
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({ 'Content-Type': 'application/json' });
    const sentBody = JSON.parse(options.body as string);
    expect(sentBody._nonce).toBeUndefined();
    expect(sentBody.api_key).toBe('test-key');
    expect(sentBody.event).toBe('cli.used');
  });

  it('rejects invalid JSON', async () => {
    await expect(flushPayload('not json')).rejects.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects payload missing required telemetry fields', async () => {
    await expect(
      flushPayload(JSON.stringify({ arbitrary: 'data' })),
    ).rejects.toThrow('invalid telemetry payload schema');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects payload without nonce', async () => {
    const noNonce = JSON.stringify({
      api_key: 'key',
      distinct_id: 'id',
      event: 'cli.used',
      properties: {},
    });
    await expect(flushPayload(noNonce)).rejects.toThrow(
      'invalid telemetry payload schema',
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects payload with wrong event type', async () => {
    const wrongEvent = JSON.stringify({
      api_key: 'key',
      distinct_id: 'id',
      event: 'some.other.event',
      properties: {},
      _nonce: crypto.randomUUID(),
    });
    await expect(flushPayload(wrongEvent)).rejects.toThrow(
      'invalid telemetry payload schema',
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects payload with array as properties', async () => {
    const arrayProps = JSON.stringify({
      api_key: 'key',
      distinct_id: 'id',
      event: 'cli.used',
      properties: [1, 2],
      _nonce: crypto.randomUUID(),
    });
    await expect(flushPayload(arrayProps)).rejects.toThrow(
      'invalid telemetry payload schema',
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects payload with extra top-level keys', async () => {
    const extraKeys = JSON.stringify({
      api_key: 'key',
      distinct_id: 'id',
      event: 'cli.used',
      properties: {},
      _nonce: crypto.randomUUID(),
      $set: { email: 'attacker@example.com' },
    });
    await expect(flushPayload(extraKeys)).rejects.toThrow(
      'invalid telemetry payload schema',
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('propagates fetch errors', async () => {
    fetchSpy.mockRejectedValue(new Error('network error'));
    await expect(flushPayload(validPayload)).rejects.toThrow('network error');
  });

  it('throws on non-ok HTTP response', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 400 } as Response);
    await expect(flushPayload(validPayload)).rejects.toThrow(
      'telemetry flush failed',
    );
  });
});

describe('flushFromFile', () => {
  const restoreEnv = captureTestEnv();
  let fetchSpy: MockInstance;
  let spoolDir: string;
  let tmpFile: string;

  const validFilePayload = () =>
    JSON.stringify({
      api_key: 'test-key',
      distinct_id: 'test-id',
      event: 'cli.used',
      properties: { command: 'emails send' },
      _nonce: crypto.randomUUID(),
    });

  beforeEach(() => {
    mkdirSync(testResendDir, { recursive: true });
    process.env.XDG_CONFIG_HOME = testConfigDir;
    spoolDir = getSpoolDir();
    tmpFile = join(spoolDir, `resend-telemetry-${crypto.randomUUID()}.json`);
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
    } as Response);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    if (existsSync(tmpFile)) {
      rmSync(tmpFile);
    }
    restoreEnv();
    if (existsSync(testConfigDir)) {
      rmSync(testConfigDir, { recursive: true, force: true });
    }
  });

  it('reads file, validates schema, sends payload without nonce, then deletes it', async () => {
    const payload = validFilePayload();
    writeFileSync(tmpFile, payload);

    await flushFromFile(tmpFile);

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const sentBody = JSON.parse(options.body as string);
    expect(sentBody._nonce).toBeUndefined();
    expect(sentBody.event).toBe('cli.used');
    expect(existsSync(tmpFile)).toBe(false);
  });

  it('rejects paths outside the spool directory', async () => {
    const siblingPath = join(
      `${spoolDir}-outside`,
      `resend-telemetry-${crypto.randomUUID()}.json`,
    );

    await expect(flushFromFile(siblingPath)).rejects.toThrow(
      'invalid telemetry flush path',
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects filenames not matching strict UUID pattern', async () => {
    const looseName = join(spoolDir, 'resend-telemetry-arbitrary.json');
    writeFileSync(looseName, validFilePayload());

    try {
      await expect(flushFromFile(looseName)).rejects.toThrow(
        'invalid telemetry flush path',
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      if (existsSync(looseName)) {
        rmSync(looseName, { force: true });
      }
    }
  });

  it('rejects symlinks that point outside the spool directory', async () => {
    if (process.platform === 'win32') {
      return;
    }

    const outsideFile = join(testConfigDir, 'outside.json');
    writeFileSync(outsideFile, validFilePayload());

    const symlinkPath = join(
      spoolDir,
      `resend-telemetry-${crypto.randomUUID()}.json`,
    );
    symlinkSync(outsideFile, symlinkPath);

    try {
      await expect(flushFromFile(symlinkPath)).rejects.toThrow();
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(existsSync(symlinkPath)).toBe(true);
    } finally {
      if (existsSync(symlinkPath)) {
        rmSync(symlinkPath, { force: true });
      }
      if (existsSync(outsideFile)) {
        rmSync(outsideFile, { force: true });
      }
    }
  });

  it('rejects hardlinked files (nlink > 1)', async () => {
    if (process.platform === 'win32') {
      return;
    }

    writeFileSync(tmpFile, validFilePayload());
    const hardlinkPath = join(
      spoolDir,
      `resend-telemetry-${crypto.randomUUID()}.json`,
    );
    linkSync(tmpFile, hardlinkPath);

    try {
      await expect(flushFromFile(tmpFile)).rejects.toThrow(
        'invalid telemetry flush path',
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      if (existsSync(hardlinkPath)) {
        rmSync(hardlinkPath, { force: true });
      }
    }
  });

  it('rejects file with arbitrary JSON (missing telemetry schema)', async () => {
    writeFileSync(tmpFile, JSON.stringify({ arbitrary: 'data' }));

    await expect(flushFromFile(tmpFile)).rejects.toThrow(
      'invalid telemetry payload schema',
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('deletes file even when flush fails', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 500 } as Response);
    writeFileSync(tmpFile, validFilePayload());

    await expect(flushFromFile(tmpFile)).rejects.toThrow();
    expect(existsSync(tmpFile)).toBe(false);
  });
});
