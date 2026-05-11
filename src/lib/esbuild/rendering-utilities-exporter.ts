import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Loader, PluginBuild, ResolveOptions } from 'esbuild';
import { escapeStringForRegex } from './escape-string-for-regex';

export const renderingUtilitiesExporter = (emailTemplates: string[]) => ({
  name: 'rendering-utilities-exporter',
  setup: (b: PluginBuild) => {
    b.onLoad(
      {
        filter: new RegExp(
          emailTemplates
            .map((emailPath) => escapeStringForRegex(emailPath))
            .join('|'),
        ),
      },
      async ({ path: pathToFile }) => {
        return {
          contents: `${await fs.readFile(pathToFile, 'utf8')};
          export { render } from 'react-email-module-that-will-export-render'
          export { createElement as reactEmailCreateReactElement } from 'react';
        `,
          loader: path.extname(pathToFile).slice(1) as Loader,
        };
      },
    );

    b.onResolve(
      { filter: /^react-email-module-that-will-export-render$/ },
      async (args) => {
        const options: ResolveOptions = {
          kind: 'import-statement',
          importer: args.importer,
          resolveDir: args.resolveDir,
          namespace: args.namespace,
        };
        let result = await b.resolve('react-email', options);
        if (result.errors.length === 0) {
          return result;
        }

        result = await b.resolve('@react-email/components', options);
        if (result.errors.length === 0) {
          return result;
        }

        result = await b.resolve('@react-email/render', options);
        if (result.errors.length > 0 && result.errors[0]) {
          result.errors[0].text =
            'Failed to import `render` from `react-email` (6.0+), `@react-email/components` (5.x), or `@react-email/render`. Install one of them in your project.';
        }
        return result;
      },
    );
  },
});
