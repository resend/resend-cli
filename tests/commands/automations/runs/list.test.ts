import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listAutomationRunsCommand } from '../../../../src/commands/automations/runs/list';
import { captureTestEnv, setupOutputSpies } from '../../../helpers';

const run = {
  object: 'automation_run',
  id: 'run-1',
  status: 'failed',
  started_at: '2026-05-15 18:32:37.823+00',
  completed_at: '2026-05-15 18:33:42.916+00',
};

const mockList = vi.fn(async () => ({
  data: { object: 'list', has_more: false, data: [run] },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    automations = { runs: { list: mockList } };
  },
}));

describe('automations runs list command', () => {
  const restoreEnv = captureTestEnv();

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockList.mockClear();
  });

  afterEach(() => {
    restoreEnv();
  });

  it('passes --status filter to the SDK', async () => {
    setupOutputSpies();

    await listAutomationRunsCommand.parseAsync(
      ['auto-1', '--status', 'failed'],
      { from: 'user' },
    );

    expect(mockList).toHaveBeenCalledWith({
      automationId: 'auto-1',
      limit: 10,
      status: 'failed',
    });
  });

  it('preserves --status in the next-page hint', async () => {
    mockList.mockResolvedValueOnce({
      data: { object: 'list', has_more: true, data: [run] },
      error: null,
    });
    // Interactive mode: the hint only prints when TTY and not a CI env.
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
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await listAutomationRunsCommand.parseAsync(
      ['auto-1', '--status', 'failed'],
      { from: 'user' },
    );

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    logSpy.mockRestore();
    expect(output).toContain(
      'automations runs list auto-1 --after run-1 --limit 10 --status failed',
    );
  });
});
