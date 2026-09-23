import pg from "pg";
const base=process.env.API_URL??"http://127.0.0.1:4000/api/v1";
async function call(path,options={}){const response=await fetch(`${base}${path}`,options);const body=response.status===204?null:await response.json();if(!response.ok)throw new Error(`${options.method??"GET"} ${path} failed (${response.status}): ${JSON.stringify(body)}`);return body}
const json=(method,body,token)=>({method,headers:{"content-type":"application/json",...(token?{authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});
const client=(await call("/auth/login",json("POST",{email:"samuel.client@example.test",password:"KonetDemo123!"}))).accessToken;
const provider=(await call("/auth/login",json("POST",{email:"aisha.provider@example.test",password:"KonetDemo123!"}))).accessToken;
const [service]=await call("/services?query=photography");
const request=await call("/requests",json("POST",{providerId:service.providerId,serviceId:service.id,description:"E2E graduation portrait request with a clearly defined delivery brief.",budgetMinMinor:1800000,budgetMaxMinor:2500000},client));
const quote=await call("/quotes",json("POST",{requestId:request.id,amountMinor:2200000,scope:["Two-hour session","Fifteen edited photographs"],expiresAt:new Date(Date.now()+86400000).toISOString()},provider));
const job=await call(`/quotes/${quote.id}/accept`,json("POST",null,client));
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL??"postgresql://konet:konet@localhost:5432/konet"});
try{await pool.query("update payments set status='held' where job_id=$1",[job.id]);await pool.query("update jobs set status='scheduled' where id=$1",[job.id])}finally{await pool.end()}
await call(`/jobs/${job.id}/start`,json("POST",null,provider));
await call(`/jobs/${job.id}/mark-complete`,json("POST",null,provider));
await call(`/jobs/${job.id}/confirm-completion`,json("POST",null,client));
await call("/reviews",json("POST",{jobId:job.id,rating:5,comment:"E2E verified review for completed work."},client));
const raceRequest=await call("/requests",json("POST",{providerId:service.providerId,serviceId:service.id,description:"Concurrent quote acceptance test with sufficient detail for request validation.",budgetMinMinor:1000000,budgetMaxMinor:3000000},client));
const raceQuote=await call("/quotes",json("POST",{requestId:raceRequest.id,amountMinor:2000000,scope:["Concurrency test delivery"],expiresAt:new Date(Date.now()+86400000).toISOString()},provider));
const attempts=await Promise.all([fetch(`${base}/quotes/${raceQuote.id}/accept`,json("POST",null,client)),fetch(`${base}/quotes/${raceQuote.id}/accept`,json("POST",null,client))]);
const statuses=attempts.map(response=>response.status).sort();if(statuses[0]!==201||statuses[1]!==409)throw new Error(`Expected one accepted and one conflict response, received ${statuses.join(",")}`);
console.log(JSON.stringify({ok:true,requestId:request.id,quoteId:quote.id,jobId:job.id,concurrentAcceptanceStatuses:statuses,flow:"request -> quote -> atomic acceptance -> held-payment fixture -> completion -> review"}));
