// Lógica de Autenticación
const loginForm = document.getElementById('login-form');
const loginBtn = document.getElementById('login-btn');
const btnSpinner = document.getElementById('btn-spinner');
const btnText = document.getElementById('btn-text');
const errorMessage = document.getElementById('error-message');
const errorText = document.getElementById('error-text');
const googleLoginBtn = document.getElementById('google-login-btn');
const accessRequestForm = document.getElementById('access-request-form');
const accessFeedback = document.getElementById('access-request-feedback');
const getDashboardByRole = window.tfRouteMap?.getDashboardByRole
    || ((role, fallback = 'login.html') => {
        const map = {
            gim_admin: 'admin-dashboard.html',
            profesor: 'profesor-dashboard.html',
            alumno: 'student-profile.html',
            coach: 'profesor-dashboard.html'
        };
        const normalized = role === 'coach' ? 'profesor' : role;
        return map[normalized] || map[role] || fallback;
    });

async function handleLogin(e) {
    e.preventDefault();
    
    // UI Feedback
    setLoading(true);
    hideError();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        // Implementamos un timeout de 10s (US-12)
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('timeout')), 10000)
        );

        const loginPromise = window.supabaseClient.auth.signInWithPassword({
            email,
            password,
        });

        const { data, error } = await Promise.race([loginPromise, timeoutPromise]);

        if (error) throw error;

        // Éxito: Redirigir por rol
        const user = data.user;
        const role = await resolveUserRole(user);

        if (!role) {
            await window.supabaseClient.auth.signOut();
            showError("Tu cuenta no tiene permisos asignados. Contactá al administrador.");
            window.tfUtils.setBtnLoading(loginBtn, false);
            return;
        }

        // Dashboard Mapping
        const redirectUrl = getDashboardByRole(role, 'index.html');
        
        // Guardar rol para el sidebar
        if (window.TFSidebar) {
            window.TFSidebar.setRole(role);
        } else {
            localStorage.setItem('tf_role', role);
        }

        window.location.href = redirectUrl;

    } catch (err) {
        console.error("Login Error:", err.message);
        
        // Manejo específico de errores comunes (US-12)
        let userFriendlyMsg = "Algo salió mal. Intentá de nuevo.";
        
        if (err.message === 'timeout') {
            userFriendlyMsg = "El servidor tardó demasiado. Intentá de nuevo.";
        } else if (!navigator.onLine || err.message.includes("Network request failed")) {
            userFriendlyMsg = "Sin conexión. Verificá tu internet.";
        } else if (err.message.includes("Invalid login credentials")) {
            userFriendlyMsg = "Email o contraseña incorrectos";
        }
        
        showError(userFriendlyMsg);
        window.tfUtils.setBtnLoading(loginBtn, false);
    }
}

function setLoading(isLoading) {
    window.tfUtils.setBtnLoading(loginBtn, isLoading, 'Autenticando...');
}

function showError(message) {
    errorText.textContent = message;
    errorMessage.classList.remove('hidden');
    
    // Shake effect (opcional, premium feel)
    const container = loginForm.parentElement;
    container.classList.add('animate-shake');
    setTimeout(() => container.classList.remove('animate-shake'), 500);
}

function hideError() {
    errorMessage.classList.add('hidden');
}

// Add CSS for shake animation if not present
const style = document.createElement('style');
style.innerHTML = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
    }
    .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
`;
document.head.appendChild(style);

// Check if already logged in
async function checkCurrentSession() {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (session) {
        const postAuthOk = await runPostAuthHook(session);
        if (!postAuthOk) return;

        const role = await resolveUserRole(session.user);
        const target = getDashboardByRole(role, null);
        if (target) window.location.href = target;
    }
}

async function resolveUserRole(user) {
    if (!user) return null;
    if (user.app_metadata?.role) return user.app_metadata.role;

    const { data: profile } = await window.supabaseClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

    return profile?.role || null;
}

async function runPostAuthHook(session) {
    if (!session?.access_token) return false;

    try {
        const response = await fetch('/api/auth/post-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: session.access_token })
        });

        const payload = await response.json();
        if (!response.ok || payload.allowed === false) {
            await window.supabaseClient.auth.signOut();
            showError(payload?.message || 'Tu cuenta no tiene acceso aprobado todavía.');
            return false;
        }

        if (payload?.role) {
            if (window.TFSidebar) window.TFSidebar.setRole(payload.role);
            else localStorage.setItem('tf_role', payload.role);
        }
        if (payload?.gym_id) localStorage.setItem('gym_id', payload.gym_id);

        return true;
    } catch (err) {
        console.error('Post-auth hook error:', err.message);
        showError('No pudimos validar tu acceso. Intentá de nuevo.');
        return false;
    }
}

async function loginWithGoogle() {
    hideError();
    const redirectTo = `${window.location.origin}/login.html`;

    const { error } = await window.supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo }
    });

    if (error) showError('No se pudo iniciar Google OAuth. Intentá más tarde.');
}

async function submitAccessRequest(e) {
    e.preventDefault();
    const email = document.getElementById('access-email')?.value?.trim()?.toLowerCase();
    const fullName = document.getElementById('access-name')?.value?.trim() || null;
    if (!email) return;

    accessFeedback?.classList.add('hidden');
    const res = await fetch('/api/access-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, full_name: fullName, source: 'login_form' })
    });
    const payload = await res.json();

    if (accessFeedback) {
        if (res.ok) {
            accessFeedback.textContent = 'Solicitud enviada. Te avisaremos cuando estés aprobado.';
            accessFeedback.className = 'text-xs font-bold text-success';
            accessRequestForm?.reset();
        } else {
            accessFeedback.textContent = payload?.message || payload?.error || 'No se pudo registrar la solicitud.';
            accessFeedback.className = 'text-xs font-bold text-warning';
        }
        accessFeedback.classList.remove('hidden');
    }
}

loginForm.addEventListener('submit', handleLogin);
googleLoginBtn?.addEventListener('click', loginWithGoogle);
accessRequestForm?.addEventListener('submit', submitAccessRequest);
window.addEventListener('load', checkCurrentSession);
