import {spawnSync} from 'node:child_process';
const result=spawnSync(process.execPath,['--import','tsx','scripts/import-source.ts',...process.argv.slice(2)],{stdio:'inherit'});
process.exitCode=result.status??1;
