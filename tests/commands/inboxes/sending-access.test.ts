import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
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
import { createInboxDraftCommand } from '../../../src/commands/inboxes/drafts/create';
import { sendInboxDraftCommand } from '../../../src/commands/inboxes/drafts/send';
import { updateInboxDraftCommand } from '../../../src/commands/inboxes/drafts/update';
import { forwardInboxThreadEmailCommand } from '../../../src/commands/inboxes/threads/emails/forward';
import { replyInboxThreadEmailCommand } from '../../../src/commands/inboxes/threads/emails/reply';
import { getInboxThreadCommand } from '../../../src/commands/inboxes/threads/get';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  setupOutputSpies,
} from '../../helpers';

const INBOX_ID = '78261eea-8f8b-4381-83c6-79fa7120f1cf';
const THREAD_ID = '3deaccfa-f572-443c-be6f-92b74f9d5c48';
const DRAFT_ID = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
const EMAIL_ID = '5e0e0b3c-9497-47d3-a527-4bd5e0e2f0f5';

const ok = () => ({ data: { object: 'inbox_draft', id: 'id' }, error: null });

const sdk = {
  drafts: {
    create: vi.fn(async () => ok()),
    send: vi.fn(async () => ok()),
    update: vi.fn(async () => ok()),
  },
  threads: {
    get: vi.fn(async () => ok()),
    emails: {
      reply: vi.fn(async () => ok()),
      forward: vi.fn(async () => ok()),
    },
  },
};

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    inboxes = sdk;
  },
}));

describe('inbox commands with a sending-access key', () => {
  const restoreEnv = captureTestEnv();
  let tmpDir: string;
  let errorSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    tmpDir = join(
      tmpdir(),
      `resend-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(join(tmpDir, 'resend'), { recursive: true });
    writeFileSync(
      join(tmpDir, 'resend', 'credentials.json'),
      JSON.stringify({
        active_profile: 'default',
        profiles: {
          default: {
            type: 'api_key',
            api_key: 're_sending_key',
            permission: 'sending_access',
          },
        },
      }),
    );
    process.env.XDG_CONFIG_HOME = tmpDir;
    process.env.RESEND_CREDENTIAL_STORE = 'file';
    delete process.env.RESEND_API_KEY;
  });

  afterEach(() => {
    restoreEnv();
    errorSpy?.mockRestore();
    exitSpy?.mockRestore();
    errorSpy = undefined;
    exitSpy = undefined;
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it.each([
    {
      name: 'threads emails reply',
      command: replyInboxThreadEmailCommand,
      args: [INBOX_ID, THREAD_ID, EMAIL_ID, '--text', 'Thanks'],
      mock: sdk.threads.emails.reply,
    },
    {
      name: 'threads emails forward',
      command: forwardInboxThreadEmailCommand,
      args: [INBOX_ID, THREAD_ID, EMAIL_ID, '--to', 'teammate@example.com'],
      mock: sdk.threads.emails.forward,
    },
    {
      name: 'drafts create',
      command: createInboxDraftCommand,
      args: [INBOX_ID, '--subject', 'Hello'],
      mock: sdk.drafts.create,
    },
    {
      name: 'drafts send',
      command: sendInboxDraftCommand,
      args: [INBOX_ID, DRAFT_ID],
      mock: sdk.drafts.send,
    },
  ])('$name runs with the sending-access key', async ({
    command,
    args,
    mock,
  }) => {
    setupOutputSpies();

    await command.parseAsync(args, { from: 'user' });

    expect(mock).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      name: 'drafts update',
      command: updateInboxDraftCommand,
      args: [INBOX_ID, DRAFT_ID, '--subject', 'Hello'],
      mock: sdk.drafts.update,
    },
    {
      name: 'threads get',
      command: getInboxThreadCommand,
      args: [INBOX_ID, THREAD_ID],
      mock: sdk.threads.get,
    },
  ])('$name still needs full access', async ({ command, args, mock }) => {
    setupOutputSpies();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() => command.parseAsync(args, { from: 'user' }));

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('insufficient_permissions');
    expect(mock).not.toHaveBeenCalled();
  });
});
