import postcss from "postcss";
import { satisfies } from "semver";
import postcssPackage from "postcss/package.json";

import Warning from "./Warning";
import SyntaxError from "./Error";
import schema from "./options.json";
import {
  loadConfig,
  getPostcssOptions,
  exec,
  normalizeSourceMap,
  normalizeSourceMapAfterPostcss,
} from "./utils";

/**
 * **PostCSS Loader**
 *
 * Loads && processes CSS with [PostCSS](https://github.com/postcss/postcss)
 *
 * @method loader
 *
 * @param {String} content Source
 * @param {Object} sourceMap Source Map
 * @param {Object} meta Meta
 *
 * @return {callback} callback Result
 */

export default async function loader(content, sourceMap, meta) {
  const options = this.getOptions(schema);
  const callback = this.async();
  const configOption =
    typeof options.postcssOptions === "undefined" ||
    typeof options.postcssOptions.config === "undefined"
      ? true
      : options.postcssOptions.config;

  const postcssFactory = options.implementation || postcss;

  let loadedConfig;

  if (configOption) {
    try {
      loadedConfig = await loadConfig(
        this,
        configOption,
        options.postcssOptions
      );
    } catch (error) {
      callback(error);

      return;
    }
  }

  const useSourceMap =
    typeof options.sourceMap !== "undefined"
      ? options.sourceMap
      : this.sourceMap;

  const { plugins, processOptions } = await getPostcssOptions(
    this,
    loadedConfig,
    options.postcssOptions
  );

  if (useSourceMap) {
    processOptions.map = {
      inline: false,
      annotation: false,
      ...processOptions.map,
    };
  }

  if (sourceMap && processOptions.map) {
    processOptions.map.prev = normalizeSourceMap(sourceMap, this.context);
  }

  let root;

  // Reuse PostCSS AST from other loaders
  if (
    meta &&
    meta.ast &&
    meta.ast.type === "postcss" &&
    satisfies(meta.ast.version, `^${postcssPackage.version}`)
  ) {
    ({ root } = meta.ast);
  }

  if (!root && options.execute) {
    // eslint-disable-next-line no-param-reassign
    content = exec(content, this);
  }

  let result;

  try {
    result = await postcssFactory(plugins).process(
      root || content,
      processOptions
    );
  } catch (error) {
    if (error.file) {
      this.addDependency(error.file);
    }

    if (error.name === "CssSyntaxError") {
      callback(new SyntaxError(error));
    } else {
      callback(error);
    }

    return;
  }

  for (const warning of result.warnings()) {
    this.emitWarning(new Warning(warning));
  }

  for (const message of result.messages) {
    // eslint-disable-next-line default-case
    switch (message.type) {
      case "dependency":
        this.addDependency(message.file);
        break;
      case "build-dependency":
        this.addBuildDependency(message.file);
        break;
      case "missing-dependency":
        this.addMissingDependency(message.file);
        break;
      case "context-dependency":
        this.addContextDependency(message.file);
        break;
      case "asset":
        if (message.content && message.file) {
          this.emitFile(
            message.file,
            message.content,
            message.sourceMap,
            message.info
          );
        }
    }
  }

  // eslint-disable-next-line no-undefined
  let map = result.map ? result.map.toJSON() : undefined;

  if (map && useSourceMap) {
    map = normalizeSourceMapAfterPostcss(map, this.context);
  }

  const ast = {
    type: "postcss",
    version: result.processor.version,
    root: result.root,
  };

  callback(null, result.css, map, { ast });
}
