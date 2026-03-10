import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from 'bun:test';
import * as fs from 'node:fs';
import type { InstallTarget } from '../../../src/commands/skills/install';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  setupOutputSpies,
} from '../../helpers';

const MOCK_TREE = {
  tree: [
    { path: 'SKILL.md', type: 'blob' },
    { path: 'send-email/SKILL.md', type: 'blob' },
    { path: 'send-email/references/best-practices.md', type: 'blob' },
    { path: 'resend-inbound/SKILL.md', type: 'blob' },
    { path: 'templates/SKILL.md', type: 'blob' },
    { path: 'templates/reference.md', type: 'blob' },
    { path: 'agent-email-inbox/SKILL.md', type: 'blob' },
    // excluded
    { path: 'README.md', type: 'blob' },
    { path: 'package.json', type: 'blob' },
    { path: 'pnpm-lock.yaml', type: 'blob' },
    { path: 'tests/test.md', type: 'blob' },
    { path: '.github/workflows/ci.yml', type: 'blob' },
    { path: '.gitignore', type: 'blob' },
  ],
};

const SINGLE_TARGET: InstallTarget[] = [
  { name: 'test', dir: '/project/.claude/skills' },
];

function makeMockFetch(treeData = MOCK_TREE, fileContent = '# skill content') {
  return mock(async (url: string | URL | Request) => {
    if (String(url).includes('git/trees')) {
      return {
        ok: true,
        json: async () => treeData,
        text: async () => '',
      } as Response;
    }
    return {
      ok: true,
      text: async () => fileContent,
      json: async () => ({}),
    } as Response;
  });
}

describe('installSkills', () => {
  const restoreEnv = captureTestEnv();
  const originalFetch = globalThis.fetch;
  let writeFileSyncSpy: ReturnType<typeof spyOn>;
  let mkdirSyncSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    writeFileSyncSpy = spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    mkdirSyncSpy = spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
  });

  afterEach(() => {
    restoreEnv();
    writeFileSyncSpy.mockRestore();
    mkdirSyncSpy.mockRestore();
    globalThis.fetch = originalFetch;
  });

  test('fetches tree and writes files, excluding README/package.json/tests/.github', async () => {
    globalThis.fetch = makeMockFetch();
    const { logSpy, restore } = setupOutputSpies();
    try {
      const { installSkills } = await import(
        '../../../src/commands/skills/install'
      );
      await installSkills(SINGLE_TARGET, { json: true });

      // 12 items in tree, 5 excluded → 7 actual files
      expect(writeFileSyncSpy).toHaveBeenCalledTimes(7);

      const output = JSON.parse(logSpy.mock.calls[0][0] as string);
      expect(output.installed).toEqual([
        'agent-email-inbox',
        'resend',
        'resend-inbound',
        'send-email',
        'templates',
      ]);
      expect(output.files).toBe(7);
      expect(output.targets).toEqual([
        { name: 'test', dir: '/project/.claude/skills' },
      ]);
    } finally {
      restore();
    }
  });

  test('writes to all targets when multiple targets provided', async () => {
    globalThis.fetch = makeMockFetch();
    const { restore } = setupOutputSpies();
    const multiTargets: InstallTarget[] = [
      { name: 'claude-code', dir: '/project/.claude/skills' },
      { name: 'agents', dir: '/project/.agents/skills' },
    ];
    try {
      const { installSkills } = await import(
        '../../../src/commands/skills/install'
      );
      await installSkills(multiTargets, { json: true });

      // 7 files × 2 targets
      expect(writeFileSyncSpy).toHaveBeenCalledTimes(14);
    } finally {
      restore();
    }
  });

  test('maps root SKILL.md to resend/SKILL.md', async () => {
    globalThis.fetch = makeMockFetch();
    const { restore } = setupOutputSpies();
    try {
      const { installSkills } = await import(
        '../../../src/commands/skills/install'
      );
      await installSkills(SINGLE_TARGET, { json: true });

      const writtenPaths = writeFileSyncSpy.mock.calls.map(
        (c) => c[0] as string,
      );
      expect(writtenPaths.some((p) => p.includes('resend/SKILL.md'))).toBe(
        true,
      );
      // No file written directly as /SKILL.md at root of skillsDir
      expect(
        writtenPaths.some((p) =>
          p.endsWith(`/project/.claude/skills/SKILL.md`),
        ),
      ).toBe(false);
    } finally {
      restore();
    }
  });

  test('creates parent directories for each file', async () => {
    globalThis.fetch = makeMockFetch();
    const { restore } = setupOutputSpies();
    try {
      const { installSkills } = await import(
        '../../../src/commands/skills/install'
      );
      await installSkills(SINGLE_TARGET, { json: true });

      const mkdirCalls = mkdirSyncSpy.mock.calls.map((c) => c[0] as string);
      expect(mkdirCalls.some((p) => p.includes('send-email'))).toBe(true);
      expect(mkdirCalls.some((p) => p.includes('resend-inbound'))).toBe(true);
    } finally {
      restore();
    }
  });

  test('exits with fetch_error when GitHub tree API fails', async () => {
    globalThis.fetch = mock(
      async () =>
        ({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
        }) as Response,
    );
    const { restore } = setupOutputSpies();
    const exitSpy = mockExitThrow();
    try {
      const { installSkills } = await import(
        '../../../src/commands/skills/install'
      );
      await expectExit1(() => installSkills(SINGLE_TARGET, { json: true }));
    } finally {
      restore();
      exitSpy.mockRestore();
    }
  });

  test('exits with fetch_error when a file download fails', async () => {
    let callCount = 0;
    globalThis.fetch = mock(async (url: string | URL | Request) => {
      if (String(url).includes('git/trees')) {
        return {
          ok: true,
          json: async () => MOCK_TREE,
          text: async () => '',
        } as Response;
      }
      callCount++;
      // fail on first file download
      if (callCount === 1) {
        return { ok: false, status: 404, statusText: 'Not Found' } as Response;
      }
      return {
        ok: true,
        text: async () => '# content',
        json: async () => ({}),
      } as Response;
    });
    const { restore } = setupOutputSpies();
    const exitSpy = mockExitThrow();
    try {
      const { installSkills } = await import(
        '../../../src/commands/skills/install'
      );
      await expectExit1(() => installSkills(SINGLE_TARGET, { json: true }));
    } finally {
      restore();
      exitSpy.mockRestore();
    }
  });

  test('exits with write_error when file write fails', async () => {
    globalThis.fetch = makeMockFetch();
    writeFileSyncSpy.mockImplementationOnce(() => {
      throw new Error('ENOENT: no such file or directory');
    });
    const { restore } = setupOutputSpies();
    const exitSpy = mockExitThrow();
    try {
      const { installSkills } = await import(
        '../../../src/commands/skills/install'
      );
      await expectExit1(() => installSkills(SINGLE_TARGET, { json: true }));
    } finally {
      restore();
      exitSpy.mockRestore();
    }
  });
});
