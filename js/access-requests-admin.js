(async () => {
  const session = await window.authGuard(['gim_admin']);
  if (!session) return;

  const bodyEl = document.getElementById('requests-body');
  const filterEl = document.getElementById('filter-status');
  const reloadBtn = document.getElementById('reload-btn');
  const actorId = session.user.id;
  let usingSupabaseFallback = false;

  function markFallback() {
    if (usingSupabaseFallback) return;
    usingSupabaseFallback = true;
    window.tfUtils.toast('API /api no disponible. Usando fallback directo a Supabase.', 'warning');
  }

  async function fetchViaSupabase(status) {
    let query = window.supabaseClient
      .from('access_requests')
      .select('id, email, full_name, source, status, role, gym_id, notes, requested_at, approved_at, approved_by')
      .order('requested_at', { ascending: false })
      .limit(200);

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async function approveViaSupabase(id, payload) {
    const { role, gym_id, notes } = payload;
    const { error } = await window.supabaseClient
      .from('access_requests')
      .update({
        status: 'approved',
        role,
        gym_id,
        notes,
        approved_at: new Date().toISOString(),
        approved_by: actorId
      })
      .eq('id', id);

    if (error) throw error;
  }

  async function rejectViaSupabase(id, payload) {
    const { notes } = payload;
    const { error } = await window.supabaseClient
      .from('access_requests')
      .update({
        status: 'rejected',
        notes,
        approved_at: null,
        approved_by: actorId
      })
      .eq('id', id);

    if (error) throw error;
  }

  async function fetchRequests() {
    const status = filterEl?.value || '';
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    try {
      const res = await fetch(`/api/access-requests${query}`);
      if (res.status === 404) {
        markFallback();
        return await fetchViaSupabase(status);
      }
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'No se pudieron cargar solicitudes');
      return payload.items || [];
    } catch (error) {
      markFallback();
      return await fetchViaSupabase(status);
    }
  }

  function statusBadge(status) {
    if (status === 'approved') return 'bg-success/15 text-success';
    if (status === 'rejected') return 'bg-danger/15 text-danger';
    return 'bg-warning/15 text-warning';
  }

  function formatDate(v) {
    if (!v) return '—';
    return new Date(v).toLocaleString('es-AR');
  }

  async function load() {
    bodyEl.innerHTML = '<tr><td colspan="6" class="px-4 py-6 text-slate-400">Cargando...</td></tr>';
    try {
      const items = await fetchRequests();
      if (!items.length) {
        bodyEl.innerHTML =
          '<tr><td colspan="6" class="px-4 py-6 text-slate-500">Sin solicitudes</td></tr>';
        return;
      }

      const roleOptions = (selected) =>
        ['alumno', 'profesor', 'gim_admin']
          .map(
            (role) =>
              `<option value="${role}" ${selected === role ? 'selected' : ''}>${window.tfUtils.escHtml(role)}</option>`
          )
          .join('');

      bodyEl.innerHTML = items
        .map(
          (r) => `
        <tr class="border-t border-border-dark">
          <td class="px-4 py-3">${window.tfUtils.escHtml(r.email || '—')}</td>
          <td class="px-4 py-3">${window.tfUtils.escHtml(r.full_name || '—')}</td>
          <td class="px-4 py-3"><span class="text-xs font-bold px-2 py-1 rounded-full ${statusBadge(r.status)}">${window.tfUtils.escHtml(r.status)}</span></td>
          <td class="px-4 py-3 text-slate-400">${formatDate(r.requested_at)}</td>
          <td class="px-4 py-3 min-w-[260px]">
            ${
              r.status === 'pending'
                ? `
              <div class="grid gap-2">
                <select data-role-for="${r.id}" class="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs">
                  ${roleOptions(r.role || 'alumno')}
                </select>
                <input data-gym-for="${r.id}" value="${window.tfUtils.escHtml(r.gym_id || '')}" placeholder="gym_id (opcional)" class="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs" />
              </div>
            `
                : `
              <div class="text-xs text-slate-400">
                <div>rol: <strong>${window.tfUtils.escHtml(r.role || '—')}</strong></div>
                <div>gym: <strong>${window.tfUtils.escHtml(r.gym_id || '—')}</strong></div>
              </div>
            `
            }
          </td>
          <td class="px-4 py-3">
            ${
              r.status === 'pending'
                ? `
              <div class="flex gap-2">
                <button data-action="approve" data-id="${r.id}" class="px-3 py-1.5 rounded-lg bg-success/20 text-success font-bold text-xs">Aprobar</button>
                <button data-action="reject" data-id="${r.id}" class="px-3 py-1.5 rounded-lg bg-danger/20 text-danger font-bold text-xs">Rechazar</button>
              </div>
            `
                : '<span class="text-slate-500 text-xs">Sin acciones</span>'
            }
          </td>
        </tr>
      `
        )
        .join('');
    } catch (err) {
      bodyEl.innerHTML = `<tr><td colspan="6" class="px-4 py-6 text-danger">${window.tfUtils.escHtml(err.message)}</td></tr>`;
    }
  }

  async function approveRequest(id) {
    const roleEl = bodyEl.querySelector(`[data-role-for="${id}"]`);
    const gymEl = bodyEl.querySelector(`[data-gym-for="${id}"]`);
    const role = roleEl?.value || 'alumno';
    const gymId = gymEl?.value?.trim() || null;

    const payload = {
      role,
      gym_id: gymId,
      notes: `Aprobado desde backoffice (${role}${gymId ? ` | gym ${gymId}` : ''})`
    };

    try {
      const res = await fetch(`/api/access-requests/${id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-actor-id': actorId
        },
        body: JSON.stringify(payload)
      });
      if (res.status === 404) {
        markFallback();
        await approveViaSupabase(id, payload);
        return;
      }
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'No se pudo aprobar');
    } catch (error) {
      markFallback();
      await approveViaSupabase(id, payload);
    }
  }

  async function rejectRequest(id) {
    const payload = { notes: 'Rechazado desde panel admin' };
    try {
      const res = await fetch(`/api/access-requests/${id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-actor-id': actorId
        },
        body: JSON.stringify(payload)
      });
      if (res.status === 404) {
        markFallback();
        await rejectViaSupabase(id, payload);
        return;
      }
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'No se pudo rechazar');
    } catch (error) {
      markFallback();
      await rejectViaSupabase(id, payload);
    }
  }

  bodyEl?.addEventListener('click', async (evt) => {
    const btn = evt.target.closest('button[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    const isApprove = action === 'approve';
    if (!confirm(`¿${isApprove ? 'Aprobar' : 'Rechazar'} esta solicitud?`)) return;
    try {
      btn.disabled = true;
      btn.textContent = isApprove ? 'Aprobando...' : 'Rechazando...';
      if (isApprove) await approveRequest(id);
      else await rejectRequest(id);
      window.tfUtils.toast(isApprove ? 'Solicitud aprobada' : 'Solicitud rechazada');
      await load();
    } catch (err) {
      window.tfUtils.toast(err.message || 'Error', 'error');
      btn.disabled = false;
      btn.textContent = isApprove ? 'Aprobar' : 'Rechazar';
    }
  });

  filterEl?.addEventListener('change', load);
  reloadBtn?.addEventListener('click', load);

  await load();
})();
