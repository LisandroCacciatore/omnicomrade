// ─── ESTADO ───────────────────────────────────────────────
let allMemberships = [];
const { escHtml } = window.tfUtils;

// ─── INIT ─────────────────────────────────────────────────
async function initMembershipList() {
    const session = await window.authGuard(['gim_admin']);
    if (!session) return;

    document.getElementById('user-name').textContent =
        session.user.user_metadata?.full_name || session.user.email;

    document.getElementById('logout-btn')?.addEventListener('click', window.tfUtils.logout);

    await loadMemberships();
    setupFilters();
    setupModal();
}

// ─── CARGAR MEMBRESÍAS ────────────────────────────────────
// Trae todas las membresías junto con el nombre del alumno usando un JOIN.
// El .select('*, students(full_name, email)') le dice a Supabase que traiga
// también los datos del alumno relacionado por student_id.
async function loadMemberships() {
    const tbody = document.getElementById('memberships-table');
    tbody.innerHTML = `
        <tr class="animate-pulse sk-delay-1">
            <td class="px-6 py-4 sticky left-0 bg-[#0B1218] z-10"><div class="h-4 w-32 bg-slate-800 rounded"></div></td>
            <td class="px-6 py-4"><div class="h-4 w-20 bg-slate-800 rounded"></div></td>
            <td class="px-6 py-4"><div class="h-4 w-16 bg-slate-800 rounded"></div></td>
            <td class="px-6 py-4"><div class="h-4 w-20 bg-slate-800 rounded"></div></td>
            <td class="px-6 py-4"><div class="h-4 w-20 bg-slate-800 rounded"></div></td>
            <td class="px-6 py-4"><div class="h-4 w-16 bg-slate-800 rounded"></div></td>
            <td class="px-6 py-4"><div class="h-4 w-16 bg-slate-800 rounded"></div></td>
            <td class="px-6 py-4"><div class="h-4 w-8 bg-slate-800 rounded"></div></td>
        </tr>
        <tr class="animate-pulse sk-delay-2">
            <td class="px-6 py-4 sticky left-0 bg-[#0B1218] z-10"><div class="h-4 w-28 bg-slate-800 rounded"></div></td>
            <td class="px-6 py-4"><div class="h-4 w-20 bg-slate-800 rounded"></div></td>
            <td class="px-6 py-4"><div class="h-4 w-16 bg-slate-800 rounded"></div></td>
            <td class="px-6 py-4"><div class="h-4 w-20 bg-slate-800 rounded"></div></td>
            <td class="px-6 py-4"><div class="h-4 w-20 bg-slate-800 rounded"></div></td>
            <td class="px-6 py-4"><div class="h-4 w-16 bg-slate-800 rounded"></div></td>
            <td class="px-6 py-4"><div class="h-4 w-16 bg-slate-800 rounded"></div></td>
            <td class="px-6 py-4"><div class="h-4 w-8 bg-slate-800 rounded"></div></td>
        </tr>`;

    const { data, error } = await window.supabaseClient
        .from('memberships')
        .select('*, students(full_name, email)')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error cargando membresías:', error);
        return;
    }

    allMemberships = data || [];
    updateKPIs();
    renderTable(allMemberships);
}

// ─── KPIs ─────────────────────────────────────────────────
function updateKPIs() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in7days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const activas = allMemberships.filter(m => {
        const end = new Date(m.end_date);
        return end >= today;
    });

    const porVencer = allMemberships.filter(m => {
        const end = new Date(m.end_date);
        return end >= today && end <= in7days;
    });

    const vencidas = allMemberships.filter(m => {
        const end = new Date(m.end_date);
        return end < today;
    });

    document.getElementById('kpi-total').textContent = allMemberships.length;
    document.getElementById('kpi-activas').textContent = activas.length;
    document.getElementById('kpi-por-vencer').textContent = porVencer.length;
    document.getElementById('kpi-vencidas').textContent = vencidas.length;
}

