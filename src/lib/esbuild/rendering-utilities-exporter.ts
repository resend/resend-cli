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
        const result = await b.resolve('react-email', options);
        if (result.errors.length > 0 && result.errors[0]) {
          result.errors[0].text =
            'Failed to import `render` from `react-email`. Install it with `npm install react-email` (or upgrade from `@react-email/components` to `react-email` 6.0+).';
        }
        return result;
      },
    );
  },
});
