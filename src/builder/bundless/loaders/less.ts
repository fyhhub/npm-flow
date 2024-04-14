import { logger } from '@umijs/utils';
import less from 'less';
/**
 * babel transformer
 */
const lessTransformer = async function (this: any, content: string) {
  const cb = this.async();
  const { css } = await less
    .render(content, {
      filename: this.resourcePath,
    })
    .catch((e) => {
      logger.error(e);
      return {} as any;
    });
  this.setOutputOptions({
    content: css,
    ext: '.css',
    options: {
      declaration: false,
    },
  });
  cb(null, css);
  return css;
};

export default lessTransformer;
