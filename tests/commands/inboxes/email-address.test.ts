import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getInboxAgentCommand } from '../../../src/commands/inboxes/agent/get';
import { updateInboxAgentCommand } from '../../../src/commands/inboxes/agent/update';
import { deleteInboxCommand } from '../../../src/commands/inboxes/delete';
import { createInboxDraftCommand } from '../../../src/commands/inboxes/drafts/create';
import { deleteInboxDraftCommand } from '../../../src/commands/inboxes/drafts/delete';
import { getInboxDraftCommand } from '../../../src/commands/inboxes/drafts/get';
import { listInboxDraftsCommand } from '../../../src/commands/inboxes/drafts/list';
import { sendInboxDraftCommand } from '../../../src/commands/inboxes/drafts/send';
import { updateInboxDraftCommand } from '../../../src/commands/inboxes/drafts/update';
import { getInboxCommand } from '../../../src/commands/inboxes/get';
import { createInboxLabelCommand } from '../../../src/commands/inboxes/labels/create';
import { deleteInboxLabelCommand } from '../../../src/commands/inboxes/labels/delete';
import { listInboxLabelsCommand } from '../../../src/commands/inboxes/labels/list';
import { updateInboxLabelCommand } from '../../../src/commands/inboxes/labels/update';
import { deleteInboxThreadCommand } from '../../../src/commands/inboxes/threads/delete';
import { forwardInboxThreadEmailCommand } from '../../../src/commands/inboxes/threads/emails/forward';
import { getInboxThreadEmailCommand } from '../../../src/commands/inboxes/threads/emails/get';
import { listInboxThreadEmailsCommand } from '../../../src/commands/inboxes/threads/emails/list';
import { replyInboxThreadEmailCommand } from '../../../src/commands/inboxes/threads/emails/reply';
import { getInboxThreadCommand } from '../../../src/commands/inboxes/threads/get';
import { listInboxThreadsCommand } from '../../../src/commands/inboxes/threads/list';
import { searchInboxThreadsCommand } from '../../../src/commands/inboxes/threads/search';
import { updateInboxThreadCommand } from '../../../src/commands/inboxes/threads/update';
import { updateInboxCommand } from '../../../src/commands/inboxes/update';
import { captureTestEnv, setupOutputSpies } from '../../helpers';

const ADDRESS = 'Support@Example.com';
const THREAD_ID = '3deaccfa-f572-443c-be6f-92b74f9d5c48';
const DRAFT_ID = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
const LABEL_ID = '11111111-2222-3333-4444-555555555555';
const EMAIL_ID = '5e0e0b3c-9497-47d3-a527-4bd5e0e2f0f5';

const ok = () => ({
  data: { object: 'list', has_more: false, data: [], id: 'id' },
  error: null,
});

const sdk = {
  get: vi.fn(async () => ok()),
  update: vi.fn(async () => ok()),
  remove: vi.fn(async () => ok()),
  agent: { get: vi.fn(async () => ok()), update: vi.fn(async () => ok()) },
  drafts: {
    list: vi.fn(async () => ok()),
    create: vi.fn(async () => ok()),
    get: vi.fn(async () => ok()),
    update: vi.fn(async () => ok()),
    remove: vi.fn(async () => ok()),
    send: vi.fn(async () => ok()),
  },
  labels: {
    list: vi.fn(async () => ok()),
    create: vi.fn(async () => ok()),
    update: vi.fn(async () => ok()),
    remove: vi.fn(async () => ok()),
  },
  threads: {
    list: vi.fn(async () => ok()),
    search: vi.fn(async () => ok()),
    get: vi.fn(async () => ok()),
    update: vi.fn(async () => ok()),
    remove: vi.fn(async () => ok()),
    emails: {
      list: vi.fn(async () => ok()),
      get: vi.fn(async () => ok()),
      reply: vi.fn(async () => ok()),
      forward: vi.fn(async () => ok()),
    },
  },
};

