/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./login.html",
    "./admin-dashboard.html",
    "./student-list.html",
    "./student-profile.html",
    "./student-dashboard.html",
    "./membership-list.html",
    "./routine-list.html",
    "./routine-programs.html",
    "./routine-builder.html",
    "./exercise-list.html",
    "./attendance.html",
    "./progress.html",
    "./workout-session.html",
    "./wellbeing-check.html",
    "./profesor-dashboard.html",
    "./gym-setting.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./js/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        'primary':          '#3B82F6',
        'success':          '#10B981',
        'danger':           '#EF4444',
        'warning':          '#F59E0B',
        'background-dark':  '#0B1218',
        'bg-dark':          '#0B1218',
        'surface-dark':     '#161E26',
        'surface-2':        '#1A2330',
        'border-dark':      '#1E293B',
        'border-muted':     '#334155',
        'background-light': '#f1f5f9'
      },
      fontFamily: { 
        sans: ['Space Grotesk', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace']
      }
    }
  },
  plugins: []
}