// ─── RENDER TABLA ─────────────────────────────────────────
function renderTable(memberships) {
    const tbody = document.getElementById('memberships-table');
    const emptyState = document.getElementById('empty-state');

    if (!memberships || memberships.length === 0) {
        tbody.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');

    tbody.innerHTML = memberships.map(m => {
        const status = getMembershipStatus(m.end_date);
        return `
        <tr class="hover:bg-slate-800/30 transition-colors">
            <td class="px-6 py-4 sticky left-0 bg-[#0B1218] z-10 border-r border-border-dark sm:border-r-0">
                <div class="flex flex-col">
                    <span class="font-bold text-sm">${escHtml(m.students?.full_name || 'Sin nombre')}</span>
                    <span class="text-[10px] text-slate-500">${escHtml(m.students?.email || '')}</span>
                </div>
            </td>
            <td class="px-6 py-4">
                <span class="text-xs font-bold capitalize">${escHtml(m.plan || '—')}</span>
            </td>
            <td class="px-6 py-4">
                <span class="status-badge ${status.class}">${status.label}</span>
            </td>
            <td class="px-6 py-4 text-xs text-slate-400">${formatDate(m.start_date)}</td>
            <td class="px-6 py-4 text-xs ${status.dateClass}">${formatDate(m.end_date)}</td>
            <td class="px-6 py-4 text-sm font-bold">$${parseFloat(m.amount).toLocaleString('es-AR')}</td>
            <td class="px-6 py-4">
                <span class="flex items-center gap-1 text-xs text-slate-400">
                    <span class="material-symbols-rounded text-[14px]">${m.payment_method === 'efectivo' ? 'payments' : 'account_balance'}</span>
                    ${escHtml(m.payment_method || '—')}
                </span>
            </td>
            <td class="px-6 py-4">
                ${m.notes ? `
                <div class="relative group">
                    <button class="size-8 rounded-lg border border-border-dark flex items-center justify-center hover:bg-slate-800 text-slate-400 transition-colors">
                        <span class="material-symbols-rounded text-[16px]">sticky_note_2</span>
                    </button>
                    <div class="absolute right-0 bottom-full mb-2 w-48 bg-slate-900 border border-border-dark rounded-xl p-3 text-xs text-slate-300 hidden group-hover:block z-10 shadow-xl">
                        ${escHtml(m.notes)}
                    </div>
                </div>` : '<div class="size-8"></div>'}
            </td>
        </tr>`;
    }).join('');
}

// ─── ESTADO DE MEMBRESÍA ──────────────────────────────────
// Calcula el estado en el frontend comparando end_date con hoy.
// Esto es más flexible que depender del campo membership_status del alumno.
function getMembershipStatus(endDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    const in7days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    if (end < today) {
        return { label: 'Vencida', class: 'bg-danger/10 text-danger', dateClass: 'text-danger' };
    } else if (end <= in7days) {
        return { label: 'Por vencer', class: 'bg-warning/10 text-warning', dateClass: 'text-warning' };
    } else {
        return { label: 'Activa', class: 'bg-success/10 text-success', dateClass: 'text-slate-400' };
    }
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric'
    });
}

// ─── FILTROS ──────────────────────────────────────────────
// Cada vez que el usuario escribe o cambia un filtro, filtra el array
// en memoria sin hacer otra llamada a Supabase.
function setupFilters() {
    const searchInput = document.getElementById('search-input');
    const filterStatus = document.getElementById('filter-status');
    const filterPlan = document.getElementById('filter-plan');

    function applyFilters() {
        const search = searchInput.value.toLowerCase();
        const status = filterStatus.value;
        const plan = filterPlan.value;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const in7days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

        const filtered = allMemberships.filter(m => {
            const name = m.students?.full_name?.toLowerCase() || '';
            const end = new Date(m.end_date);

            const matchSearch = !search || name.includes(search);
            const matchPlan = !plan || m.plan === plan;

            let matchStatus = true;
            if (status === 'activa') matchStatus = end >= today && end > in7days;
            if (status === 'por_vencer') matchStatus = end >= today && end <= in7days;
            if (status === 'vencida') matchStatus = end < today;

            return matchSearch && matchPlan && matchStatus;
        });

        renderTable(filtered);
    }

    searchInput.addEventListener('input', applyFilters);
    filterStatus.addEventListener('change', applyFilters);
    filterPlan.addEventListener('change', applyFilters);
}

