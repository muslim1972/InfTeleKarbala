import { execFileSync } from 'node:child_process';
import path from 'node:path';

const putty = 'C:\\Program Files\\PuTTY';
const pw = execFileSync('powershell', ['-NoProfile', '-Command', "[Environment]::GetEnvironmentVariable('VPS_PW','User')"], { encoding: 'utf8' }).trim();
const host = 'muslim@10.56.3.3';

execFileSync(path.join(putty, 'pscp.exe'), ['-batch', '-pw', pw, path.resolve('_archive/scripts/inspect_loc.sql'), `${host}:/tmp/inspect_query.sql`]);

const out = execFileSync(path.join(putty, 'plink.exe'), ['-batch', '-pw', pw, host, `VPS_PW='${pw}' bash /tmp/bricks-runsql.sh /tmp/inspect_query.sql postgres`], { encoding: 'utf8' });
console.log(out);
