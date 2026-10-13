#!/usr/bin/env node
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { spawnSync } from 'node:child_process';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const AUTH0_DOMAIN = 'platform-cyclopt.eu.auth0.com';
const AUTH0_CLIENT_ID = 'qzhyM1MlB8nnmIP31iMF2sRdHJMKleT4'; // gitleaks:allow
const API_BASE = (process.env.ARIADNE_API_BASE_URL || 'https://ariadne.cyclopt.com/backend').replace(/\/$/, '');
const PORT = 8765;
const CALLBACK = `http://127.0.0.1:${PORT}/callback`;
const ROOT = process.env.ARIADNE_HOME || path.join(os.homedir(), '.config', 'ariadne');
const SESSION = path.join(ROOT, 'session.json');
const b64url = input => Buffer.from(input).toString('base64url');
const random = () => crypto.randomBytes(32).toString('base64url');
const sha256 = input => crypto.createHash('sha256').update(input).digest();


function writeSession(data) {
  fs.mkdirSync(ROOT, { recursive: true, mode: 0o700 });
  fs.chmodSync(ROOT, 0o700);
  const tmp = path.join(ROOT, `session.${process.pid}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  fs.renameSync(tmp, SESSION);
  fs.chmodSync(SESSION, 0o600);
}
function openBrowser(url) {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  const child = spawn(cmd, args, { stdio: 'ignore', detached: true, windowsHide: true });
  child.on('error', () => {});
  child.unref();
}
async function post(url, data) {
  const response = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    signal: AbortSignal.timeout(15000)
  });
  const value = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(value.error_description || value.error || `HTTP ${response.status}`);
    err.code = value.code;
    err.status = response.status;
    throw err;
  }
  return value;
}
async function login() {
  const verifier = random();
  const state = random();
  const challenge = b64url(sha256(verifier));
  const params = new URLSearchParams({ response_type: 'code', client_id: AUTH0_CLIENT_ID,
    redirect_uri: CALLBACK, scope: 'openid profile email', state, code_challenge: challenge,
    code_challenge_method: 'S256' });
  // No Management API audience: authentication only, via Auth0 /userinfo.
  const authorizationUrl = `https://${AUTH0_DOMAIN}/authorize?${params}`;
  let server;
  const callback = new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      const incoming = new URL(req.url, CALLBACK);
      if (req.method !== 'GET' || incoming.pathname !== '/callback') {
        res.writeHead(404).end('Not found'); return;
      }
      if (incoming.searchParams.get('state') !== state) {
        res.writeHead(400).end('Invalid state'); return;
      }
      if (incoming.searchParams.has('error')) {
        res.writeHead(400).end('Authentication failed. Return to terminal.');
        reject(new Error(incoming.searchParams.get('error_description') || incoming.searchParams.get('error')));
        return;
      }
      const code = incoming.searchParams.get('code');
      if (!code) { res.writeHead(400).end('Missing authorization code'); return; }
      // Browser tabs opened by macOS `open` cannot reliably close themselves.
      // Display a useful confirmation without a nonfunctional close button.
      const page = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <title>Ariadne · Authentication</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center;
      background: radial-gradient(ellipse at 50% 10%, #24315a, #0b1020 70%);
      color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    main { width: min(440px, calc(100vw - 40px)); padding: 48px 30px;
      text-align: center; background: rgba(18, 26, 46, .82);
      border: 1px solid #33415f; border-radius: 22px; box-shadow: 0 20px 60px #0005; }
    .brand { font-size: 24px; font-weight: 760; letter-spacing: .16em; margin: 0 0 34px; }
    .symbol { display: grid; place-items: center; width: 74px; height: 74px;
      margin: 0 auto 24px; border-radius: 50%; background: #123d35;
      color: #6ee7b7; border: 2px solid #34d399; font-size: 38px; }
    h1 { font-size: 23px; margin: 0 0 13px; }
    p { color: #b5c1d5; font-size: 15px; line-height: 1.7; margin: 0; }
    footer { margin-top: 38px; color: #8190a9; font-size: 12px; }
  </style>
</head>
<body>
  <main>
    <div class="brand">ARIADNE</div>
    <div class="symbol" aria-hidden="true">✓</div>
    <h1>Authentication received</h1>
    <p>Your sign-in has been received.<br />Return to your terminal to confirm your account status.<br />You can safely close this tab.</p>
    <footer>Powered by Cyclopt</footer>
  </main>
</body>
</html>`;
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer'
      }).end(page);
      resolve(code);
    });
    server.once('error', reject);
    server.listen(PORT, '127.0.0.1');
  });
  try {
    await new Promise((resolve, reject) => { if (server.listening) resolve(); else { server.once('listening', resolve); server.once('error', reject); } });
    console.log('Opening browser for Auth0 login:', authorizationUrl);
    openBrowser(authorizationUrl);
    let timer;
    let code;
    try {
      code = await Promise.race([callback, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Login timed out')), 120000); })]);
    } finally { clearTimeout(timer); }
    const auth = await post(`https://${AUTH0_DOMAIN}/oauth/token`, {
      grant_type: 'authorization_code', client_id: AUTH0_CLIENT_ID,
      code, redirect_uri: CALLBACK, code_verifier: verifier
    });
    if (!auth.access_token) throw new Error('No Auth0 access token received');
    let exchanged;
    try {
      exchanged = await post(`${API_BASE}/api/oauth/cli/exchange`, {
        accessToken: auth.access_token,
        idToken: auth.id_token
      });
    } catch (error) {
      if (error.code === 'ACCOUNT_PENDING_APPROVAL') {
        console.log('\nYour Ariadne account is pending administrator approval.');
        console.log('An administrator has been notified for new registrations.');
        return;
      }
      if (error.code === 'ACCOUNT_NOT_APPROVED') {
        console.log('\nYour Ariadne account has not been approved.');
        return;
      }
      throw error;
    }
    writeSession({ api: API_BASE, token: exchanged.accessToken, email: exchanged.email, createdAt: new Date().toISOString() });
    console.log(`Logged in to Ariadne as ${exchanged.email}.`);
  } finally { if (server) { server.close(); server.closeAllConnections?.(); } }
}

const flags = process.argv.slice(3);
const option = key => { const i=flags.indexOf(key); return i<0?undefined:flags[i+1]; };
const has = key => flags.includes(key);
const configDir=()=>process.env.ARIADNE_OPENCODE_DIR||path.join(os.homedir(),'.config','opencode');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
function readJson(file, fallback=null) { try { return JSON.parse(fs.readFileSync(file,'utf8')); } catch(e) { if(e.code==='ENOENT')return fallback; throw new Error(`Cannot parse ${file}: ${e.message}`); } }
function atomic(file,data) { fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700}); const tmp=`${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;try {fs.writeFileSync(tmp,data,{mode:0o600,flag:'wx'});fs.renameSync(tmp,file);}finally{try{fs.unlinkSync(tmp)}catch(e){if(e.code!=='ENOENT')throw e}} }
function json(file,data) { atomic(file,JSON.stringify(data,null,2)+'\n'); }
function session(ctx) { const s=readJson(ctx.SESSION); if(!s?.token)throw Error('Not logged in; run login first.'); if(s.api!==ctx.API_BASE)throw Error(`Your session belongs to ${s.api}. Set ARIADNE_API_BASE_URL=${s.api} or log in again.`);return s; }
async function get(ctx,route) { const s=session(ctx);const r=await fetch(ctx.API_BASE+route,{headers:{Authorization:`Bearer ${s.token}`},signal:AbortSignal.timeout(15000)});const payload=await r.json().catch(()=>({}));if(!r.ok)throw Error(`${route}: ${payload.error||`HTTP ${r.status}`}`);return payload; }
const validId=x=>typeof x==='string'&&/^[a-f0-9]{24}$/i.test(x);
const validName=x=>typeof x==='string'&&/^[a-z0-9_-]{1,60}$/.test(x);
function agentName(n) {return 'ariadne-'+String(n).toLowerCase().replace(/[^a-z0-9_-]/g,'-').replace(/^-+|-+$/g,'').replace(/^ariadne-/, '').slice(0,52);}
const within=(root,rel)=>{ const resolved=path.resolve(root,rel);if(!resolved.startsWith(path.resolve(root)+path.sep))throw Error('Unsafe file location');return resolved; };
function renderAgent(a) {
 if(!a||typeof a.name!=='string'||typeof a.prompt!=='string'||typeof a.description!=='string'||a.prompt.length>200000)throw Error('Invalid agent from API');
 const name=agentName(a.name);if(!validName(name))throw Error('Unsafe agent name');
 // YAML strings are encoded as JSON double-quoted scalars. Separate remote data from metadata.
 return {name,text:`---\ndescription: ${JSON.stringify(a.description.replace(/[\r\n]+/g,' ').slice(0,500))}\nmode: subagent\n---\n\n${a.prompt}\n`};
}
function renderSkill(skill) {
 if (!skill || !validName(skill.name) || typeof skill.description !== 'string' ||
     typeof skill.instructions !== 'string' || skill.instructions.length > 100000 ||
     skill.description.length > 500) throw Error('Invalid skill received from Ariadne');
 // Provision into dedicated namespace; never execute downloaded instructions during sync.
 const name = 'ariadne-' + skill.name.replace(/^ariadne-/, '');
 return { name, text: `---\nname: ${JSON.stringify(name)}\ndescription: ${JSON.stringify(skill.description.replace(/[\r\n]+/g, ' '))}\n---\n\n${skill.instructions}\n` };
}
function desiredFiles(data) {if(data.schemaVersion!==1||data.client!=='opencode'||!Array.isArray(data.agents)||!data.organization?.id||!validId(data.organization.id))throw Error('Unexpected provisioning schema');
 const entries=new Map();for(const a of data.agents){const {name,text}=renderAgent(a);const rel=`agents/${name}.md`;if(entries.has(rel))throw Error('Agent names collide');entries.set(rel,text);}if(data.skills !== undefined && !Array.isArray(data.skills))throw Error('Invalid skills payload');for(const skill of (data.skills||[])){const {name,text}=renderSkill(skill);const rel=`skills/${name}/SKILL.md`;if(entries.has(rel))throw Error('Skill name collision');entries.set(rel,text);}return entries;}
async function chooseOrganization(ctx) {const result=await get(ctx,'/api/agentic/organizations');const orgs=result.organizations||[];if(!Array.isArray(orgs)||!orgs.length)throw Error('You have no active organization memberships.');const explicit=option('--organization');if(explicit){const selected=orgs.find(x=>x.id===explicit);if(!selected)throw Error('Organization is not available to this user.');return selected;}
 const state=readJson(path.join(ctx.ROOT,'provisioning-state.json'),{});const previous=orgs.find(x=>x.id===state.organizationId);if(previous)return previous;if(orgs.length===1)return orgs[0];
 if(!stdin.isTTY)throw Error('Multiple organizations; specify --organization <id>.');
 console.log('Choose organization:');orgs.forEach((x,i)=>console.log(`  ${i+1}. ${x.name} (${x.id})`));const rl=readline.createInterface({input:stdin,output:stdout});let response;try{response=await rl.question('Number: ');}finally{rl.close();}const index=Number(response)-1;if(!Number.isInteger(index)||!orgs[index])throw Error('Invalid selection');return orgs[index];}
function apply(ctx,manifest,{orgId}) {const root=configDir();const stateFile=path.join(ctx.ROOT,'provisioning-state.json');const prior=readJson(stateFile,{files:{}});if(prior.organizationId&&prior.organizationId!==orgId)throw Error('Different organization already provisioned; use a different ARIADNE_HOME and ARIADNE_OPENCODE_DIR for separate org profiles.');
 const desired=desiredFiles(manifest);const changes=[];const next={};
 for(const [rel,content] of desired){const file=within(root,rel);const old=prior.files?.[rel];if(fs.existsSync(file)){const current=hash(fs.readFileSync(file));if(!old||old!==current)throw Error(`Refusing to overwrite user-modified/unmanaged file: ${file}`);}changes.push({type:'write',file,content});next[rel]=hash(content);}
 for(const [rel,expected] of Object.entries(prior.files||{})){if(desired.has(rel))continue;const file=within(root,rel);if(fs.existsSync(file)){if(hash(fs.readFileSync(file))!==expected)throw Error(`Refusing to remove modified file: ${file}`);changes.push({type:'remove',file});}}
 // Perform all validations before writes. No global OpenCode/Matrixx config is overwritten.
 for(const change of changes){if(change.type==='write')atomic(change.file,change.content);else fs.unlinkSync(change.file);}
 json(stateFile,{organizationId:orgId,api:ctx.API_BASE,files:next,updatedAt:new Date().toISOString(),agentCount:desired.size,models:manifest.models||[],warnings:manifest.warnings||[]});
 console.log(`Provisioned ${(manifest.agents||[]).length} agent(s) and ${(manifest.skills||[]).length} skill(s) to ${root}.`);
 console.log(`Allowed model references: ${(manifest.models||[]).length}; no OpenCode model credentials/settings were changed.`);
 console.log('MCP tools are not provisioned by this API version.');
}
function check(cmd,args=['--version']) {const r=spawnSync(cmd,args,{encoding:'utf8',timeout:15000});return !r.error&&r.status===0?((r.stdout||r.stderr).trim().split('\n')[0]||'available'):'not found';}
function installMatrixx(){if(check('bun')==='not found')throw Error('Bun is missing. Install Bun 1.4+ before --install-matrixx.');if(check('opencode')==='not found')throw Error('OpenCode is missing. Install OpenCode before --install-matrixx.');console.log('Running upstream installer: bunx opencode-matrixx install');const r=spawnSync('bunx',['opencode-matrixx','install'],{stdio:'inherit',timeout:180000});if(r.error||r.status!==0)throw Error('Upstream Matrixx installer failed.');}
async function provision(ctx,first) {const org=await chooseOrganization(ctx);const manifest=await get(ctx,`/api/agentic/provisioning?organizationId=${encodeURIComponent(org.id)}`);if(String(manifest.organization.id)!==org.id)throw Error('Provisioning organization mismatch');
 if(has('--install-matrixx'))installMatrixx();else if(first)console.log('Matrixx installer skipped. To install via upstream package add --install-matrixx (requires OpenCode & Bun).');
 apply(ctx,manifest,{orgId:org.id});console.log(`Organization: ${org.name}.`);
}
async function init(ctx){await provision(ctx,true)}
async function sync(ctx){await provision(ctx,false)}
async function doctor(ctx){const file=path.join(ctx.ROOT,'provisioning-state.json');const state=readJson(file,{});console.log('API:',ctx.API_BASE);console.log('Session:',fs.existsSync(ctx.SESSION)?'present':'missing');console.log('OpenCode:',check('opencode'));console.log('Bun:',check('bun'));console.log('Managed agent files:',Object.keys(state.files||{}).length);console.log('OpenCode directory:',configDir());for(const [rel,digest] of Object.entries(state.files||{})){const f=within(configDir(),rel);if(!fs.existsSync(f)||hash(fs.readFileSync(f))!==digest)console.log('Drift:',f);}if(fs.existsSync(ctx.SESSION)){try{const x=await get(ctx,'/api/agentic/organizations');console.log('Backend: connected; memberships:',x.organizations?.length||0);}catch(e){console.log('Backend:',e.message)}}console.log('Note: doctor does not validate Matrixx runtime or provider credentials.');}

async function main() {
  const command = process.argv[2];
  if (command === '--version' || command === '-v' || command === 'version') { console.log(`ariadne ${process.env.ARIADNE_CLI_VERSION || '0.1.0-dev'}`); return; }
  if (command === '--help' || command === '-h' || command === 'help') { console.log('Usage: ariadne <login|logout|whoami|init|sync|doctor> [--organization ID] [--install-matrixx]'); return; }
  if (command === 'login') return login();
  if (command === 'init') return init({ API_BASE, ROOT, SESSION });
  if (command === 'sync') return sync({ API_BASE, ROOT, SESSION });
  if (command === 'doctor') return doctor({ API_BASE, ROOT, SESSION });
  if (command === 'logout') { try { fs.unlinkSync(SESSION); } catch (e) { if (e.code !== 'ENOENT') throw e; } console.log('Local session deleted.'); return; }
  if (command === 'whoami') {
    if (!fs.existsSync(SESSION)) throw new Error('Not logged in. Run login.');
    const session = JSON.parse(fs.readFileSync(SESSION, 'utf8'));
    const res = await fetch(`${API_BASE}/api/agentic/organizations`, { headers: { Authorization: `Bearer ${session.token}` }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`Session invalid or backend error (HTTP ${res.status}). Run login again.`);
    console.log(JSON.stringify({ email: session.email, organizations: (await res.json()).organizations }, null, 2)); return;
  }
  console.log('Usage: ariadne <login|whoami|logout|init|sync|doctor> [--organization ID] [--install-matrixx]');
}
main().catch(error => { console.error(`Error: ${error.message}`); process.exitCode = 1; });