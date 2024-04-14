import {
  addLoader as addBundlessLoader,
  ILoaderItem,
} from '../../builder/bundless/loaders';
import {
  addTransformer as addJSTransformer,
  ITransformerItem,
} from '../../builder/bundless/loaders/javascript';
import { IApi, IFatherJSTransformerTypes } from '../../types';

export default async (api: IApi) => {
  // collect all bundless loaders
  const vueVersion = api.args.vue || api.userConfig.vue?.version || 3;
  const bundlessLoaders: ILoaderItem[] = await api.applyPlugins({
    key: 'addBundlessLoader',
    initialValue: [
      {
        id: 'vue-loader',
        test: /\.vue$/,
        loader: require.resolve(
          `../../builder/bundless/loaders/vue${vueVersion === 2 ? '2' : ''}`,
        ),
      },
      {
        id: 'less-loader',
        test: /\.less$/,
        loader: require.resolve('../../builder/bundless/loaders/less'),
      },
      {
        id: 'js-loader',
        test: /((?<!\.d)|\.vue|\.ts|\.(jsx?|tsx))$/,
        loader: require.resolve('../../builder/bundless/loaders/javascript'),
      },
    ],
  });

  // register bundless loaders
  bundlessLoaders.forEach((l) => addBundlessLoader(l));

  // collect all bundless js transformers
  const jsTransformers: ITransformerItem[] = await api.applyPlugins({
    key: 'addJSTransformer',
    initialValue: [
      {
        id: IFatherJSTransformerTypes.BABEL,
        transformer: require.resolve(
          '../../builder/bundless/loaders/javascript/babel',
        ),
      },
      {
        id: IFatherJSTransformerTypes.ESBUILD,
        transformer: require.resolve(
          '../../builder/bundless/loaders/javascript/esbuild',
        ),
      },
      {
        id: IFatherJSTransformerTypes.SWC,
        transformer: require.resolve(
          '../../builder/bundless/loaders/javascript/swc',
        ),
      },
    ],
  });

  // register js transformers
  jsTransformers.forEach((t) => addJSTransformer(t));
};
