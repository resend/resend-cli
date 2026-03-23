import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export async function renderReactEmail(cjsPath: string): Promise<string> {
  delete require.cache[cjsPath];
  const emailModule = require(cjsPath) as {
    default: (...args: unknown[]) => unknown;
    render: (
      element: unknown,
      options?: Record<string, unknown>,
    ) => Promise<string>;
    reactEmailCreateReactElement: (
      type: unknown,
      props: Record<string, unknown>,
    ) => unknown;
  };

  return emailModule.render(
    emailModule.reactEmailCreateReactElement(emailModule.default, {}),
    {},
  );
}
