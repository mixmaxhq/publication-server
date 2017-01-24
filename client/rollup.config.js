/* jshint node:true */
import babel from 'rollup-plugin-babel';
import commonjs from 'rollup-plugin-commonjs';
import nodeResolve from 'rollup-plugin-node-resolve';
import rootImport from 'rollup-plugin-root-import';

var pkg = require('./package.json');

export default {
  entry: 'src/index.js',
  external: ['underscore', 'jquery'],
  plugins: [
    rootImport({
      useEntry: 'prepend',
      // Because we omit the .js most of the time, we put it first, and explicitly specify that it
      // should attempt the lack of extension only after it tries to resolve with the extension.
      extensions: ['.js', '']
    }),
    nodeResolve({
      // Needed in addition to the `external` definition to suppress `require('underscore')`
      // https://github.com/rollup/rollup-plugin-node-resolve/issues/72.
      skip: ['underscore']
    }),
    commonjs({
      include: ['node_modules/**'],
      namedExports: {
        './primus.js': ['Primus']
      }
    }),
    babel({
      presets: [
        [
          'es2015',
          {
            modules: false
          }
        ]
      ],
      plugins: [
        'external-helpers'
      ],
      exclude: ['node_modules/**']
    })
  ],
  targets: [
    {
      dest: pkg['browser']
    }
  ]
};
