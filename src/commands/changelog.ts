import * as logger from '@umijs/utils/dist/logger';
import conventionalChangelog from 'conventional-changelog';
import { createWriteStream, readFileSync } from 'fs';
import path from 'path';
import { IApi } from '../types';

const MAIN_TEMPLATE = path.join(__dirname, '../../template/changelog-main.hbs');
const HEADER_TEMPLATE = path.join(
  __dirname,
  '../../template/changelog-header.hbs',
);
const COMMIT_TEMPLATE = path.join(
  __dirname,
  '../../template/changelog-commit.hbs',
);
const mainTemplate = readFileSync(MAIN_TEMPLATE, 'utf-8');
const headerPartial = readFileSync(HEADER_TEMPLATE, 'utf-8');
const commitPartial = readFileSync(COMMIT_TEMPLATE, 'utf-8');

function formatType(type: string) {
  const MAP: Record<string, string> = {
    fix: 'Bug Fixes',
    feat: 'Feature',
    docs: 'Document',
    types: 'Types',
  };

  return MAP[type] || type;
}
function transform(item: any) {
  if (item.type === 'chore' || item.type === 'test') {
    return null;
  }

  item.type = formatType(item.type);

  if (item.hash) {
    item.shortHash = item.hash.slice(0, 6);
  }

  if (item.references.length) {
    item.references.forEach((ref: any) => {
      if (ref.issue && item.subject) {
        item.subject = item.subject.replace(` (#${ref.issue})`, '');
      }
    });
  }
  return item;
}

export function changelog() {
  return new Promise((resolve) => {
    logger.event('开始生成 CHANGELOG.md');
    conventionalChangelog(
      {
        preset: 'angular',
        releaseCount: 0,
      },
      undefined,
      undefined,
      undefined,
      {
        mainTemplate,
        headerPartial,
        commitPartial,
        transform,
      },
    )
      .pipe(createWriteStream(path.join(process.cwd(), 'CHANGELOG.md')))
      .on('close', () => {
        resolve(undefined);
        logger.info('CHANGELOG.md 生成成功');
      });
  });
}
export default (api: IApi) => {
  api.registerCommand({
    name: 'changelog',
    description: 'changelog',
    fn({ args }) {
      return changelog();
    },
  });
};
