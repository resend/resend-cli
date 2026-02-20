import { describe, test, expect, mock, afterEach, spyOn } from 'bun:test';
import { captureTestEnv, setupOutputSpies, mockExitThrow, expectExit1 } from '../../helpers';

const mockWriteFileSync = mock(() => {});
const mockMkdirSync = mock(() => {});
const mockReadFileSync = mock(() => JSON.stringify({ mcpServers: { other: { command: 'other' } } }));
const mockExistsSync = mock(() => true);

mock.module('node:fs', () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  mkdirSync: mockMkdirSync,
}));

describe('setupCursor', () => {
  const restoreEnv = captureTestEnv();
  afterEach(() => {
    restoreEnv();
    mockWriteFileSync.mockClear();
    mockReadFileSync.mockClear();
    mockExistsSync.mockClear();
    mockMkdirSync.mockClear();
  });

  test('merges resend into existing mcpServers without clobbering other entries', async () => {
    const { restore } = setupOutputSpies();
    const { setupCursor } = await import('../../../src/commands/setup/cursor');
    await setupCursor({ json: true });

    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
    expect(written.mcpServers.other).toBeDefined();
    expect(written.mcpServers.resend.command).toBe('resend');
    expect(written.mcpServers.resend.args).toEqual(['mcp', 'serve']);
    restore();
  });

  test('creates config from scratch when file does not exist', async () => {
    mockExistsSync.mockReturnValueOnce(false);
    const { restore } = setupOutputSpies();
    const { setupCursor } = await import('../../../src/commands/setup/cursor');
    await setupCursor({ json: true });

    const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
    expect(written.mcpServers.resend.command).toBe('resend');
    restore();
  });

  test('outputs JSON with configured:true in non-interactive mode', async () => {
    const { logSpy, restore } = setupOutputSpies();
    const { setupCursor } = await import('../../../src/commands/setup/cursor');
    await setupCursor({ json: true });

    const output = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(output.configured).toBe(true);
    expect(output.tool).toBe('cursor');
    expect(output.config_path).toContain('.cursor/mcp.json');
    restore();
  });

  test('calls outputError when writeFileSync throws', async () => {
    mockWriteFileSync.mockImplementationOnce(() => { throw new Error('Permission denied'); });
    const errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = mockExitThrow();

    const { setupCursor } = await import('../../../src/commands/setup/cursor');
    await expectExit1(() => setupCursor({ json: true }));

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('config_write_error');

    errorSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
