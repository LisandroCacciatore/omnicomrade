/**
 * messages.js
 * TechFitness — Mensajería interna coach-alumno
 */
window.TFMessages = (function () {
  'use strict';

  const db = () => window.supabaseClient;
  const esc = (s) => window.tfUtils?.escHtml(s) ?? String(s ?? '');
  const toast = (m, t) => window.tfUtils?.toast(m, t);

  let gymId = null;
  let currentUser = null;
  let currentPeer = null;
  let badgeEl = null;
  let pollInterval = null;

  async function init({ gymId: gId, user, badgeSelector }) {
    gymId = gId;
    currentUser = user;
    badgeEl = badgeSelector ? document.querySelector(badgeSelector) : null;

    injectDrawerHTML();
    await refreshUnreadBadge();

    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(refreshUnreadBadge, 30000);
  }

  async function openChat(peerId, peerName) {
    if (!peerId) return;
    currentPeer = { id: peerId, full_name: peerName || 'Usuario' };

    const drawer = document.getElementById('tf-messages-drawer');
    const backdrop = document.getElementById('tf-messages-backdrop');
    if (!drawer) return;

    drawer.querySelector('#tf-msg-peer-name').textContent = currentPeer.full_name;
    drawer.classList.add('open');
    backdrop?.classList.add('open');
    await loadMessages();
    drawer.querySelector('#tf-msg-input')?.focus();
  }

  function closeChat() {
    document.getElementById('tf-messages-drawer')?.classList.remove('open');
    document.getElementById('tf-messages-backdrop')?.classList.remove('open');
    currentPeer = null;
  }

  async function loadMessages() {
    if (!currentPeer || !currentUser || !gymId) return;
    const listEl = document.getElementById('tf-msg-list');
    if (!listEl) return;

    listEl.innerHTML = '<div class="skeleton" style="height:42px;border-radius:12px;margin-bottom:8px"></div><div class="skeleton" style="height:42px;border-radius:12px;margin-bottom:8px"></div>';

    const { data: messages, error } = await db()
      .from('gym_messages')
      .select('id, sender_id, recipient_id, content, read_at, created_at')
      .eq('gym_id', gymId)
      .or(
        `and(sender_id.eq.${currentUser.id},recipient_id.eq.${currentPeer.id}),and(sender_id.eq.${currentPeer.id},recipient_id.eq.${currentUser.id})`
      )
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      listEl.innerHTML = '<p style="color:#EF4444;padding:20px;text-align:center">Error al cargar mensajes</p>';
      return;
    }

    const unreadIds = (messages || [])
      .filter((m) => m.recipient_id === currentUser.id && !m.read_at)
      .map((m) => m.id);

    if (unreadIds.length) {
      await db().from('gym_messages').update({ read_at: new Date().toISOString() }).in('id', unreadIds);
      await refreshUnreadBadge();
    }

    renderMessages(messages || []);
  }

  function renderMessages(messages) {
    const listEl = document.getElementById('tf-msg-list');
    if (!listEl) return;

    if (!messages.length) {
      listEl.innerHTML = '<div style="padding:32px;text-align:center;color:#64748B">Todavía no hay mensajes.</div>';
      return;
    }

    listEl.innerHTML = messages
      .map((msg) => {
        const isMine = msg.sender_id === currentUser.id;
        const time = new Date(msg.created_at).toLocaleTimeString('es-AR', {
          hour: '2-digit',
          minute: '2-digit'
        });
        return `<div class="tf-msg-bubble ${isMine ? 'mine' : 'theirs'}"><div class="tf-msg-content">${esc(msg.content)}</div><span class="tf-msg-time">${time}${isMine && msg.read_at ? ' ✓✓' : ''}</span></div>`;
      })
      .join('');

    listEl.scrollTop = listEl.scrollHeight;
  }

  async function sendMessage() {
    const input = document.getElementById('tf-msg-input');
    const sendBtn = document.getElementById('tf-msg-send-btn');
    const content = input?.value?.trim();
    if (!content || !currentPeer || !gymId) return;

    if (sendBtn) sendBtn.disabled = true;
    input.value = '';

    const { error } = await db().from('gym_messages').insert({
      gym_id: gymId,
      sender_id: currentUser.id,
      recipient_id: currentPeer.id,
      content
    });

    if (error) {
      toast('Error al enviar mensaje', 'error');
      input.value = content;
    } else {
      await loadMessages();
    }

    if (sendBtn) sendBtn.disabled = false;
    input?.focus();
  }

  async function refreshUnreadBadge() {
    if (!currentUser || !gymId) return;

    const { count } = await db()
      .from('gym_messages')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', currentUser.id)
      .eq('gym_id', gymId)
      .is('read_at', null);

    const unread = count || 0;
    if (badgeEl) {
      badgeEl.textContent = unread > 9 ? '9+' : String(unread);
      badgeEl.style.display = unread > 0 ? 'flex' : 'none';
    }
  }

  async function getConversations() {
    const { data, error } = await db()
      .from('gym_messages')
      .select('id, sender_id, recipient_id, content, read_at, created_at')
      .eq('gym_id', gymId)
      .or(`sender_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error || !data) return [];
    const peers = new Map();
    data.forEach((msg) => {
      const peerId = msg.sender_id === currentUser.id ? msg.recipient_id : msg.sender_id;
      if (!peers.has(peerId)) {
        peers.set(peerId, {
          peerId,
          peerName: 'Usuario',
          lastMsg: msg.content,
          lastAt: msg.created_at,
          unread: msg.recipient_id === currentUser.id && !msg.read_at
        });
      }
    });
    return Array.from(peers.values());
  }

  function injectDrawerHTML() {
    if (document.getElementById('tf-messages-drawer')) return;

    const backdrop = document.createElement('div');
    backdrop.id = 'tf-messages-backdrop';
    backdrop.style.cssText = 'position:fixed;inset:0;z-index:60;background:rgba(7,11,16,.6);backdrop-filter:blur(4px);opacity:0;pointer-events:none;transition:opacity .25s';
    backdrop.addEventListener('click', closeChat);
    document.body.appendChild(backdrop);

    const drawer = document.createElement('div');
    drawer.id = 'tf-messages-drawer';
    drawer.innerHTML = `
      <div class="tf-msg-header">
        <div><p class="tf-msg-peer-label">Conversación con</p><h3 id="tf-msg-peer-name" class="tf-msg-peer-title">—</h3></div>
        <button id="tf-msg-close-btn" aria-label="Cerrar mensajes"><span class="material-symbols-rounded">close</span></button>
      </div>
      <div id="tf-msg-list" class="tf-msg-list"></div>
      <div class="tf-msg-footer">
        <input id="tf-msg-input" type="text" placeholder="Escribí un mensaje..." autocomplete="off" maxlength="1000" />
        <button id="tf-msg-send-btn" type="button"><span class="material-symbols-rounded">send</span></button>
      </div>`;
    document.body.appendChild(drawer);

    const style = document.createElement('style');
    style.textContent = `
      #tf-messages-backdrop.open{opacity:1;pointer-events:all}
      #tf-messages-drawer{position:fixed;top:0;right:0;bottom:0;width:380px;max-width:100vw;z-index:61;background:#161E26;border-left:1px solid #1E293B;display:flex;flex-direction:column;transform:translateX(100%);transition:transform .3s cubic-bezier(.16,1,.3,1);font-family:'Space Grotesk',sans-serif}
      #tf-messages-drawer.open{transform:translateX(0)}
      .tf-msg-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #1E293B;flex-shrink:0}
      .tf-msg-peer-label{font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.08em;margin:0}
      .tf-msg-peer-title{font-size:16px;font-weight:800;color:#E2E8F0;margin:4px 0 0}
      #tf-msg-close-btn{width:36px;height:36px;border-radius:10px;border:1px solid #1E293B;background:transparent;color:#64748B;cursor:pointer;display:flex;align-items:center;justify-content:center}
      .tf-msg-list{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:8px}
      .tf-msg-bubble{max-width:80%;padding:10px 14px;border-radius:16px;font-size:13px;line-height:1.5}
      .tf-msg-bubble.mine{align-self:flex-end;background:#3B82F6;border-bottom-right-radius:4px;color:#fff}
      .tf-msg-bubble.theirs{align-self:flex-start;background:#1E293B;border-bottom-left-radius:4px;color:#E2E8F0}
      .tf-msg-time{display:block;font-size:10px;opacity:.6;margin-top:4px;text-align:right}
      .tf-msg-footer{display:flex;gap:8px;padding:12px 16px;border-top:1px solid #1E293B;flex-shrink:0}
      #tf-msg-input{flex:1;background:#0B1218;border:1px solid #1E293B;border-radius:12px;padding:10px 16px;color:#E2E8F0;font-size:14px;outline:none}
      #tf-msg-send-btn{width:42px;height:42px;background:#3B82F6;border:none;border-radius:12px;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}
      #tf-msg-send-btn:disabled{background:#1E293B;cursor:not-allowed}
      .skeleton{background:#1E293B;animation:pulse 1.5s ease-in-out infinite}
      @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
    `;
    document.head.appendChild(style);

    document.getElementById('tf-msg-close-btn')?.addEventListener('click', closeChat);
    document.getElementById('tf-msg-send-btn')?.addEventListener('click', sendMessage);
    document.getElementById('tf-msg-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && currentPeer) closeChat();
    });
  }

  return { init, openChat, closeChat, getConversations, refreshUnreadBadge };
})();
