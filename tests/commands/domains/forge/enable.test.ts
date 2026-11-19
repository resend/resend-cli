import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { forgeEnableCommand } from '../../../../src/commands/domains/forge/enable';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  mockSdkError,
  setNonInteractive,
  setupOutputSpies,
} from '../../../helpers';

const domain = {
  object: 'domain',
  id: 'domain-id',
  name: 'example.com',
  status: 'partially_verified',
  created_at: '2026-11-19 10:00:00.000000+00',
  region: 'us-east-1',
  capabilities: { sending: 'enabled', receiving: 'disabled' },
  open_tracking: false,
  click_tracking: false,
  records: [
    {
      record: 'SPF',
      name: 'forge',
      value: 'send.forge.rmta.net',
      type: 'CNAME',
      ttl: 'Auto',
      status: 'pending',
    },
  ],
};

const mockEnable = vi.fn(async () => ({ data: domain, error: null }));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    domains = { forge: { enable: mockEnable } };
  },
}));

describe('domains forge enable command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockEnable.mockClear();
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

  it('calls SDK forge.enable with the domain id and outputs JSON', async () => {
    spies = setupOutputSpies();

    await forgeEnableCommand.parseAsync(['domain-id'], { from: 'user' });

    expect(mockEnable).toHaveBeenCalledWith({ id: 'domain-id' });
    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('domain');
    expect(parsed.records[0].value).toBe('send.forge.rmta.net');
  });

  it('passes --custom-return-path to the SDK', async () => {
    spies = setupOutputSpies();

    await forgeEnableCommand.parseAsync(
      ['domain-id', '--custom-return-path', 'forge'],
      { from: 'user' },
    );

    expect(mockEnable).toHaveBeenCalledWith({
      id: 'domain-id',
      customReturnPath: 'forge',
    });
  });

  it('errors with create_error when the SDK returns an error', async () => {
    setNonInteractive();
    mockEnable.mockResolvedValueOnce(
      mockSdkError(
        'Forge is not available for example.com',
        'forge_unavailable',
      ),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      forgeEnableCommand.parseAsync(['domain-id'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('create_error');
  });

  it('prints only the records that are not verified in interactive mode', async () => {
    Object.defineProperty(process.stdin, 'isTTY', {
      value: true,
      writable: true,
    });
    Object.defineProperty(process.stdout, 'isTTY', {
      value: true,
      writable: true,
    });
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    mockEnable.mockResolvedValueOnce({
      data: {
        ...domain,
        records: [
          {
            record: 'DKIM',
            name: 'resend._domainkey',
            value: 'p=MIGf...',
            type: 'TXT',
            ttl: 'Auto',
            status: 'verified',
          },
          ...domain.records,
        ],
      },
      error: null,
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await forgeEnableCommand.parseAsync(['domain-id'], { from: 'user' });

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    logSpy.mockRestore();
    expect(output).toContain('send.forge.rmta.net');
    expect(output).not.toContain('resend._domainkey');
    expect(output).toContain('--scope forge');
  });
});
