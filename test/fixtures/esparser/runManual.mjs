import webpack from 'webpack';
import path from "path";

const __dirname = path.resolve();
const rootDir = path.resolve(__dirname, "test/helpers");

const compiler = webpack({
  target: 'node',
  mode: "development",
  devtool: false,
  context: path.resolve(rootDir, "../fixtures"),
  entry: path.resolve(rootDir, "../fixtures", "./sss/index.js"),
  output: {
    path: path.resolve(rootDir, "../outputs"),
    filename: "[name].bundle.js",
    chunkFilename: "[name].chunk.js",
    publicPath: "/webpack/public/path/",
  },
  module: {
    rules: [
      {
        test: /\.(css|sss)$/i,
        use: [
          'css-loader',
          {
            loader: path.resolve(rootDir, "../../dist"),
            options: {
              postcssOptions: {
                parser: path.resolve(rootDir, "../fixtures/esparser/index.mjs"),
                stringifier: path.resolve(rootDir, "../fixtures/esparser/index.mjs"),
                syntax: path.resolve(rootDir, "../fixtures/esparser/index.mjs"),
              },
            },
          },
        ],
      },
    ],
  },
  plugins: [],
});

compiler.run((error) => {
  if (error) {
    throw error;
  }
});
