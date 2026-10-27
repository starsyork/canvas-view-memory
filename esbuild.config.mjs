import * as esbuild from 'esbuild';

const options = {
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: ['obsidian'],
  format: 'cjs',
  target: 'es2020',
  outfile: 'main.js',
  banner: { js: '/* Canvas View Memory | MIT License */' },
};

if (process.argv.includes('--watch')) {
  const context = await esbuild.context(options);
  await context.watch();
  console.log('Watching for changes...');
} else {
  await esbuild.build(options);
}
