/** @type {import('tailwindcss').Config} */
tailwind.config = {
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                // ── Aliases cortos (usados en la mayoría de los HTML) ──
                "bg-dark":          "#0B1218",
                "surface-dark":     "#161E26",
                "surface-2":        "#1A2330",
                "border-dark":      "#1E293B",
                "border-muted":     "#334155",
                // ── Aliases largos (login.html, compatibilidad) ────────
                "background-dark":  "#0B1218",
                "background-light": "#f1f5f9",
                // ── Semánticos ─────────────────────────────────────────
                "primary":  "#3B82F6",
                "success":  "#10B981",
                "danger":   "#EF4444",
                "warning":  "#F59E0B",
            },
            fontFamily: {
                "sans":    ["Space Grotesk", "sans-serif"],
                "display": ["Space Grotesk", "sans-serif"],
                "mono":    ["IBM Plex Mono", "monospace"],
            }
        }
    }
}

