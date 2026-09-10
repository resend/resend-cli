import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { rotateWebhookSigningSecretCommand } from '../../../src/commands/webhooks/rotate-signing-secret';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  mockSdkError,
  setNonInteractive,
  setupOutputSpies,
} from '../../helpers';

const WEBHOOK_ID = '4dd369bc-aa82-4ff3-97de-514ae3000ee0';

const mockRotateSigningSecret = vi.fn(async () => ({
  data: {
    object: 'webhook' as const,
    id: WEBHOOK_ID,
    signing_secret: 'whsec_new_secret',
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    webhooks = { rotateSigningSecret: mockRotateSigningSecret };
  },
}));

describe('webhooks rotate-signing-secret command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockRotateSigningSecret.mockClear();
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

  it('rotates the secret for the given webhook and outputs it as JSON when non-interactive', async () => {
    spies = setupOutputSpies();

    await rotateWebhookSigningSecretCommand.parseAsync([WEBHOOK_ID], {
      from: 'user',
    });

    expect(mockRotateSigningSecret).toHaveBeenCalledWith(WEBHOOK_ID);
    const parsed = JSON.parse(spies.logSpy.mock.calls[0][0] as string);
    expect(parsed.object).toBe('webhook');
    expect(parsed.id).toBe(WEBHOOK_ID);
    expect(parsed.signing_secret).toBe('whsec_new_secret');
  });

  it('errors with create_error when the SDK returns an error', async () => {
    setNonInteractive();
    mockRotateSigningSecret.mockResolvedValueOnce(
      mockSdkError('Webhook not found', 'not_found'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      rotateWebhookSigningSecretCommand.parseAsync([WEBHOOK_ID], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('create_error');
  });
});