// ─── MODAL NUEVA MEMBRESÍA ────────────────────────────────
function setupModal() {
    const modal = document.getElementById('modal-nueva-membresia');
    const backdrop = document.getElementById('modal-membresia-backdrop');
    const closeBtn = document.getElementById('modal-membresia-close');
    const submitBtn = document.getElementById('modal-membresia-submit');
    const errorEl = document.getElementById('modal-membresia-error');
    const btnText = document.getElementById('membresia-btn-text');
    const btnSpinner = document.getElementById('membresia-btn-spinner');

    async function openModal() {
        window.tfUtils.showModal('modal-nueva-membresia');
        document.getElementById('membresia-start-date').value =
            new Date().toISOString().split('T')[0];

        const { data: students } = await window.supabaseClient
            .from('students')
            .select('id, full_name')
            .is('deleted_at', null)
            .order('full_name');

        const select = document.getElementById('membresia-student-id');
        select.innerHTML = '<option value="">Seleccioná un alumno...</option>';
        students?.forEach(s => {
            select.innerHTML += `<option value="${String(s.id ?? '')}">${escHtml(s.full_name || 'Sin nombre')}</option>`;
        });
    }

    function closeModal() {
        window.tfUtils.hideModal('modal-nueva-membresia');
        document.getElementById('membresia-student-id').value = '';
        document.getElementById('membresia-plan').value = '';
        document.getElementById('membresia-amount').value = '';
        document.getElementById('membresia-notes').value = '';
        document.querySelectorAll('.plan-btn').forEach(b =>
            b.classList.remove('border-primary', 'text-primary', 'bg-primary/10'));
        errorEl.classList.add('hidden');
    }

    document.querySelectorAll('.plan-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.plan-btn').forEach(b =>
                b.classList.remove('border-primary', 'text-primary', 'bg-primary/10'));
            btn.classList.add('border-primary', 'text-primary', 'bg-primary/10');
            document.getElementById('membresia-plan').value = btn.dataset.plan;
        });
    });

    async function saveMembresia() {
        const studentId = document.getElementById('membresia-student-id').value;
        const plan = document.getElementById('membresia-plan').value;
        const startDate = document.getElementById('membresia-start-date').value;
        const amount = document.getElementById('membresia-amount').value;
        const paymentMethod = document.getElementById('membresia-payment-method').value;
        const notes = document.getElementById('membresia-notes').value.trim();

        if (!studentId || !plan || !startDate || !amount) {
            errorEl.textContent = 'Alumno, plan, fecha y monto son obligatorios.';
            errorEl.classList.remove('hidden');
            return;
        }

        window.tfUtils.setBtnLoading(submitBtn, true, 'Guardando...');

        try {
            const session = await window.supabaseClient.auth.getSession();
            const gymId = session.data.session.user.app_metadata.gym_id;

            const { error } = await window.supabaseClient
                .from('memberships')
                .insert({
                    gym_id: gymId,
                    student_id: studentId,
                    plan,
                    start_date: startDate,
                    end_date: startDate, // el trigger lo sobreescribe
                    amount: parseFloat(amount),
                    payment_method: paymentMethod,
                    notes: notes || null
                });

            if (error) throw error;

            closeModal();
            await loadMemberships(); // recarga todo

        } catch (err) {
            errorEl.textContent = 'Error al guardar: ' + err.message;
            errorEl.classList.remove('hidden');
        } finally {
            window.tfUtils.setBtnLoading(submitBtn, false, 'Registrar Membresía');
        }
    }

    document.getElementById('btn-nueva-membresia').addEventListener('click', openModal);
    backdrop.addEventListener('click', closeModal);
    closeBtn.addEventListener('click', closeModal);
    submitBtn.addEventListener('click', saveMembresia);
}

// ─── ARRANCAR ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', initMembershipList);
