import { logger } from '@umijs/utils';
import {
  compileScript,
  compileStyleAsync,
  compileTemplate,
  parse,
  rewriteDefault,
} from 'compiler-sfc-browser-vue2';
import hashId from 'hash-sum';
import less from 'less';

export function injectCodeToSetup(code: string, styleId: string) {
  const injectCode = `
const $insertStylesheet = (css)=>{
  let style = document.getElementById('${styleId}')
  if(!style){
    style = document.createElement("style")
    style.id = '${styleId}'
    document.head.appendChild(style);
    style.innerHTML = css
  }
}
$insertStylesheet(\`${code}\`)
  `;
  return injectCode;
}
const COMP_IDENTIFIER = '__sfc__';
/**
 * babel transformer
 */
const vueTransformer = async function (this: any, content: string) {
  const cb = this.async();
  const descriptor = parse({
    source: content,
    filename: this.resourcePath,
  });
  let clientCode = '';
  const id = hashId(this.resourcePath);

  const compiledScript = compileScript(descriptor, {
    isProd: false,
    id,
  });
  let scriptCode = '';
  if (compiledScript.bindings) {
    scriptCode += `\n/* Analyzed bindings: ${JSON.stringify(
      compiledScript.bindings,
      null,
      2,
    )} */`;
  }
  scriptCode +=
    `\n` +
    rewriteDefault(compiledScript.content, COMP_IDENTIFIER, [
      'typescript',
      'jsx',
    ]);

  // 拼接script
  clientCode += scriptCode;

  const hasScoped = descriptor.styles.some((s) => s.scoped);
  if (hasScoped) {
    clientCode += `\n${COMP_IDENTIFIER}._scopeId = ${JSON.stringify(
      `data-v-${id}`,
    )};\n`;
  }
  if (descriptor.template && !descriptor.scriptSetup) {
    const { code: templateCode, errors } = compileTemplate({
      source: descriptor.template!.content,
      filename: descriptor.filename,
      isTS: descriptor.script?.lang === 'ts',
      compilerOptions: {
        scopeId: hasScoped ? `data-v-${id}` : '',
      },
    });
    if (errors.length) {
      logger.error(errors);
    }
    // 拼接template
    clientCode += templateCode;

    clientCode += `\n${COMP_IDENTIFIER}.render = render;`;
  }

  let css = '';
  for (const style of descriptor.styles) {
    if (style.module) {
      return [`<style module> is not supported.`];
    }
    let originCss = style.content;
    if (style.lang === 'less') {
      const { css: lessCode, imports } = await less
        .render(style.content, {
          filename: this.resourcePath,
        })
        .catch((e) => {
          logger.error(e);
          return {} as any;
        });
      originCss = lessCode + '\n';
    }
    const styleResult = await compileStyleAsync({
      source: originCss,
      filename: descriptor.filename,
      id: `data-v-${id}`,
      scoped: style.scoped,
      isProd: false,
    });
    if (styleResult.errors.length) {
      logger.error(styleResult.errors);
    } else {
      css += styleResult.code + '\n';
    }
  }

  clientCode += css ? injectCodeToSetup(css, id) : '';
  clientCode +=
    `\n${COMP_IDENTIFIER}.staticRenderFns = staticRenderFns` +
    `\nexport default ${COMP_IDENTIFIER}`;

  cb(null, clientCode);
};

export default vueTransformer;
