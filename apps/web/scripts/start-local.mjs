import {spawn} from 'node:child_process';
import {Pool} from 'pg';
import {prepare} from './startup-check.mjs';
await prepare();
const keeper=process.platform==='win32'?spawn('wsl.exe',['-d','Ubuntu','-u','root','--','sh','-lc','pg_ctlcluster 16 main start >/dev/null 2>&1; exec tail -f /dev/null'],{windowsHide:true,stdio:'ignore'}):null;
const pool=new Pool({connectionString:process.env.POSTGIS_URL,connectionTimeoutMillis:1000});
let ready=false;
for(let attempt=0;attempt<20;attempt++){try{await pool.query('SELECT PostGIS_Version()');ready=true;break;}catch{await new Promise(r=>setTimeout(r,1000));}}
await pool.end();
if(!ready){keeper?.kill();throw new Error('PostGIS unavailable. Check the local PostgreSQL service.');}
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',process.env.NWC_PORT||'3100'],{stdio:'inherit',windowsHide:true});
child.on('exit',code=>{keeper?.kill();process.exitCode=code||0;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{child.kill();keeper?.kill();});
