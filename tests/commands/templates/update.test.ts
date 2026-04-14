import {
  afterEach,
  beforeEach,
  describe,
  expect,
  type MockInstance,
  test,
  vi,
} from 'vitest';
import * as files from '../../../src/lib/files';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  setNonInteractive,
  setupOutputSpies,
} from '../../helpers';

const mockUpdate = vi.fn(async (_id?: unknown, _payload?: unknown) => ({
  data: { object: 'template' as const, id: 'tmpl_abc123' },
  error: null,
}));

const mockPickId = vi.fn(
  async (_id?: unknown, _config?: unknown, _globalOpts?: unknown) =>
    'tmpl_abc123',
);
const mockBuildReactEmailHtml = vi.fn(
  async (_path?: unknown, _globalOpts?: unknown) =>
    '<html><body>Rendered</body></html>',
);

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    templates = { update: mockUpdate };
  },
}));

vi.mock('../../../src/lib/prompts', async () => {
  const actual = await vi.importActual('../../../src/lib/prompts');
  return {
    ...actual,
    pickId: (id: unknown, config: unknown, globalOpts: unknown) =>
      mockPickId(id, config, globalOpts),
  };
});

vi.mock('../../../src/lib/react-email', () => ({
  buildReactEmailHtml: (path: unknown, globalOpts: unknown) =>
    mockBuildReactEmailHtml(path, globalOpts),
}));

describe('templates update command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;
  let readFileSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockUpdate.mockClear();
    mockPickId.mockClear();
    mockBuildReactEmailHtml.mockClear();
  });

  afterEach(() => {
    restoreEnv();
    readFileSpy?.mockRestore();
    errorSpy?.mockRestore();
    exitSpy?.mockRestore();
    spies = undefined;
    readFileSpy = undefined;
    errorSpy = undefined;
    exitSpy = undefined;
  });

  function getUpdatePayload(): unknown {
    const firstCall = mockUpdate.mock.calls.at(0);
    if (!firstCall) {
      throw new Error('Expected mockUpdate to be called at least once');
    }
    return firstCall[1];
  }

  test('updates template name', async () => {
    spies = setupOutputSpies();

    const { updateTemplateCommand } = await import(
      '../../../src/commands/templates/update'
    );
    await updateTemplateCommand.parseAsync(
      ['tmpl_abc123', '--name', 'Updated Name'],
      { from: 'user' },
    );

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate.mock.calls[0][0]).toBe('tmpl_abc123');
    const payload = getUpdatePayload() as Record<string, unknown>;
    expect(payload.name).toBe('Updated Name');
  });

  test('omits fields not provided from SDK payload', async () => {
    spies = setupOutputSpies();

    const { updateTemplateCommand } = await import(
      '../../../src/commands/templates/update'
    );
    await updateTemplateCommand.parseAsync(
      ['tmpl_abc123', '--subject', 'New Subject'],
      { from: 'user' },
    );

    const payload = getUpdatePayload() as Record<string, unknown>;
    expect(payload.subject).toBe('New Subject');
    expect(payload).not.toHaveProperty('name');
    expect(payload).not.toHaveProperty('html');
    expect(payload).not.toHaveProperty('text');
    expect(payload).not.toHaveProperty('from');
  });

  test('errors with no_changes before trying to pick an id', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateTemplateCommand } = await import(
      '../../../src/commands/templates/update'
    );
    await expectExit1(() =>
      updateTemplateCommand.parseAsync([], { from: 'user' }),
    );

    expect(mockPickId).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();

    const output = errorSpy.mock.calls.map((call) => call[0]).join(' ');
    expect(output).toContain('no_changes');
    expect(output).not.toContain('missing_id');
  });

  test('errors when --react-email and empty --html are used together', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateTemplateCommand } = await import(
      '../../../src/commands/templates/update'
    );
    await expectExit1(() =>
      updateTemplateCommand.parseAsync(
        ['tmpl_abc123', '--react-email', './emails/welcome.tsx', '--html', ''],
        { from: 'user' },
      ),
    );

    expect(mockBuildReactEmailHtml).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    const output = errorSpy.mock.calls.map((call) => call[0]).join(' ');
    expect(output).toContain('invalid_options');
  });

  test('errors when empty --html and --html-file are used together', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateTemplateCommand } = await import(
      '../../../src/commands/templates/update'
    );
    await expectExit1(() =>
      updateTemplateCommand.parseAsync(
        ['tmpl_abc123', '--html', '', '--html-file', '/fake/template.html'],
        { from: 'user' },
      ),
    );

    expect(mockUpdate).not.toHaveBeenCalled();
    const output = errorSpy.mock.calls.map((call) => call[0]).join(' ');
    expect(output).toContain('invalid_options');
  });

  test('warns when empty --text and --text-file are used together', async () => {
    spies = setupOutputSpies();
    readFileSpy = vi.spyOn(files, 'readFile').mockReturnValue('From file');

    const { updateTemplateCommand } = await import(
      '../../../src/commands/templates/update'
    );
    await updateTemplateCommand.parseAsync(
      ['tmpl_abc123', '--text', '', '--text-file', '/fake/body.txt'],
      { from: 'user' },
    );

    const stderrOutput = spies.stderrSpy.mock.calls
      .map((call) => call[0])
      .join('');
    expect(stderrOutput).toContain('--text-file');
    const payload = getUpdatePayload() as Record<string, unknown>;
    expect(payload.text).toBe('From file');
  });
});
