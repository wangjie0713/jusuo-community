import { readFile, lstat, readdir } from 'node:fs/promises';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { inspectModel } from './inspect-model.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const list=JSON.parse(await readFile(resolve(root,'scripts/release-files.json'),'utf8'));
const failures=[];let textCount=0;
if(!Array.isArray(list)||list.length!==new Set(list).size)throw Error('Invalid release file list');
for(const required of ['LICENSE','NOTICE.md','THIRD_PARTY_NOTICES.md','public/vendor/LICENSE'])if(!list.includes(required))failures.push(`${required}: required license file missing from allowlist`);
const packageInfo=JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));
if(packageInfo.license!=='MPL-2.0')failures.push('package.json: expected MPL-2.0');
const license=await readFile(resolve(root,'LICENSE'),'utf8');
if(createHash('sha256').update(license).digest('hex')!=='66a3107d5ad6a058aab753eaac2047ccb2ed0e39465dd0fe5844da3e300d5172')failures.push('LICENSE: standard MPL-2.0 text changed');
const forbidden=/(^|\/)(\.git|\.local|dist|node_modules|backups|data|certs)(\/|$)|\.local\.(json|ya?ml)$|(?:^|\/)secrets\.ya?ml$|\.(?:key|pem|p12|db|sqlite|log)$/i;
const rules=[
 ['private key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
 ['token pattern',/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|sk-[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,})\b/],
 ['private local path',/\/(?:Users|home)\/[A-Za-z_][^\s/]*\//],
 ['camera/stream URL',/\b(?:rtsp|rtsps):\/\//],
 ['MAC address',/\b(?:[0-9a-f]{2}:){5}[0-9a-f]{2}\b/i],
 ['geographic value',/\b(?:latitude|longitude)\s*["']?\s*[:=]\s*["']?-?\d{1,3}\.\d{3,}/i],
];
for(const relative of list){
 if(typeof relative!=='string'||relative.startsWith('/')||relative.split('/').includes('..')||forbidden.test(relative)||(/(?:^|\/)\.env(?:\.|$)/.test(relative)&&!relative.endsWith('.env.example'))){failures.push(`${relative}: forbidden path`);continue;}
 const path=resolve(root,relative);let stat;try{stat=await lstat(path);}catch{failures.push(`${relative}: missing`);continue;}
 if(!stat.isFile()||stat.isSymbolicLink()){failures.push(`${relative}: not a regular file`);continue;}
 // Reject symlinked parents too: a normal-looking filename must not escape the CE.
 for(let parent=dirname(path);parent!==root;parent=dirname(parent)){if((await lstat(parent)).isSymbolicLink())failures.push(`${relative}: symlink parent`);}
 const data=await readFile(path);
 if(['.png','.jpg','.jpeg','.webp'].includes(extname(path)))continue;
 textCount++;let text=data.toString('utf8');
 if(!relative.startsWith('public/vendor/')&&/\.(mjs|js|py|css|html|svg)$/.test(relative)&&!text.includes('SPDX-License-Identifier: MPL-2.0'))failures.push(`${relative}: missing source license notice`);
 if(extname(path)==='.glb')try{text=JSON.stringify(inspectModel(data).json);}catch(error){failures.push(`${relative}: ${error.message}`);continue;}
 for(const [label,pattern] of rules)if(pattern.test(text))failures.push(`${relative}: ${label}`);
 if(/\.(mjs|js)$/.test(relative)){
   const result=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});
   if(result.status!==0)failures.push(`${relative}: JavaScript syntax check failed`);
 }
 if(relative.endsWith('.json')||relative.endsWith('.webmanifest'))try{JSON.parse(text);}catch{failures.push(`${relative}: invalid JSON`);}
 if(relative.endsWith('.md')){
   for(const match of text.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)){
     const link=match[1];if(/^(?:https?:|#)/.test(link))continue;
     const target=resolve(dirname(path),link.split('#')[0]);
     if(!list.some(p=>resolve(root,p)===target))failures.push(`${relative}: linked file missing from release list (${link})`);
   }
 }
}
// Third-party files are pinned; replacements require a new reviewed hash.
const vendor=JSON.parse(await readFile(resolve(root,'scripts/vendor-integrity.json'),'utf8'));
for(const [name,expected] of Object.entries(vendor)){const actual=createHash('sha256').update(await readFile(resolve(root,name))).digest('hex');if(actual!==expected)failures.push(`${name}: vendor hash changed`);}
// Guard against accidentally tracking a sensitive file when this becomes its own repo.
const git=spawnSync('git',['rev-parse','--show-toplevel'],{cwd:root,encoding:'utf8'});
if(git.status===0&&git.stdout.trim()===root){const tracked=spawnSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'});for(const p of tracked.stdout.split('\0').filter(Boolean))if(!list.includes(p))failures.push(`${p}: tracked outside release whitelist`);}
if(failures.length){for(const failure of failures)console.error(failure);process.exitCode=1;}
else console.log(`PASS: ${list.length} allowlisted files; ${textCount} text files scanned; JavaScript/JSON/links/vendor hashes checked. Images require human review. This is not publication approval.`);
