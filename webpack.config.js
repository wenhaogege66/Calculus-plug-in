const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'development',
  devtool: 'inline-source-map',
  entry: {
    'background/index': './src/background/index.ts',
    'content/index': './src/content/index.ts',
    'popup/index': './src/popup/index.tsx',
    'sidepanel/index': './src/sidepanel/index.tsx',
    // 学生端组件
    'student/homework-upload': './src/student/components/HomeworkUpload.tsx',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js']
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'manifest.json', to: 'manifest.json' },
        { from: 'src/popup/index.html', to: 'popup/index.html' },
        { from: 'src/sidepanel/index.html', to: 'sidepanel/index.html' },
        { from: 'src/content/styles.css', to: 'content/styles.css' },
        { from: 'src/icons', to: 'icons', noErrorOnMissing: true }
      ]
    })
  ]
}; 