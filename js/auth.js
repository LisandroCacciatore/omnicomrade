// Lógica de Autenticación
const loginForm = document.getElementById('login-form');
const loginBtn = document.getElementById('login-btn');
const btnSpinner = document.getElementById('btn-spinner');
const btnText = document.getElementById('btn-text');
const errorMessage = document.getElementById('error-message');
const errorText = document.getElementById('error-text');

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
        const role = user.app_metadata.role;

        if (!role) {
            await window.supabaseClient.auth.signOut();
            showError("Tu cuenta no tiene permisos asignados. Contactá al administrador.");
            window.tfUtils.setBtnLoading(loginBtn, false);
            return;
        }

        // Dashboard Mapping
        const pathByRole = {
            'gim_admin': 'admin-dashboard.html',
            'profesor': 'profesor-dashboard.html',
            'alumno': 'student-dashboard.html',
            'coach': 'profesor-dashboard.html'
        };

        const redirectUrl = pathByRole[role] || 'index.html';
        
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
        const role = session.user.app_metadata.role;
        const normalizedRole = (role === 'coach') ? 'profesor' : role;
        
        const dashboards = {
            'gim_admin': 'admin-dashboard.html',
            'profesor': 'profesor-dashboard.html',
            'alumno': 'student-dashboard.html'
        };

        const target = dashboards[role] || dashboards[normalizedRole];
        if (target) window.location.href = target;
    }
}

loginForm.addEventListener('submit', handleLogin);
window.addEventListener('load', checkCurrentSession);