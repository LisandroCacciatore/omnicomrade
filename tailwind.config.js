module.exports = {
  content: ["./*.html", "./js/**/*.js"],
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
      fontFamily: { sans: ['Space Grotesk', 'sans-serif'] },
    }
  },
  plugins: [],
}

