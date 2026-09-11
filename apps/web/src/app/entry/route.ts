import { randomBytes } from 'node:crypto';
export async function GET() {
  const nonce = randomBytes(16).toString('base64');
  // A URL fragment is never sent to the server or in a Referer header.
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>وصول خاص</title><style nonce="${nonce}">body{font-family:'Sakkal Majalla',Arial,sans-serif;background:#f3f6fb;min-height:90vh;display:grid;place-items:center;color:#182433}main{background:white;padding:40px;border-radius:16px;text-align:center;max-width:480px;margin:20px}h1{font-size:28px}p{font-size:20px;line-height:1.8}</style></head><body><main><h1>وصول خاص</h1><p id="message" role="status">جارٍ التحقق من رابط الوصول…</p></main><script nonce="${nonce}">const token=location.hash.slice(1);history.replaceState(null,'','/entry');if(!/^[A-Za-z0-9_-]{43}$/.test(token)){document.getElementById('message').textContent='يلزم استخدام رابط الوصول الخاص.';}else{fetch('/api/access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})}).then(r=>{if(!r.ok)throw Error();location.replace('/login');}).catch(()=>{document.getElementById('message').textContent='رابط الوصول غير صالح أو تعذر الاتصال. استخدم الرابط المرسل إليك.';});}</script></body></html>`;
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html;charset=utf-8',
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'`,
    },
  });
}
