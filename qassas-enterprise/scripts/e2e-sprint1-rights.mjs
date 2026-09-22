import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import pg from "pg";
const { Pool } = pg;

const API=process.env.QASSAS_API_URL??"http://127.0.0.1:3001/api/v1";
const KC=process.env.KEYCLOAK_BASE_URL??"http://127.0.0.1:8080";
const REALM="qassas-pilot";
const RUN=process.env.GITHUB_RUN_ID??randomUUID();
const U={
  dir:["22222222-2222-4222-8222-222222222222","exploration_director","Exploration","Director","exploration.director@qassas.local"],
  adm:["33333333-3333-4333-8333-333333333333","system_admin","System","Administrator","system.admin@qassas.local"],
  par:["44444444-4444-4444-8444-444444444444","partner_user","Pilot","Partner","partner.user@qassas.local"]
};

async function form(url,v){
  const r=await fetch(url,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams(v)});
  const b=await r.json(); if(!r.ok) throw new Error(JSON.stringify(b)); return b.access_token;
}
async function prep(admin,u,pw){
  const [id,username,firstName,lastName,email]=u;
  let r=await fetch(`${KC}/admin/realms/${REALM}/users/${id}`,{method:"PUT",headers:{authorization:`Bearer ${admin}`,"content-type":"application/json"},body:JSON.stringify({username,enabled:true,emailVerified:true,requiredActions:[],firstName,lastName,email})});
  assert.equal(r.status,204);
  r=await fetch(`${KC}/admin/realms/${REALM}/users/${id}/reset-password`,{method:"PUT",headers:{authorization:`Bearer ${admin}`,"content-type":"application/json"},body:JSON.stringify({type:"password",value:pw,temporary:false})});
  assert.equal(r.status,204);
}
async function token(username,pw){
  return form(`${KC}/realms/${REALM}/protocol/openid-connect/token`,{client_id:"qassas-cli",grant_type:"password",username,password:pw});
}
async function req(tok,method,path,body,key,ifMatch){
  const headers={authorization:`Bearer ${tok}`};
  if(body!==undefined) headers["content-type"]="application/json";
  if(key){headers["x-qassas-idempotency-key"]=key;headers["x-qassas-correlation-id"]=`CORR-RIGHTS-${RUN}`;}
  if(ifMatch) headers["if-match"]=String(ifMatch);
  const r=await fetch(`${API}${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  const t=await r.text(); let b=null; try{b=t?JSON.parse(t):null}catch{b=t}
  return {r,b};
}
function plusDays(n){const d=new Date();d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function db(){return process.env.DATABASE_URL?{connectionString:process.env.DATABASE_URL}:{host:process.env.QASSAS_DB_HOST??"127.0.0.1",port:Number(process.env.QASSAS_DB_PORT??5432),database:process.env.QASSAS_DB_NAME??"qassas",user:process.env.QASSAS_DB_USER??"qassas",password:process.env.QASSAS_DB_PASSWORD??""};}

const admin=await form(`${KC}/realms/master/protocol/openid-connect/token`,{client_id:"admin-cli",grant_type:"password",username:process.env.KEYCLOAK_ADMIN??"admin",password:process.env.KEYCLOAK_ADMIN_PASSWORD??"change-me"});
const pw=`rights-${randomBytes(12).toString("hex")}`;
for(const u of Object.values(U)) await prep(admin,u,pw);
const [dir,adm,par]=await Promise.all([token(U.dir[1],pw),token(U.adm[1],pw),token(U.par[1],pw)]);

const lic=await req(dir,"POST","/rights/licences",{licence_id:"LIC-AHN-001",licence_number:`SYN-AHN-${RUN}`,licence_type:"EXPLORATION",licence_status:"ACTIVE",validation_status:"VALIDATED",source_instrument:"RIGHTS_E2E"},`LIC-${RUN}`);
assert.ok([200,201].includes(lic.r.status));

for(const [k,b] of [
 ["holder",{party_name:"Synthetic JV Vehicle",role_type:"LEGAL_HOLDER"}],
 ["operator",{party_name:"GMCO Synthetic Operator",role_type:"OPERATOR"}],
 ["partner",{party_name:"Hancock Synthetic Partner",role_type:"JV_PARTNER",economic_interest_percentage:50}]
]) {
  const x=await req(dir,"POST","/rights/licences/LIC-AHN-001/party-roles",b,`ROLE-${k}-${RUN}`);
  assert.ok([200,201].includes(x.r.status));
}

const c=await req(dir,"POST","/rights/licences/LIC-AHN-001/jv-constraints",{jv_id:"JV-AHN-001",decision_class:"MULTI_TARGET_PORTFOLIO",partner_name:"Hancock Synthetic Partner",reserved_matter:"Exploration programme approval",consent_required:true,voting_threshold:"UNANIMOUS"},`JVC-${RUN}`);
assert.ok([200,201].includes(c.r.status)); const cid=c.b.constraint_id;

const w=await req(dir,"POST","/rights/licences/LIC-AHN-001/work-commitments",{description:"Synthetic mandatory work programme",due_date:plusDays(60),mandatory:true,cost_class:"C2",status:"OPEN"},`WCM-${RUN}`);
assert.ok([200,201].includes(w.r.status)); const wid=w.b.commitment_id;

assert.equal((await req(adm,"GET","/rights/licences/LIC-AHN-001?jv_id=JV-AHN-001")).r.status,404);
assert.equal((await req(par,"GET","/rights/licences/LIC-ABUSALAL-001?jv_id=JV-AHN-001")).r.status,404);
assert.equal((await req(par,"GET","/rights/licences/LIC-AHN-001?jv_id=JV-AHN-001")).r.status,200);

const pool=new Pool(db());
const sid=`EVS-AHN-${RUN}`, did=`DEC-AHN-${RUN}`;
await pool.query("INSERT INTO qassas_core.evidence_snapshot(snapshot_id,target_id,snapshot_status,created_by_user_id) VALUES($1,'TGT-AHN-PORT-001','LOCKED','USR-EXP-001')",[sid]);
await pool.query("INSERT INTO qassas_core.decision_object(decision_id,target_id,decision_class,decision_question,current_gate,trigger_type,state,evidence_snapshot_id,created_by_user_id) VALUES($1,'TGT-AHN-PORT-001','MULTI_TARGET_PORTFOLIO','Which target subset may proceed under JV governance?','G2_TARGET_GENERATED','RIGHTS_E2E','DECISION_READY',$2,'USR-EXP-001')",[did,sid]);

let a=await req(dir,"POST",`/decisions/${did}/constraint-assessments`,undefined,`A1-${RUN}`,1);
assert.equal(a.b.state,"PARTNER_APPROVAL_REQUIRED"); assert.equal(a.b.partner_approval_required,true); assert.equal(a.b.execution_allowed,false);

const consent=await req(par,"POST",`/rights/jv-constraints/${cid}/consents`,{consent_status:"APPROVED",effective_until:new Date(Date.now()+180*86400000).toISOString(),rationale:"Synthetic JV partner approval."},`CONS-${RUN}`);
assert.ok([200,201].includes(consent.r.status));

a=await req(dir,"POST",`/decisions/${did}/constraint-assessments`,undefined,`A2-${RUN}`,2);
assert.equal(a.b.state,"DECISION_READY"); assert.equal(a.b.partner_consent_status,"APPROVED"); assert.equal(a.b.execution_allowed,true); assert.equal(a.b.work_commitment_risk,"WC-2_90D"); assert.equal(a.b.portfolio_optimisation_allowed,false);

const sat=await req(dir,"POST",`/rights/work-commitments/${wid}/status`,{status:"SATISFIED",rationale:"Synthetic completion."},`SAT-${RUN}`,1);
assert.ok([200,201].includes(sat.r.status));

a=await req(dir,"POST",`/decisions/${did}/constraint-assessments`,undefined,`A3-${RUN}`,3);
assert.equal(a.b.state,"DECISION_READY"); assert.equal(a.b.work_commitment_risk,"NONE"); assert.equal(a.b.portfolio_optimisation_allowed,true);

await new Promise(r=>setTimeout(r,1200));
const pending=await pool.query("SELECT count(*)::int AS count FROM qassas_outbox.outbox_event WHERE correlation_id=$1 AND published_at IS NULL",[`CORR-RIGHTS-${RUN}`]);
assert.equal(Number(pending.rows[0].count),0);
await pool.end();

console.log("E2E-S1-RIGHTS-001 PASS",{licenceId:"LIC-AHN-001",constraintId:cid,commitmentId:wid,decisionId:did});
