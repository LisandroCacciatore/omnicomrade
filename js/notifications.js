/**
 * notifications.js
 * TechFitness — Notificaciones in-app
 */
window.TFNotifications = (function () {
  const db = () => window.supabaseClient;
  const esc = (s) => window.tfUtils?.escHtml(s) ?? String(s ?? '');

  let gymId = null;
  let userId = null;
  let openerEl = null;

  async function init({ gymId: gId, userId: uId }) {
    gymId = gId;
    userId = uId;
    injectInboxHTML();
    await refreshBadge();
  }

  async function refreshBadge() {
    if (!userId || !gymId) return;
    const { count } = await db()
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', userId)
      .eq('gym_id', gymId)
      .is('read_at', null);

    const unread = count || 0;
    const badge = document.getElementById('tf-notif-badge');
    if (badge) {
      badge.textContent = unread > 9 ? '9+' : String(unread);
      badge.style.display = unread > 0 ? 'flex' : 'none';
      badge.setAttribute('aria-label', `${unread} notificaciones sin leer`);
    }
  }

  async function openInbox() {
    const panel = document.getElementById('tf-notif-panel');
    if (!panel) return;
    if (!panel.classList.contains('open')) openerEl = document.activeElement;
    panel?.classList.toggle('open');
    if (panel?.classList.contains('open')) {
      await loadNotifications();
      document.getElementById('tf-notif-close')?.focus();
    } else {
      openerEl?.focus?.();
    }
  }

  async function loadNotifications() {
    const list = document.getElementById('tf-notif-list');
    if (!list || !userId) return;

    const { data, error } = await db()
      .from('notifications')
      .select('*')
      .eq('recipient_id', userId)
      .eq('gym_id', gymId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error || !data) {
      list.innerHTML = '<p class="tf-notif-empty">Error al cargar notificaciones</p>';
      return;
    }

    const unreadIds = data.filter((n) => !n.read_at).map((n) => n.id);
    if (unreadIds.length) {
      await db().from('notifications').update({ read_at: new Date().toISOString() }).in('id', unreadIds);
      await refreshBadge();
    }

    if (!data.length) {
      list.innerHTML = '<div class="tf-notif-empty"><span style="font-size:28px">🔔</span><p>Sin notificaciones por ahora</p></div>';
      return;
    }

    const icons = {
      membership_expiring: 'event_busy',
      student_inactive: 'person_off',
      new_program: 'fitness_center',
      new_message: 'chat',
      weekly_summary: 'summarize'
    };

    list.innerHTML = data
      .map((n) => {
        const time = new Date(n.created_at).toLocaleDateString('es-AR', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit'
        });
        const icon = icons[n.type] || 'notifications';
        const isNew = !n.read_at;

        return `<a class="tf-notif-item ${isNew ? 'unread' : ''}" href="${n.action_url || '#'}" ${n.action_url ? '' : 'onclick="return false"'}><div class="tf-notif-icon"><span class="material-symbols-rounded">${icon}</span></div><div class="tf-notif-body"><p class="tf-notif-title">${esc(n.title)}</p>${n.body ? `<p class="tf-notif-desc">${esc(n.body)}</p>` : ''}<span class="tf-notif-time">${time}</span></div>${isNew ? '<div class="tf-notif-dot"></div>' : ''}</a>`;
      })
      .join('');
  }

  function injectInboxHTML() {
    if (document.getElementById('tf-notif-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'tf-notif-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Notificaciones');
    panel.innerHTML = `<div class="tf-notif-header"><h3>Notificaciones</h3><button id="tf-notif-close" aria-label="Cerrar notificaciones"><span class="material-symbols-rounded">close</span></button></div><div id="tf-notif-list" class="tf-notif-list"><div class="tf-notif-empty">Cargando...</div></div>`;
    document.body.appendChild(panel);

    const style = document.createElement('style');
    style.textContent = `
      #tf-notif-panel{position:fixed;top:64px;right:16px;width:340px;max-width:calc(100vw - 32px);background:#161E26;border:1px solid #1E293B;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.5);z-index:50;display:none;flex-direction:column;max-height:480px;overflow:hidden;font-family:'Space Grotesk',sans-serif}
      #tf-notif-panel.open{display:flex}
      .tf-notif-header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #1E293B;flex-shrink:0}
      .tf-notif-header h3{font-size:14px;font-weight:800;color:#E2E8F0;margin:0}
      #tf-notif-close{background:none;border:none;color:#64748B;cursor:pointer;display:flex;align-items:center}
      .tf-notif-list{overflow-y:auto}
      .tf-notif-item{display:flex;align-items:flex-start;gap:12px;padding:12px 16px;border-bottom:1px solid #0F1922;text-decoration:none;transition:background .15s;position:relative}
      .tf-notif-item:hover{background:rgba(255,255,255,.03)}
      .tf-notif-item.unread{background:rgba(59,130,246,.04)}
      .tf-notif-icon{width:36px;height:36px;border-radius:10px;background:#1E293B;display:flex;align-items:center;justify-content:center;color:#3B82F6;flex-shrink:0}
      .tf-notif-title{font-size:13px;font-weight:700;color:#E2E8F0;margin:0 0 2px}
      .tf-notif-desc{font-size:12px;color:#64748B;margin:0 0 4px;line-height:1.4}
      .tf-notif-time{font-size:10px;color:#475569}
      .tf-notif-dot{width:8px;height:8px;border-radius:50%;background:#3B82F6;position:absolute;top:14px;right:12px;flex-shrink:0}
      .tf-notif-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:32px 16px;color:#64748B;font-size:13px;text-align:center}
    `;
    document.head.appendChild(style);

    document.getElementById('tf-notif-close')?.addEventListener('click', () => {
      document.getElementById('tf-notif-panel')?.classList.remove('open');
      openerEl?.focus?.();
    });

    document.addEventListener('click', (e) => {
      const panelEl = document.getElementById('tf-notif-panel');
      const trigger = document.getElementById('btn-notifications');
      if (!panelEl?.contains(e.target) && !trigger?.contains(e.target)) {
        panelEl?.classList.remove('open');
        openerEl?.focus?.();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.getElementById('tf-notif-panel')?.classList.contains('open')) {
        document.getElementById('tf-notif-panel')?.classList.remove('open');
        openerEl?.focus?.();
      }
    });
  }

  return { init, refreshBadge, openInbox };
})();
