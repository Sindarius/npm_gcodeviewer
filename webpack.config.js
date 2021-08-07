const path = require('path');

module.exports = {
  entry: './src/gcodeviewer.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'sindarius-gcodeviewer.js',
    library: {
      name:'GCodeViewer',
      type: 'umd'
    }
  },
  externals: {
    lodash: {
      commonjs: 'lodash',
      commonjs2: 'lodash',
      amd: 'lodash',
      root: '_',
    }
  }
};