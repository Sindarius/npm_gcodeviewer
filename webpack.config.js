const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = {
  entry: './src/index.js',
  mode: 'production',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'sindarius-gcodeviewer.js',
  },
  module: {
    rules: [
      {
        test: /\.(js)$/,
        exclude: /node_modules/,
        loader  : 'babel-loader',
        options: {
          presets: [
            ['@babel/preset-env', { modules : false}]
          ]
        }

      }
    ]
  },
  resolve: {
    extensions: ['*', '.js']
  },
  optimization: {
    usedExports: true,
  },
  externalsPresets: { node: true }, // in order to ignore built-in modules like path, fs, etc.
  externals: [nodeExternals()], // in order to ignore all modules in node_modules folder
}

