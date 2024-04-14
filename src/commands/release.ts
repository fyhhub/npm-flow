import { chalk, execa, logger, semver } from '@umijs/utils';
import fs from 'fs';
import path from 'path';
import prompts from 'prompts';
import { IApi } from '../types';
import { changelog } from './changelog';

/**
 * @type {import('semver').ReleaseType[]}
 */
const versionIncrements = [
  'patch',
  'minor',
  'major',
  // 'prepatch',
  // 'preminor',
  // 'premajor',
  'prerelease',
];

function updateVersion(version: string) {
  const PACKAGE_JSON_FILE = path.resolve(process.cwd(), 'package.json');
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_FILE, 'utf-8'));
  pkg.version = version;
  fs.writeFileSync(PACKAGE_JSON_FILE, JSON.stringify(pkg, null, 2) + '\n');
}

export async function release() {}

export default (api: IApi) => {
  api.registerCommand({
    name: 'release',
    description: 'release',
    async fn({ args: options }) {
      const PACKAGE_JSON_FILE = path.resolve(process.cwd(), 'package.json');
      const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_FILE, 'utf-8'));
      const currentVersion = pkg.version;

      const inc = (i: any) =>
        semver.inc(
          currentVersion,
          i,
          ['patch', 'minor', 'major'].includes(i)
            ? undefined
            : i === 'prerelease'
            ? 'beta'
            : 'alpha',
        );

      const run = (bin: string, args: string[], opts = {}) =>
        execa.execa(bin, args, { stdio: 'inherit', ...opts });

      const step = (msg: string) => console.log(chalk.cyan(msg));
      const dryRun = (bin: any, args: any, opts = {}) =>
        console.log(chalk.blue(`[dryrun] ${bin} ${args.join(' ')}`), opts);
      const runIfNotDry = options.dry ? dryRun : run;

      let targetVersion = '';
      const { release } = await prompts([
        {
          type: 'select',
          name: 'release',
          message: 'Select release type',
          choices: versionIncrements
            .map((i) => ({
              title: `${i} (${inc(i)})${
                i.includes('prerelease')
                  ? ' (测试阶段，较稳定版本)'
                  : i.includes('pre')
                  ? ' (内测阶段，不稳定版本)'
                  : ' (正式版本)'
              }`,
              value: `${i} (${inc(i)})`,
            }))
            .concat([
              {
                title: 'custom',
                value: 'custom',
              },
            ]),
        },
      ]);

      if (!release) return;
      if (release === 'custom') {
        const { version } = await prompts([
          {
            type: 'text',
            name: 'version',
            message: 'Input custom version',
            initial: currentVersion,
          },
        ]);
        targetVersion = version;
      } else {
        targetVersion = release.match(/\((.*)\)/)[1];
      }

      if (!semver.valid(targetVersion)) {
        throw new Error(`invalid target version: ${targetVersion}`);
      }

      const targetTag = `v${targetVersion}`;

      const { yes } = await prompts([
        {
          type: 'confirm',
          name: 'yes',
          message: `Releasing ${targetTag}. Confirm?`,
        },
      ]);

      if (!yes) {
        return;
      }

      step('Updating package version...');
      options.dry &&
        logger.info(`Updating package.json version to ${targetVersion}`);
      !options.dry && updateVersion(targetVersion);

      if (!options.skipBuild) {
        step('Building package...');
        await run('npm', ['run', 'build']);
      }

      await runIfNotDry('git', ['tag', targetTag]);

      step('Generating changelog...');

      await changelog();

      const { stdout } = await run('git', ['diff'], { stdio: 'pipe' });

      if (stdout) {
        step('Committing changes...');
        await runIfNotDry('git', ['add', '-A']);
        await runIfNotDry('git', ['commit', '-m', `chore: ${targetTag}`]);
      } else {
        console.log('No changes to commit.');
      }

      step('Pushing to Gitlab...');
      await runIfNotDry('git', ['push', 'origin', `refs/tags/${targetTag}`]);
      await runIfNotDry('git', ['push']);

      step('Publish to npm...');
      await runIfNotDry('npm', ['publish']);
    },
  });
};
