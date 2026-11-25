import { createHash, createHmac, randomBytes } from 'node:crypto';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INTERESTS = new Set(['','Lab or pilot facility','Material scientist','Advisor or mentor','Potential partner','Just curious','Other']);
const FIELDS = new Set(['submission_id','name','email','company','interest','message','updates','_honey','captcha_token']);
export function validate(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).some(k=>!FIELDS.has(k))) return null;
  if (typeof raw.updates !== 'boolean' || !UUID.test(raw.submission_id || '')) return null;
  const out = { submission_id:raw.submission_id.toLowerCase(), updates:raw.updates };
  for (const [key,max,required] of [['name',100,true],['email',254,true],['company',200,false],['interest',100,false],['message',5000,false],['_honey',200,false],['captcha_token',2048,true]]) {
    if (raw[key] !== undefined && typeof raw[key] !== 'string') return null;
    const v = (raw[key] || '').trim();
    if (v.length>max || (required && !v) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v)) return null;
    out[key]=v;
  }
  out.email=out.email.toLowerCase();
  if (!EMAIL.test(out.email) || /[\r\n]/.test(out.email+out.name+out.company) || !INTERESTS.has(out.interest)) return null;
  return out;
}

export function confirmEmailText(link) {
  return 'Hi, You asked for updates from PaperFumed. Please confirm this email address by opening this link: ' + link + ' Once confirmed, we will email you when there is something new. If you did not sign up, just ignore this email and nothing more will be sent. To be removed at any time, email paperfumed.ocea23@gmail.com';
}
export function confirmEmailHtml(link) {
  const esc=link.replace(/&/g,'&amp;').replace(/"/g,'&quot;');
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>'
    + '<body style="margin:0;padding:0;background-color:#0d1410;">'
    + '<div style="display:none;max-height:0;overflow:hidden;">Confirm your email for PaperFumed updates.</div>'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0d1410;"><tr><td align="center" style="padding:24px 12px;">'
    + '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background-color:#14201A;background-image:linear-gradient(165deg,#14201A 0%,#2C3826 78%,#22301f 100%);border-radius:8px;">'
    + '<tr><td align="center" style="padding:44px 40px 6px;color:#F4F0E6;font-family:Montserrat,Arial,sans-serif;font-size:13px;letter-spacing:5px;text-transform:uppercase;font-weight:600;">PaperFumed</td></tr>'
    + '<tr><td align="center" style="padding:18px 40px 0;"><img src="https://paperfumed.vercel.app/assets/island-bottle-800.webp" width="230" height="199" alt="A small floating island with a paper bottle on it" style="display:block;border:0;border-radius:6px;"></td></tr>'
    + '<tr><td align="center" style="padding:26px 40px 0;color:#F4F0E6;font-family:Montserrat,Arial,sans-serif;font-size:30px;line-height:1.25;font-weight:800;text-transform:uppercase;letter-spacing:1px;">Confirm<br>your <span style="font-family:Georgia,serif;font-style:italic;font-weight:600;color:#A9714B;text-transform:none;">email</span><br>for PaperFumed updates</td></tr>'
    + '<tr><td align="center" style="padding:26px 56px 0;color:rgba(244,240,230,.8);font-family:Montserrat,Arial,sans-serif;font-size:15px;line-height:1.65;">Hi, You asked for updates from PaperFumed. Please confirm this email address by clicking the button below. Once confirmed, we will email you when there is something new. If you did not sign up, just ignore this email and nothing more will be sent.</td></tr>'
    + '<tr><td align="center" style="padding:34px 40px 8px;"><a href="' + esc + '" style="display:inline-block;background-color:#A9714B;color:#FBF8F0;font-family:Montserrat,Arial,sans-serif;font-weight:800;font-size:15px;letter-spacing:.6px;text-decoration:none;padding:15px 42px;border-radius:999px;">Confirm my email</a></td></tr>'
    + '<tr><td align="center" style="padding:30px 40px 44px;color:rgba(244,240,230,.45);font-family:Montserrat,Arial,sans-serif;font-size:11.5px;">To be removed at any time, email <a href="mailto:paperfumed.ocea23@gmail.com" style="color:rgba(244,240,230,.65);">paperfumed.ocea23@gmail.com</a></td></tr>'
    + '</table></td></tr></table></body></html>';
}
export function payloadHash(v) {
  return createHash('sha256').update(JSON.stringify([v.name,v.email,v.company,v.interest,v.message,v.updates])).digest('hex');
}
export function makeHandler({ env=process.env, fetcher=fetch }={}) {
  async function upstream(url, init={}) {
    return fetcher(url,{...init,signal:AbortSignal.timeout(7000)});
  }
  return async function handler(req,res) {
    const reply=(code,body)=>{res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');return res.status(code).json(body);};
    if(req.method!=='POST'){res.setHeader('Allow','POST');return reply(405,{error:'method_not_allowed'});}
    const origins=(env.CONTACT_ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
    const origin=req.headers.origin;
    if(!origin || !origins.includes(origin)) return reply(403,{error:'origin_denied'});
    if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json')) return reply(415,{error:'json_required'});
    if(Number(req.headers['content-length']||0)>12000) return reply(413,{error:'too_large'});
    let raw;
    try { raw=typeof req.body==='string'?JSON.parse(req.body):req.body; if(Buffer.byteLength(JSON.stringify(raw)||'')>12000) return reply(413,{error:'too_large'}); }
    catch {return reply(400,{error:'invalid_json'});}
    const v=validate(raw);
    if(!v) return reply(400,{error:'invalid_fields'});
    if(v._honey) return reply(200,{status:'received',submission_id:v.submission_id});
    const required=['SUPABASE_URL','SUPABASE_SERVER_KEY','TURNSTILE_SECRET_KEY','CONTACT_IP_HASH_SECRET','TURNSTILE_ALLOWED_HOSTNAMES'];
    if(required.some(k=>!env[k])) return reply(503,{error:'temporarily_unavailable',fallback_available:true});
    let sb;
    try {sb=new URL(env.SUPABASE_URL);if(sb.protocol!=='https:'||!sb.hostname.endsWith('.supabase.co')) throw 0;} catch{return reply(503,{error:'temporarily_unavailable'});}
    const headers={'Content-Type':'application/json',apikey:env.SUPABASE_SERVER_KEY};
    if(env.SUPABASE_SERVER_KEY.startsWith('eyJ')) headers.Authorization='Bearer '+env.SUPABASE_SERVER_KEY;
    const db=(path,init={})=>upstream(sb.origin+'/rest/v1/'+path,{...init,headers:{...headers,...init.headers}});
    const digest=payloadHash(v);
    // Random request ID plus full payload hash permits a safe retry before
    // re-consuming a single-use CAPTCHA. No personal data is returned.
    try {
      const found=await db('contact_requests?submission_id=eq.'+v.submission_id+'&select=payload_hash,notification_state');
      if(!found.ok) throw 0;
      const rows=await found.json();
      if(rows.length){
        if(rows[0].payload_hash!==digest) return reply(409,{error:'request_changed_use_new_id'});
        return reply(200,{status:'stored',notification:rows[0].notification_state,updates:v.updates?'pending':'not_requested',submission_id:v.submission_id});
      }
    } catch {return reply(503,{error:'storage_unconfirmed',fallback_available:true,submission_id:v.submission_id});}
    let challenge;
    try {
      const checked=await upstream('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:env.TURNSTILE_SECRET_KEY,response:v.captcha_token,idempotency_key:v.submission_id})});
      if(!checked.ok) throw 0; challenge=await checked.json();
    } catch {return reply(503,{error:'spam_check_unavailable'});}
    const hosts=env.TURNSTILE_ALLOWED_HOSTNAMES.split(',').map(s=>s.trim());
    if(challenge.success!==true || !hosts.includes(challenge.hostname) || challenge.action!=='contact') return reply(422,{error:'spam_check_failed'});
    // Vercel sets this protected header. Do not trust a client x-forwarded-for.
    const ip=String(req.headers['x-vercel-forwarded-for']||'').split(',')[0].trim();
    if(!ip) return reply(503,{error:'spam_check_unavailable'});
    const ipHash=createHmac('sha256',env.CONTACT_IP_HASH_SECRET).update(ip).digest('hex');
    let accepted;
    try {
      const stored=await db('rpc/accept_contact',{method:'POST',body:JSON.stringify({p_submission_id:v.submission_id,p_payload_hash:digest,p_name:v.name,p_email:v.email,p_message:v.message,p_updates:v.updates,p_ip_hash:ipHash,p_company:v.company,p_interest:v.interest})});
      if(!stored.ok) throw 0; accepted=await stored.json();
    } catch {return reply(503,{error:'storage_unconfirmed',fallback_available:true,submission_id:v.submission_id});}
    if(accepted.outcome==='rate_limited'){res.setHeader('Retry-After','3600');return reply(429,{error:'too_many_requests'});}
    if(accepted.outcome==='conflict') return reply(409,{error:'request_changed_use_new_id'});
    if(!['created','duplicate'].includes(accepted.outcome)) return reply(503,{error:'storage_unconfirmed'});
    let confirmEmail='not_requested';
    if(v.updates){
      confirmEmail='not_attempted';
      if(env.MAILER_URL && env.MAILER_SECRET){
        // The raw token goes only to the subscriber's inbox; the database
        // keeps its hash. Tokens expire after 24 hours and are single-use.
        try {
          const token=randomBytes(32).toString('hex');
          const tokenHash=createHash('sha256').update(token).digest('hex');
          const expires=new Date(Date.now()+24*3600*1000).toISOString();
          const claim=await db('contact_requests?submission_id=eq.'+v.submission_id+'&confirmed_at=is.null',{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({confirm_token_hash:tokenHash,confirm_token_expires:expires})});
          if(!claim.ok) throw 0;
          if((await claim.json()).length){
            const link='https://paperfumed.vercel.app/api/confirm?id='+v.submission_id+'&token='+token;
            const mail=await upstream(env.MAILER_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:env.MAILER_SECRET,to:v.email,subject:'Confirm your email for PaperFumed updates',body:confirmEmailText(link),html:confirmEmailHtml(link)})});
            const receipt=await mail.json().catch(()=>({}));
            confirmEmail=mail.ok && receipt.ok===true?'sent':'failed';
          } else confirmEmail='already_confirmed';
        } catch {confirmEmail='failed';}
      }
    }
    let notification=accepted.notification;
    if(notification==='not_attempted' && env.CONTACT_INBOX_ENABLED==='true') {
      // Claim once. A crash or unknown email response is never automatically
      // retried, because FormSubmit has no verified idempotency guarantee.
      try {
        const claim=await db('contact_requests?submission_id=eq.'+v.submission_id+'&notification_state=eq.not_attempted',{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({notification_state:'sending'})});
        if(!claim.ok) throw 0;
        if((await claim.json()).length){
          notification='unknown';
          try {
            const mail=await upstream('https://formsubmit.co/ajax/paperfumed.ocea23@gmail.com',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({name:v.name,email:v.email,company:v.company,interest:v.interest,message:v.message,updates_requested:v.updates?'yes, pending confirmation':'no',submission_id:v.submission_id,_subject:'Paperfumed enquiry',_template:'table'})});
            const receipt=await mail.json();
            notification=mail.ok && (receipt.success===true || receipt.success==='true')?'accepted':'failed';
          } catch {notification='unknown';}
          try {await db('contact_requests?submission_id=eq.'+v.submission_id,{method:'PATCH',body:JSON.stringify({notification_state:notification})});}catch{}
        } else notification='sending';
      } catch {notification='not_attempted';}
    }
    return reply(200,{status:'stored',notification,updates:v.updates?'pending':'not_requested',confirmation_email:confirmEmail,submission_id:v.submission_id});
  };
}
export default makeHandler();
