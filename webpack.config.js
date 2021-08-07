const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = {
  entry: './src/gcodeviewer.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'sindarius-gcodeviewer.js',
    library: {
      name: 'GCodeViewer',
      type: 'umd'
    },
  },
  externalsPresets: { node: true }, // in order to ignore built-in modules like path, fs, etc.
  externals: [nodeExternals()], // in order to ignore all modules in node_modules folder

}

