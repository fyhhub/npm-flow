import { logger } from '@umijs/utils';
import {
  compileScript,
  compileStyleAsync,
  compileTemplate,
  parse,
  rewriteDefault,
} from '@vue/compiler-sfc';
import hashId from 'hash-sum';
// import {jsLoader} from './javascript/index';

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
  const { descriptor } = parse(content, {
    filename: this.resourcePath,
  });
  let clientCode = '';
  const id = hashId(this.resourcePath);

  const compiledScript = compileScript(descriptor, {
    inlineTemplate: true,
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

  if (compiledScript.warnings?.length) {
    logger.error(compiledScript.warnings);
  }
  scriptCode +=
    `\n` + rewriteDefault(compiledScript.content, COMP_IDENTIFIER, []);

  // 拼接script
  clientCode += scriptCode;

  const hasScoped = descriptor.styles.some((s) => s.scoped);
  if (hasScoped) {
    clientCode += `\n${COMP_IDENTIFIER}.__scopeId = ${JSON.stringify(
      `data-v-${id}`,
    )};\n`;
  }
  if (descriptor.template && !descriptor.scriptSetup) {
    const { code: templateCode, errors } = compileTemplate({
      ast: descriptor.template!.ast,
      source: descriptor.template!.content,
      filename: descriptor.filename,
      scoped: descriptor.styles.some((s) => s.scoped),
      slotted: descriptor.slotted,
      id,
      isProd: false,
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
    const styleResult = await compileStyleAsync({
      source: originCss,
      filename: descriptor.filename,
      id,
      scoped: style.scoped,
      modules: !!style.module,
      preprocessLang: 'less',
    });
    if (styleResult.errors.length) {
      logger.error(styleResult.errors);
    } else {
      css += styleResult.code + '\n';
    }
  }

  clientCode += injectCodeToSetup(css, id);
  clientCode += `\nexport default ${COMP_IDENTIFIER};`;
  cb(null, clientCode);
};

export default vueTransformer;
