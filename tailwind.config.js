/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '2rem', screens: { '2xl': '1400px' } },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
        status: {
          pending: 'hsl(var(--status-pending))',
          accepted: 'hsl(var(--status-accepted))',
          progress: 'hsl(var(--status-progress))',
          verify: 'hsl(var(--status-verify))',
          done: 'hsl(var(--status-done))',
          cancelled: 'hsl(var(--status-cancelled))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Archivo', 'Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        /* Il serif vive solo nel lockup del marchio: nelle UI software e' bandito. */
        serif: ['Spectral', 'ui-serif', 'Georgia', 'serif'],
        mono: ['Geist Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      /* Le ombre sono tinte sulla base, non nere: un'ombra neutra su un fondo
         caldo legge come sporco. */
      boxShadow: {
        brand: '0 8px 18px -6px hsl(var(--primary) / 0.35), inset 0 1px 0 hsl(0 0% 100% / 0.16)',
        card: '0 1px 2px hsl(345 30% 12% / 0.05), 0 1px 3px hsl(345 30% 12% / 0.05)',
        raised: '0 12px 32px -10px hsl(345 30% 12% / 0.14)',
        pill: '0 6px 22px -8px hsl(345 30% 12% / 0.16)',
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        'scale-in': { from: { opacity: '0', transform: 'scale(.97)' }, to: { opacity: '1', transform: 'none' } },
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'out-quart': 'cubic-bezier(0.25, 1, 0.5, 1)',
      },
      animation: {
        'fade-in': 'fade-in .16s cubic-bezier(0.25,1,0.5,1)',
        'slide-up': 'slide-up .22s cubic-bezier(0.16,1,0.3,1)',
        'scale-in': 'scale-in .16s cubic-bezier(0.16,1,0.3,1)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
