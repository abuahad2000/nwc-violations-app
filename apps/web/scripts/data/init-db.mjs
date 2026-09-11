import {spawnSync} from 'node:child_process';
const result=spawnSync(process.execPath,['--import','tsx','--eval',"import {db} from './src/lib/db/index.ts'; db.prepare('SELECT 1').get(); console.log('Database initialized without demo accounts');"],{stdio:'inherit'});
process.exitCode=result.status??1;