vi.mock('resend', async (importOriginal) => {
  const original = await importOriginal<typeof import('resend')>();
  return {
    INBOX_AGENT_ACTIONS: original.INBOX_AGENT_ACTIONS,
    INBOX_AGENT_TONES: original.INBOX_AGENT_TONES,
    INBOX_MESSAGE_FOLDERS: original.INBOX_MESSAGE_FOLDERS,
    MOVE_THREAD_FOLDERS: original.MOVE_THREAD_FOLDERS,
    Resend: class MockResend {
      constructor(public key: string) {}
      inboxes = sdk;
    },
  };
});

type Case = {
  name: string;
  command: { parseAsync: (args: string[], opts: { from: 'user' }) => unknown };
  args: string[];
  mock: ReturnType<typeof vi.fn>;
  calls: unknown[];
};

const cases: Case[] = [
  {
    name: 'inboxes get',
    command: getInboxCommand,
    args: [ADDRESS],
    mock: sdk.get,
    calls: [ADDRESS],
  },
  {
    name: 'inboxes update',
    command: updateInboxCommand,
    args: [ADDRESS, '--name', 'Support'],
    mock: sdk.update,
    calls: [ADDRESS, { name: 'Support' }],
  },
  {
    name: 'inboxes delete',
    command: deleteInboxCommand,
    args: [ADDRESS, '--yes'],
    mock: sdk.remove,
    calls: [ADDRESS],
  },
  {
    name: 'agent get',
    command: getInboxAgentCommand,
    args: [ADDRESS],
    mock: sdk.agent.get,
    calls: [{ emailAddress: ADDRESS }],
  },
  {
    name: 'agent update',
    command: updateInboxAgentCommand,
    args: [ADDRESS, '--tone', 'concise_casual'],
    mock: sdk.agent.update,
    calls: [{ emailAddress: ADDRESS, tone: 'concise_casual' }],
  },
  {
    name: 'drafts list',
    command: listInboxDraftsCommand,
    args: [ADDRESS],
    mock: sdk.drafts.list,
    calls: [{ emailAddress: ADDRESS, limit: 10 }],
  },
  {
    name: 'drafts create',
    command: createInboxDraftCommand,
    args: [ADDRESS, '--subject', 'Hello'],
    mock: sdk.drafts.create,
    calls: [{ emailAddress: ADDRESS, subject: 'Hello' }, undefined],
  },
  {
    name: 'drafts get',
    command: getInboxDraftCommand,
    args: [ADDRESS, DRAFT_ID],
    mock: sdk.drafts.get,
    calls: [{ emailAddress: ADDRESS, draftId: DRAFT_ID }],
  },
  {
    name: 'drafts update',
    command: updateInboxDraftCommand,
    args: [ADDRESS, DRAFT_ID, '--subject', 'Hello'],
    mock: sdk.drafts.update,
    calls: [{ emailAddress: ADDRESS, draftId: DRAFT_ID, subject: 'Hello' }],
  },
  {
    name: 'drafts delete',
    command: deleteInboxDraftCommand,
    args: [ADDRESS, DRAFT_ID, '--yes'],
    mock: sdk.drafts.remove,
    calls: [{ emailAddress: ADDRESS, draftId: DRAFT_ID }],
  },
  {
    name: 'drafts send',
    command: sendInboxDraftCommand,
    args: [ADDRESS, DRAFT_ID],
    mock: sdk.drafts.send,
    calls: [{ emailAddress: ADDRESS, draftId: DRAFT_ID }, undefined],
  },
  {
    name: 'labels list',
    command: listInboxLabelsCommand,
    args: [ADDRESS],
    mock: sdk.labels.list,
    calls: [{ emailAddress: ADDRESS }],
  },
  {
    name: 'labels create',
    command: createInboxLabelCommand,
    args: [ADDRESS, '--name', 'Billing'],
    mock: sdk.labels.create,
    calls: [{ emailAddress: ADDRESS, name: 'Billing' }],
  },
  {
    name: 'labels update',
    command: updateInboxLabelCommand,
    args: [ADDRESS, LABEL_ID, '--name', 'Billing'],
    mock: sdk.labels.update,
    calls: [{ emailAddress: ADDRESS, labelId: LABEL_ID, name: 'Billing' }],
  },
  {
    name: 'labels delete',
    command: deleteInboxLabelCommand,
    args: [ADDRESS, LABEL_ID, '--yes'],
    mock: sdk.labels.remove,
    calls: [{ emailAddress: ADDRESS, labelId: LABEL_ID }],
  },
  {
    name: 'threads list',
    command: listInboxThreadsCommand,
    args: [ADDRESS],
    mock: sdk.threads.list,
    calls: [
      {
        emailAddress: ADDRESS,
        folders: undefined,
        labels: undefined,
        read: undefined,
        limit: 10,
      },
    ],
  },
  {
    name: 'threads search',
    command: searchInboxThreadsCommand,
    args: [ADDRESS, '--query', 'invoice'],
    mock: sdk.threads.search,
    calls: [
      {
        emailAddress: ADDRESS,
        folders: undefined,
        labels: undefined,
        read: undefined,
        query: 'invoice',
        from: undefined,
        to: undefined,
        cc: undefined,
        bcc: undefined,
        hasAttachment: undefined,
        startDate: undefined,
        endDate: undefined,
        limit: 10,
      },
    ],
  },
  {
    name: 'threads get',
    command: getInboxThreadCommand,
    args: [ADDRESS, THREAD_ID],
    mock: sdk.threads.get,
    calls: [{ emailAddress: ADDRESS, threadId: THREAD_ID }],
  },
  {
    name: 'threads update',
    command: updateInboxThreadCommand,
    args: [ADDRESS, THREAD_ID, '--read'],
    mock: sdk.threads.update,
    calls: [{ emailAddress: ADDRESS, threadId: THREAD_ID, read: true }],
  },
  {
    name: 'threads delete',
    command: deleteInboxThreadCommand,
    args: [ADDRESS, THREAD_ID, '--yes'],
    mock: sdk.threads.remove,
    calls: [{ emailAddress: ADDRESS, threadId: THREAD_ID }],
  },
  {
    name: 'threads emails list',
    command: listInboxThreadEmailsCommand,
    args: [ADDRESS, THREAD_ID],
    mock: sdk.threads.emails.list,
    calls: [{ emailAddress: ADDRESS, threadId: THREAD_ID, limit: 10 }],
  },
  {
    name: 'threads emails get',
    command: getInboxThreadEmailCommand,
    args: [ADDRESS, THREAD_ID, EMAIL_ID],
    mock: sdk.threads.emails.get,
    calls: [{ emailAddress: ADDRESS, threadId: THREAD_ID, emailId: EMAIL_ID }],
  },
  {
    name: 'threads emails reply',
    command: replyInboxThreadEmailCommand,
    args: [ADDRESS, THREAD_ID, EMAIL_ID, '--text', 'Thanks'],
    mock: sdk.threads.emails.reply,
    calls: [
      {
        emailAddress: ADDRESS,
        threadId: THREAD_ID,
        emailId: EMAIL_ID,
        text: 'Thanks',
      },
      undefined,
    ],
  },
  {
    name: 'threads emails forward',
    command: forwardInboxThreadEmailCommand,
    args: [ADDRESS, THREAD_ID, EMAIL_ID, '--to', 'teammate@example.com'],
    mock: sdk.threads.emails.forward,
    calls: [
      {
        emailAddress: ADDRESS,
        threadId: THREAD_ID,
        emailId: EMAIL_ID,
        to: ['teammate@example.com'],
      },
      undefined,
    ],
  },
];

describe('inbox commands with an inbox email address', () => {
  const restoreEnv = captureTestEnv();

  beforeEach(() => {
    restoreEnv();
    process.env.RESEND_API_KEY = 're_test_key';
    vi.clearAllMocks();
  });

  it.each(cases)('$name passes the address to the SDK', async ({
    command,
    args,
    mock,
    calls,
  }) => {
    setupOutputSpies();

    await command.parseAsync(args, { from: 'user' });

    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock.mock.calls[0]).toStrictEqual(calls);
  });
});
