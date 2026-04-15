// Self-contained HTML for the /admin panel and /admin/login form.
// Served as-is; the panel's own JS calls /admin/api/* (same origin).

const LOGIN_HTML = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Quizzy · Admin login</title>
<style>
  :root{color-scheme:light dark}
  body{font:15px/1.5 system-ui,sans-serif;max-width:360px;margin:10vh auto;padding:24px}
  h1{font-size:20px;margin:0 0 16px}
  form{display:flex;flex-direction:column;gap:10px}
  input{font:inherit;padding:10px 12px;border:1px solid #8884;border-radius:8px;background:transparent;color:inherit}
  button{font:inherit;padding:10px 14px;border:0;border-radius:8px;background:#185fa5;color:#fff;cursor:pointer}
  button:hover{background:#0c447c}
  .err{color:#b00020;font-size:13px;margin-top:8px}
</style>
</head><body>
<h1>Quizzy · Admin</h1>
<form method="post" action="/admin/login">
  <input type="password" name="password" placeholder="Admin password" autofocus required autocomplete="current-password">
  <button type="submit">Sign in</button>
</form>
{{ERR}}
</body></html>`;

export function loginPageHtml(errMessage) {
    const err = errMessage
        ? `<p class="err">${errMessage.replace(/</g, '&lt;')}</p>`
        : '';
    return LOGIN_HTML.replace('{{ERR}}', err);
}

export const PANEL_HTML = String.raw`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Quizzy · Admin</title>
<style>
  :root{
    color-scheme:light dark;
    --bg:#f7f5ef;--surface:#fff;--border:#0002;--muted:#5f5e5a;--text:#1a1a1a;
    --accent:#185fa5;--accent-fg:#fff;--danger:#a32d2d;--warn:#854f0b;--ok:#3b6d11;
    --hidden-bg:#faeeda;--spam-bg:#fcebeb;
  }
  @media (prefers-color-scheme:dark){
    :root{--bg:#12141a;--surface:#1b1e26;--border:#fff2;--muted:#9aa0a8;--text:#e8e6e0;
      --accent:#5aa3e8;--danger:#e27878;--warn:#e0b060;--ok:#8bc268;
      --hidden-bg:#3a2f1a;--spam-bg:#3a1f1f;}
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--text);font:14px/1.5 system-ui,sans-serif}
  header{display:flex;gap:12px;align-items:center;padding:12px 20px;border-bottom:1px solid var(--border);background:var(--surface);position:sticky;top:0;z-index:5}
  header h1{font-size:16px;margin:0;font-weight:600}
  header .sp{flex:1}
  main{max-width:1200px;margin:0 auto;padding:16px 20px 60px}
  .toolbar{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 16px;align-items:center}
  .pill{padding:6px 12px;border:1px solid var(--border);border-radius:999px;background:var(--surface);cursor:pointer;font:inherit;color:inherit}
  .pill.active{background:var(--accent);color:var(--accent-fg);border-color:var(--accent)}
  input[type=search],input[type=text]{font:inherit;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:inherit;min-width:240px}
  button{font:inherit;padding:6px 12px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:inherit;cursor:pointer}
  button:hover{background:#8881}
  button.primary{background:var(--accent);color:var(--accent-fg);border-color:var(--accent)}
  button.danger{color:var(--danger);border-color:#a32d2d44}
  button.warn{color:var(--warn);border-color:#854f0b44}
  table{width:100%;border-collapse:collapse}
  th,td{padding:10px 10px;text-align:left;border-bottom:1px solid var(--border);vertical-align:top}
  th{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;font-weight:600;position:sticky;top:49px;background:var(--bg);z-index:3}
  tr.row{cursor:pointer}
  tr.row:hover td{background:#8881}
  tr.row.s-hidden td{background:var(--hidden-bg)}
  tr.row.s-spam td{background:var(--spam-bg)}
  .kind{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;background:#8882}
  .kind.flag{background:#a32d2d22;color:var(--danger)}
  .kind.comment{background:#185fa522;color:var(--accent)}
  .meta{font-size:12px;color:var(--muted)}
  .body{max-width:420px;white-space:pre-wrap;word-break:break-word}
  .ip{font-family:ui-monospace,Menlo,monospace;font-size:12px;color:var(--muted)}
  .row-detail{background:#8881;padding:14px 16px}
  .row-detail pre{margin:0;white-space:pre-wrap;word-break:break-word;font:13px/1.5 ui-monospace,Menlo,monospace;background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:10px}
  .row-detail .option.correct{color:var(--ok);font-weight:600}
  .actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
  .toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--text);color:var(--bg);padding:10px 16px;border-radius:8px;font-size:13px;opacity:0;transition:opacity .2s}
  .toast.show{opacity:1}
  .empty{padding:40px 20px;text-align:center;color:var(--muted)}
  @media (max-width:640px){
    .body{max-width:none}
    th.hide-sm,td.hide-sm{display:none}
  }
</style>
</head><body>
<header>
  <h1>Quizzy · Admin</h1>
  <span class="sp"></span>
  <span id="stats-summary" class="meta"></span>
  <form method="post" action="/admin/logout" style="margin:0">
    <button type="submit">Sign out</button>
  </form>
</header>
<main>
  <div class="toolbar">
    <button class="pill active" data-status="all">All <span data-count="all">0</span></button>
    <button class="pill" data-status="published">Published <span data-count="published">0</span></button>
    <button class="pill" data-status="hidden">Hidden <span data-count="hidden">0</span></button>
    <button class="pill" data-status="spam">Spam <span data-count="spam">0</span></button>
    <span style="width:12px"></span>
    <button class="pill kind-pill active" data-kind="all">All kinds</button>
    <button class="pill kind-pill" data-kind="comment">Comments</button>
    <button class="pill kind-pill" data-kind="flag">Flags</button>
    <span style="flex:1"></span>
    <input type="search" id="q" placeholder="Search text, question, nickname…">
    <button id="refresh">Refresh</button>
  </div>
  <div id="result"></div>
</main>
<div class="toast" id="toast"></div>
<script>
(function(){
  'use strict';
  let state = { status:'all', kind:'all', q:'', offset:0, limit:100, expanded:new Set() };

  const $ = (s,el=document)=>el.querySelector(s);
  const $$ = (s,el=document)=>Array.from(el.querySelectorAll(s));
  const esc = (s)=>String(s==null?'':s).replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDate = (ts)=> new Date(ts*1000).toLocaleString();

  function toast(msg){
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(()=>t.classList.remove('show'), 2000);
  }

  async function api(path, opts){
    const resp = await fetch(path, { credentials:'same-origin', ...opts });
    if (resp.status === 401) {
      location.href = '/admin/login';
      throw new Error('unauth');
    }
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error('HTTP '+resp.status+': '+body);
    }
    return resp.json();
  }

  async function load(){
    const p = new URLSearchParams({
      status: state.status, kind: state.kind, offset: state.offset, limit: state.limit
    });
    if (state.q) p.set('q', state.q);
    const data = await api('/admin/api/comments?'+p.toString());
    render(data);
  }

  function render(data){
    const s = data.stats;
    $('[data-count="all"]').textContent = s.all;
    $('[data-count="published"]').textContent = s.published;
    $('[data-count="hidden"]').textContent = s.hidden;
    $('[data-count="spam"]').textContent = s.spam;
    $('#stats-summary').textContent = data.total + ' / ' + s.all + ' total';

    if (!data.comments.length) {
      $('#result').innerHTML = '<div class="empty">No comments matching the current filters.</div>';
      return;
    }

    const rows = data.comments.map(c => {
      const expanded = state.expanded.has(c.id);
      return row(c, expanded);
    }).join('');

    $('#result').innerHTML =
      '<table><thead><tr>' +
        '<th>When</th>' +
        '<th>Set · Q</th>' +
        '<th>Kind</th>' +
        '<th>Body / Reason</th>' +
        '<th class="hide-sm">Nickname</th>' +
        '<th class="hide-sm">IP</th>' +
        '<th>Status</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>';

    $$('tr.row').forEach(tr=>{
      tr.addEventListener('click', e=>{
        if (e.target.closest('button')) return;
        const id = Number(tr.dataset.id);
        if (state.expanded.has(id)) state.expanded.delete(id);
        else state.expanded.add(id);
        load();
      });
    });
    $$('button[data-action]').forEach(btn=>{
      btn.addEventListener('click', async e=>{
        e.stopPropagation();
        const id = Number(btn.dataset.id);
        const action = btn.dataset.action;
        await doAction(id, action);
      });
    });
  }

  function row(c, expanded){
    const options = (()=>{ try { return JSON.parse(c.options_json||'[]'); } catch { return []; } })();
    const letters = ['a','b','c','d'];
    const reason = c.flag_reason ? ' · <b>'+esc(c.flag_reason)+'</b>' : '';
    const body = c.body
      ? '<div class="body">'+esc(c.body)+'</div>'
      : '<span class="meta">(no text)</span>';
    const ua = esc(c.user_agent || '');

    let detail = '';
    if (expanded) {
      const optHtml = options.map((o,i)=>{
        const cls = i === c.current_answer ? 'option correct' : 'option';
        return '<div class="'+cls+'">'+letters[i]+') '+esc(o)+(i===c.current_answer?' ✓':'')+'</div>';
      }).join('');
      detail = '<tr><td colspan="7"><div class="row-detail">'+
        '<div class="meta">Question text:</div>'+
        '<pre>'+esc(c.question_text)+'</pre>'+
        '<div class="meta" style="margin-top:10px">Options (✓ marks current correct answer):</div>'+
        '<div style="margin-top:4px">'+optHtml+'</div>'+
        (c.admin_note ? '<div class="meta" style="margin-top:10px">Admin note:</div><pre>'+esc(c.admin_note)+'</pre>' : '')+
        '<div class="meta" style="margin-top:10px">User agent: '+ua+'</div>'+
        '<div class="actions">'+
          (c.status !== 'published' ? '<button data-action="publish" data-id="'+c.id+'">Publish</button>' : '')+
          (c.status !== 'hidden' ? '<button class="warn" data-action="hide" data-id="'+c.id+'">Hide</button>' : '')+
          (c.status !== 'spam' ? '<button class="warn" data-action="spam" data-id="'+c.id+'">Mark spam</button>' : '')+
          '<button class="danger" data-action="delete" data-id="'+c.id+'">Delete</button>'+
        '</div>'+
      '</div></td></tr>';
    }

    const rowHtml =
      '<tr class="row s-'+esc(c.status)+'" data-id="'+c.id+'">'+
        '<td><div class="meta">'+esc(fmtDate(c.created_at))+'</div></td>'+
        '<td><div>'+esc(c.set_id)+'</div><div class="meta">#'+(c.question_idx+1)+'</div></td>'+
        '<td><span class="kind '+esc(c.kind)+'">'+esc(c.kind)+'</span>'+reason+'</td>'+
        '<td>'+body+'</td>'+
        '<td class="hide-sm">'+(c.nickname?esc(c.nickname):'<span class="meta">—</span>')+'</td>'+
        '<td class="hide-sm"><span class="ip">'+esc(c.ip)+'</span></td>'+
        '<td>'+esc(c.status)+'</td>'+
      '</tr>'+ detail;
    return rowHtml;
  }

  async function doAction(id, action){
    if (action === 'delete') {
      if (!confirm('Delete comment #'+id+' permanently?')) return;
      await api('/admin/api/comments/'+id, { method:'DELETE' });
      toast('Deleted');
    } else {
      const map = { publish:'published', hide:'hidden', spam:'spam' };
      await api('/admin/api/comments/'+id+'/status', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ status: map[action] })
      });
      toast(action.charAt(0).toUpperCase()+action.slice(1)+'d');
    }
    await load();
  }

  $$('[data-status]').forEach(b=>b.addEventListener('click',()=>{
    state.status = b.dataset.status;
    $$('[data-status]').forEach(x=>x.classList.toggle('active', x===b));
    state.offset = 0;
    load();
  }));
  $$('.kind-pill').forEach(b=>b.addEventListener('click',()=>{
    state.kind = b.dataset.kind;
    $$('.kind-pill').forEach(x=>x.classList.toggle('active', x===b));
    state.offset = 0;
    load();
  }));
  let qTimer;
  $('#q').addEventListener('input', e=>{
    clearTimeout(qTimer);
    qTimer = setTimeout(()=>{ state.q = e.target.value; state.offset = 0; load(); }, 250);
  });
  $('#refresh').addEventListener('click', load);

  load().catch(err=>{
    $('#result').innerHTML = '<div class="empty">Failed to load: '+esc(err.message)+'</div>';
  });
})();
</script>
</body></html>`;
