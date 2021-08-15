import resolve from '@rollup/plugin-node-resolve';
import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';



export default [
    {
        input: 'src/index.js',
        output: {
            name: '',
            file: 'dist/sindarius-gcodeviewer.es.js',
            format: 'es',
            exports : 'named',
        },
        plugins: [
            //resolve(),
            babel({ babelHelpers: 'bundled'  }),
            terser({
                ecma: 2018,
                mangle: { toplevel: false },
                module : true,
                compress: {
                  unsafe_arrows: true,
                },
                output: { quote_style: 1 }
              })
        ]
    },
    {
        input: 'src/index.js',
        output: {
            name: '',
            file: 'dist/sindarius-gcodeviewer.js',
            format: 'cjs',
            exports : 'named',
        },
        plugins: [
          //  resolve(),
            commonjs(),
//            babel({ babelHelpers: 'bundled'  }),
            terser({
                ecma: 2018,
                mangle: { toplevel: false },
                compress: {
                  unsafe_arrows: true,
                },
                output: { quote_style: 1 }
              })
            
        ]
    }

];