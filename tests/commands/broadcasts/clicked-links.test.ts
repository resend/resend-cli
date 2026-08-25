import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { clickedLinksBroadcastCommand } from '../../../src/commands/broadcasts/clicked-links';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  mockSdkError,
  setNonInteractive,
  setupOutputSpies,
} from '../../helpers';

const mockClickedLinks = vi.fn(async () => ({
  data: {
    object: 'list' as const,
    has_more: false,
    data: [
      {
        id: 'b2Zmc2V0OjA',
        url: 'https://resend.com/pricing',
        clicks: 42,
        unique_clicks: 30,
      },
    ],
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    broadcasts = { clickedLinks: mockClickedLinks };
  },
}));

describe('broadcasts clicked-links command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockClickedLinks.mockClear();
  });

  afterEach(() => {
    restoreEnv();
    errorSpy?.mockRestore();
    stderrSpy?.mockRestore();
    exitSpy?.mockRestore();
    spies = undefined;
    errorSpy = undefined;
    stderrSpy = undefined;
    exitSpy = undefined;
  });

  it('lists clicked links for a broadcast id', async () => {
    spies = setupOutputSpies();

    await clickedLinksBroadcastCommand.parseAsync(
      ['d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6'],
      { from: 'user' },
    );

    expect(mockClickedLinks).toHaveBeenCalledTimes(1);
    expect(mockClickedLinks.mock.calls[0][0]).toBe(
      'd1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
    );
  });

  it('outputs JSON list when non-interactive', async () => {
    spies = setupOutputSpies();

    await clickedLinksBroadcastCommand.parseAsync(
      ['d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6'],
      { from: 'user' },
    );

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('list');
    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0].url).toBe('https://resend.com/pricing');
  });

  it('passes --limit to SDK', async () => {
    spies = setupOutputSpies();

    await clickedLinksBroadcastCommand.parseAsync(
      ['d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6', '--limit', '5'],
      { from: 'user' },
    );

    const opts = mockClickedLinks.mock.calls[0][1] as Record<string, unknown>;
    expect(opts.limit).toBe(5);
  });

  it('passes --after cursor to SDK', async () => {
    spies = setupOutputSpies();

    await clickedLinksBroadcastCommand.parseAsync(
      ['d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6', '--after', 'b2Zmc2V0OjA'],
      { from: 'user' },
    );

    const opts = mockClickedLinks.mock.calls[0][1] as Record<string, unknown>;
    expect(opts.after).toBe('b2Zmc2V0OjA');
  });

  it('passes --before cursor to SDK', async () => {
    spies = setupOutputSpies();

    await clickedLinksBroadcastCommand.parseAsync(
      ['d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6', '--before', 'b2Zmc2V0OjA'],
      { from: 'user' },
    );

    const opts = mockClickedLinks.mock.calls[0][1] as Record<string, unknown>;
    expect(opts.before).toBe('b2Zmc2V0OjA');
  });

  it('errors with invalid_limit when --limit is out of range', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      clickedLinksBroadcastCommand.parseAsync(
        ['d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6', '--limit', '999'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_limit');
  });

  it('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      clickedLinksBroadcastCommand.parseAsync(
        ['d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  it('errors with list_error when SDK returns an error', async () => {
    setNonInteractive();
    mockClickedLinks.mockResolvedValueOnce(
      mockSdkError('Broadcast not found', 'not_found'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      clickedLinksBroadcastCommand.parseAsync(
        ['d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('list_error');
  });
});
