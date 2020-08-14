import path from 'path';

import { getOptions } from 'loader-utils';
import validateOptions from 'schema-utils';

import postcss from 'postcss';

import Warning from './Warning';
import SyntaxError from './Error';
import parseOptions from './options';
import schema from './options.json';
import { exec, loadConfig, createPostCssPlugins } from './utils';

function pluginsToArray(plugins) {
  if (typeof plugins === 'undefined') {
    return [];
  }

  if (Array.isArray(plugins)) {
    return plugins;
  }

  return [plugins];
}

/**
 * **PostCSS Loader**
 *
 * Loads && processes CSS with [PostCSS](https://github.com/postcss/postcss)
 *
 * @method loader
 *
 * @param {String} content Source
 * @param {Object} sourceMap Source Map
 *
 * @return {callback} callback Result
 */

export default async function loader(content, sourceMap, meta = {}) {
  const options = getOptions(this);

  validateOptions(schema, options, {
    name: 'PostCSS Loader',
    baseDataPath: 'options',
  });

  const callback = this.async();
  const file = this.resourcePath;
  let loadedConfig = {};

  const configOptions =
    typeof options.config === 'undefined' ? true : options.config;

  if (configOptions) {
    const dataForLoadConfig = {
      path: path.dirname(file),
      ctx: {
        file: {
          extname: path.extname(file),
          dirname: path.dirname(file),
          basename: path.basename(file),
        },
        options: {},
      },
    };

    if (typeof configOptions.path !== 'undefined') {
      dataForLoadConfig.path = path.resolve(configOptions.path);
    }

    if (typeof configOptions.ctx !== 'undefined') {
      dataForLoadConfig.ctx.options = configOptions.ctx;
    }

    dataForLoadConfig.ctx.webpack = this;

    try {
      loadedConfig = await loadConfig(
        configOptions,
        dataForLoadConfig.ctx,
        dataForLoadConfig.path,
        this
      );
    } catch (error) {
      callback(error);

      return;
    }
  }

  const mergedOptions = {
    ...loadedConfig,
    ...options,
    plugins: [
      ...pluginsToArray(loadedConfig.plugins),
      ...pluginsToArray(options.plugins),
    ],
  };

  let config;

  const { length } = Object.keys(mergedOptions).filter((option) => {
    switch (option) {
      // case 'exec':
      // case 'ident':
      case 'config':
      case 'sourceMap':
        return false;
      default:
        return option;
    }
  });

  if (length) {
    config = parseOptions.call(this, mergedOptions);
  }

  if (typeof config.options !== 'undefined') {
    if (typeof config.options.to !== 'undefined') {
      delete config.options.to;
    }

    if (typeof config.options.from !== 'undefined') {
      delete config.options.from;
    }
  }

  const plugins = config.plugins || [];

  const postcssOptions = Object.assign(
    {
      from: file,
      map: options.sourceMap
        ? options.sourceMap === 'inline'
          ? { inline: true, annotation: false }
          : { inline: false, annotation: false }
        : false,
    },
    config.options
  );

  // Loader Exec (Deprecated)
  // https://webpack.js.org/api/loaders/#deprecated-context-properties
  if (postcssOptions.parser === 'postcss-js') {
    // eslint-disable-next-line no-param-reassign
    content = exec(content, this);
  }

  if (typeof postcssOptions.parser === 'string') {
    try {
      // eslint-disable-next-line import/no-dynamic-require,global-require
      postcssOptions.parser = require(postcssOptions.parser);
    } catch (error) {
      throw new Error(
        `Loading PostCSS Parser failed: ${error.message}\n\n(@${file})`
      );
    }
  }

  if (typeof postcssOptions.syntax === 'string') {
    try {
      // eslint-disable-next-line import/no-dynamic-require,global-require
      postcssOptions.syntax = require(postcssOptions.syntax);
    } catch (error) {
      throw new Error(
        `Loading PostCSS Syntax failed: ${error.message}\n\n(@${file})`
      );
    }
  }

  if (typeof postcssOptions.stringifier === 'string') {
    try {
      // eslint-disable-next-line import/no-dynamic-require,global-require
      postcssOptions.stringifier = require(postcssOptions.stringifier);
    } catch (error) {
      throw new Error(
        `Loading PostCSS Stringifier failed: ${error.message}\n\n(@${file})`
      );
    }
  }

  // Loader API Exec (Deprecated)
  // https://webpack.js.org/api/loaders/#deprecated-context-properties
  if (config.exec) {
    // eslint-disable-next-line no-param-reassign
    content = exec(content, this);
  }

  if (options.sourceMap && typeof sourceMap === 'string') {
    // eslint-disable-next-line no-param-reassign
    sourceMap = JSON.parse(sourceMap);
  }

  if (options.sourceMap && sourceMap) {
    postcssOptions.map.prev = sourceMap;
  }

  const resultPlugins = createPostCssPlugins(plugins, file);

  let result;

  try {
    result = await postcss(resultPlugins).process(content, postcssOptions);
  } catch (error) {
    if (error.file) {
      this.addDependency(error.file);
    }

    if (error.name === 'CssSyntaxError') {
      callback(new SyntaxError(error));
    } else {
      callback(error);
    }

    return;
  }

  const { css, root, processor, messages } = result;
  let { map } = result;

  result.warnings().forEach((warning) => {
    this.emitWarning(new Warning(warning));
  });

  messages.forEach((msg) => {
    if (msg.type === 'dependency') {
      this.addDependency(msg.file);
    }
  });

  map = map ? map.toJSON() : null;

  if (map) {
    map.file = path.resolve(map.file);
    map.sources = map.sources.map((src) => path.resolve(src));
  }

  const ast = {
    type: 'postcss',
    version: processor.version,
    root,
  };

  const newMeta = { ...meta, ast, messages };

  /**
   * @memberof loader
   * @callback callback
   *
   * @param {Object} null Error
   * @param {String} css  Result (Raw Module)
   * @param {Object} map  Source Map
   */
  callback(null, css, map, newMeta);
}

/**
 * @author Andrey Sitnik (@ai) <andrey@sitnik.ru>
 *
 * @license MIT
 * @version 3.0.0
 *
 * @module postcss-loader
 *
 * @requires path
 *
 * @requires loader-utils
 * @requires schema-utils
 *
 * @requires postcss
 * @requires postcss-load-config
 *
 * @requires ./options.js
 * @requires ./Warning.js
 * @requires ./SyntaxError.js
 */
