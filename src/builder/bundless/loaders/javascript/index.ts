import { winPath } from '@umijs/utils';
import { getTsconfig } from '../../dts';
import type { IBundlessLoader, IJSTransformer, ILoaderOutput } from '../types';

const transformers: Record<string, IJSTransformer> = {};

export interface ITransformerItem {
  id: string;
  transformer: string;
}

/**
 * add javascript transformer
 * @param item
 */
export function addTransformer(item: ITransformerItem) {
  const mod = require(item.transformer);
  const transformer: IJSTransformer = mod.default || mod;

  transformers[item.id] = transformer;
}

/**
 * builtin javascript loader
 */
export const jsLoader: IBundlessLoader = function (content) {
  const transformer = transformers[this.config.transformer!];
  const outputOpts: ILoaderOutput['options'] = {};

  // specify output ext for non-js file
  if (/\.(jsx|tsx?|vue)$/.test(this.resource)) {
    outputOpts.ext = '.js';
  }

  // mark for output declaration file
  const tsconfig = /\.tsx?$/.test(this.resource)
    ? getTsconfig(this.context!)
    : undefined;
  if (
    tsconfig?.options.declaration &&
    tsconfig?.fileNames.includes(winPath(this.resource))
  ) {
    outputOpts.declaration = true;
  }

  const ret = transformer.call(
    {
      config: this.config,
      pkg: this.pkg,
      paths: {
        cwd: this.cwd,
        fileAbsPath: this.resource,
        itemDistAbsPath: this.itemDistAbsPath,
      },
    },
    content!.toString(),
  );

  // handle async transformer
  if (ret instanceof Promise) {
    const _cb = this.async();
    return ret.then(
      (r) => {
        outputOpts.map = r[1];
        this.setOutputOptions(outputOpts);
        _cb(null, r[0].replace(/\.vue("|')(;?)/g, '.js$1$2'));
      },
      (e) => _cb(e),
    );
  } else {
    outputOpts.map = ret[1];
    this.setOutputOptions(outputOpts);
    return ret[0].replace(/\.vue("|')(;?)/g, '.js$1$2');
  }
};

export default jsLoader;
