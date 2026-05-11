export function loadEsbuild(): typeof import('esbuild') {
  if ('pkg' in process) {
    return require('esbuild-wasm');
  }
  return require('esbuild');
}
