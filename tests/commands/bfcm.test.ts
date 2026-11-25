import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { bfcmCommand } from '../../src/commands/bfcm';
import {
  type BfcmBoardOptions,
  BfcmUnauthorizedError,
  runBfcmBoard,
} from '../../src/lib/bfcm-board';
import { resolveAuthentication } from '../../src/lib/config';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  setNonInteractive,
} from '../helpers';

vi.mock('../../src/lib/config', () => ({
  resolveAuthentication: vi.fn(),
}));

vi.mock('../../src/lib/bfcm-board', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/lib/bfcm-board')>()),
  runBfcmBoard: vi.fn(),
}));

const resolveMock = vi.mocked(resolveAuthentication);
const runMock = vi.mocked(runBfcmBoard);

const oauthGrant = (scope = 'full_access', access_token = 'access_1') => ({
  type: 'oauth_grant' as const,
  access_token,
  profile: 'default',
  scope,
  source: 'config' as const,
});

function setInteractive() {
  Object.defineProperty(process.stdin, 'isTTY', {
    value: true,
    writable: true,
  });
  Object.defineProperty(process.stdout, 'isTTY', {
    value: true,
    writable: true,
  });
}

describe('bfcm command', () => {
  const restoreEnv = captureTestEnv();
  let errorSpy: MockInstance;
  let exitSpy: MockInstance;

  beforeEach(() => {
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;
    delete process.env.BFCM_URL;
    process.env.TERM = 'xterm-256color';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();
    resolveMock.mockReset();
    runMock.mockReset();
  });

  afterEach(() => {
    restoreEnv();
    errorSpy.mockRestore();
    exitSpy.mockRestore();
  });

  const errorOutput = () =>
    errorSpy.mock.calls.map((call) => String(call[0])).join('\n');

  it('needs an interactive terminal', async () => {
    setNonInteractive();
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    await expectExit1(() => bfcmCommand.parseAsync([], { from: 'user' }));

    expect(JSON.parse(errorOutput()).error.code).toBe('not_interactive');
    expect(resolveMock).not.toHaveBeenCalled();
  });

  it('asks to log in when there is no login', async () => {
    setInteractive();
    resolveMock.mockResolvedValue(null);

    await expectExit1(() => bfcmCommand.parseAsync([], { from: 'user' }));

    expect(errorOutput()).toContain('Not logged in');
    expect(errorOutput()).toContain('resend login --web');
    expect(runMock).not.toHaveBeenCalled();
  });

  it('refuses API keys', async () => {
    setInteractive();
    resolveMock.mockResolvedValue({
      type: 'api_key',
      key: 're_123',
      source: 'env',
    });

    await expectExit1(() => bfcmCommand.parseAsync([], { from: 'user' }));

    expect(errorOutput()).toContain('not an API key');
    expect(errorOutput()).toContain('Unset RESEND_API_KEY');
    expect(runMock).not.toHaveBeenCalled();
  });

  it('refuses a sending-only login', async () => {
    setInteractive();
    resolveMock.mockResolvedValue(oauthGrant('emails:send'));

    await expectExit1(() => bfcmCommand.parseAsync([], { from: 'user' }));

    expect(errorOutput()).toContain('full access login');
    expect(runMock).not.toHaveBeenCalled();
  });

  it('runs the board with the stored login and forces a refresh on request', async () => {
    setInteractive();
    process.env.BFCM_URL = 'http://localhost:3000';
    resolveMock
      .mockResolvedValueOnce(oauthGrant())
      .mockResolvedValueOnce(oauthGrant('full_access', 'access_2'));
    runMock.mockResolvedValue(undefined);

    await bfcmCommand.parseAsync(['--theme', 'amber'], { from: 'user' });

    const options = runMock.mock.calls[0][0] as BfcmBoardOptions;
    expect(options.baseUrl).toBe('http://localhost:3000');
    expect(options.theme).toBe('amber');
    expect(await options.getAccessToken({ force: false })).toBe('access_1');
    expect(await options.getAccessToken({ force: true })).toBe('access_2');
    expect(resolveMock).toHaveBeenLastCalledWith(undefined, 'default', {
      refresh: 'force',
    });
  });

  it('uses resend.com by default', async () => {
    setInteractive();
    resolveMock.mockResolvedValue(oauthGrant());
    runMock.mockResolvedValue(undefined);

    await bfcmCommand.parseAsync([], { from: 'user' });

    expect(runMock.mock.calls[0][0].baseUrl).toBe('https://resend.com');
  });

  it('tells the user to log in again when the board refuses the login', async () => {
    setInteractive();
    resolveMock.mockResolvedValue(oauthGrant());
    runMock.mockRejectedValue(new BfcmUnauthorizedError());

    await expectExit1(() => bfcmCommand.parseAsync([], { from: 'user' }));

    expect(errorOutput()).toContain('did not accept your login');
    expect(errorOutput()).toContain('resend login --web');
  });
});
