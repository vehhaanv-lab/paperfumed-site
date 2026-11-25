import { createHash, timingSafeEqual } from 'node:crypto';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN = /^[0-9a-f]{64}$/;
export function makeConfirmHandler({ env=process.env, fetcher=fetch }={}) {
  async function upstream(url, init={}) {
    return fetcher(url,{...init,signal:AbortSignal.timeout(7000)});
  }
  return async function handler(req,res) {
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    const go=(loc)=>{res.setHeader('Location',loc);return res.status(303).end();};
    if(req.method!=='GET'&&req.method!=='HEAD'){res.setHeader('Allow','GET, HEAD');return res.status(405).json({error:'method_not_allowed'});}
    const id=String(req.query?.id||'').toLowerCase();
    const token=String(req.query?.token||'');
    if(!UUID.test(id)||!TOKEN.test(token)) return go('/link-expired');
    const {SUPABASE_URL,SUPABASE_SERVER_KEY}=env;
    if(!SUPABASE_URL||!SUPABASE_SERVER_KEY) return go('/link-expired');
    let sb;
    try {sb=new URL(SUPABASE_URL);if(sb.protocol!=='https:'||!sb.hostname.endsWith('.supabase.co')) throw 0;} catch{return go('/link-expired');}
    const headers={'Content-Type':'application/json',apikey:SUPABASE_SERVER_KEY};
    if(SUPABASE_SERVER_KEY.startsWith('eyJ')) headers.Authorization='Bearer '+SUPABASE_SERVER_KEY;
    const db=(path,init={})=>upstream(sb.origin+'/rest/v1/'+path,{...init,headers:{...headers,...init.headers}});
    let rows;
    try {
      const found=await db('contact_requests?submission_id=eq.'+id+'&select=confirm_token_hash,confirm_token_expires,confirmed_at');
      if(!found.ok) throw 0;
      rows=await found.json();
    } catch {return go('/link-expired');}
    const row=rows&&rows[0];
    if(!row||row.confirmed_at||!row.confirm_token_hash||!row.confirm_token_expires) return go('/link-expired');
    if(new Date(row.confirm_token_expires).getTime()<Date.now()) return go('/link-expired');
    const given=Buffer.from(createHash('sha256').update(token).digest('hex'),'utf8');
    const stored=Buffer.from(String(row.confirm_token_hash),'utf8');
    if(given.length!==stored.length||!timingSafeEqual(given,stored)) return go('/link-expired');
    // Single-use: claim only while still unconfirmed. A lost race means the
    // link was already used, which the expired page copy covers.
    try {
      const claim=await db('contact_requests?submission_id=eq.'+id+'&confirmed_at=is.null',{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({confirmed_at:new Date().toISOString()})});
      if(!claim.ok) throw 0;
      const claimed=await claim.json();
      if(!claimed.length) return go('/link-expired');
    } catch {return go('/link-expired');}
    return go('/confirmed');
  };
}
export default makeConfirmHandler();
