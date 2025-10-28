/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        'xs': '475px',
        '3xl': '1600px',
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'Noto Sans',
          'sans-serif',
          'Apple Color Emoji',
          'Segoe UI Emoji',
          'Segoe UI Symbol',
          'Noto Color Emoji'
        ],
        mono: [
          'JetBrains Mono',
          'Fira Code',
          'ui-monospace',
          'SFMono-Regular',
          'Monaco',
          'Consolas',
          'Liberation Mono',
          'Courier New',
          'monospace'
        ],
      },
      fontWeight: {
        thin: '100',
        extralight: '200',
        light: '300',
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
        extrabold: '800',
        black: '900',
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          50: "#f0fdf4",
          100: "#dcfce7", 
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
          DEFAULT: "#1dc962",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        error: {
          DEFAULT: "hsl(var(--error))",
          foreground: "hsl(var(--error-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
      },
      fontSize: {
        // Responsive typography with clamp functions
        'display': ['clamp(2.5rem, 5vw, 3.5rem)', { lineHeight: '1.1', fontWeight: '700' }],
        'h1': ['clamp(2rem, 4vw, 2.5rem)', { lineHeight: '1.2', fontWeight: '600' }],
        'h2': ['clamp(1.75rem, 3.5vw, 2rem)', { lineHeight: '1.3', fontWeight: '600' }],
        'h3': ['clamp(1.25rem, 2.5vw, 1.5rem)', { lineHeight: '1.4', fontWeight: '600' }],
        'h4': ['clamp(1.125rem, 2vw, 1.25rem)', { lineHeight: '1.4', fontWeight: '600' }],
        'h5': ['clamp(1rem, 1.5vw, 1.125rem)', { lineHeight: '1.5', fontWeight: '600' }],
        'h6': ['clamp(0.875rem, 1.25vw, 1rem)', { lineHeight: '1.5', fontWeight: '600' }],
        
        // Body text with responsive scaling
        'body-xl': ['clamp(1.25rem, 2vw, 1.375rem)', { lineHeight: '1.6', fontWeight: '400' }],
        'body-lg': ['clamp(1.125rem, 1.5vw, 1.25rem)', { lineHeight: '1.6', fontWeight: '400' }],
        'body': ['clamp(0.875rem, 1.25vw, 1rem)', { lineHeight: '1.6', fontWeight: '400' }],
        'body-sm': ['clamp(0.75rem, 1vw, 0.875rem)', { lineHeight: '1.5', fontWeight: '400' }],
        'body-xs': ['clamp(0.6875rem, 0.875vw, 0.75rem)', { lineHeight: '1.5', fontWeight: '400' }],
        
        // Specialized text styles
        'lead': ['clamp(1.125rem, 1.75vw, 1.25rem)', { lineHeight: '1.7', fontWeight: '400' }],
        'caption': ['clamp(0.6875rem, 0.875vw, 0.75rem)', { lineHeight: '1.4', fontWeight: '500' }],
        'overline': ['clamp(0.625rem, 0.75vw, 0.6875rem)', { lineHeight: '1.3', fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase' }],
        
        // Static sizes for specific use cases
        'display-static': ['3.5rem', { lineHeight: '1.1', fontWeight: '700' }],
        'h1-static': ['2.5rem', { lineHeight: '1.2', fontWeight: '600' }],
        'h2-static': ['2rem', { lineHeight: '1.3', fontWeight: '600' }],
        'h3-static': ['1.5rem', { lineHeight: '1.4', fontWeight: '600' }],
        'body-static': ['1rem', { lineHeight: '1.6', fontWeight: '400' }],
        'caption-static': ['0.75rem', { lineHeight: '1.4', fontWeight: '500' }],
      },
      spacing: {
        '1': 'var(--space-1)',
        '2': 'var(--space-2)',
        '3': 'var(--space-3)',
        '4': 'var(--space-4)',
        '6': 'var(--space-6)',
        '8': 'var(--space-8)',
        '12': 'var(--space-12)',
        '16': 'var(--space-16)',
      },
      borderRadius: {
        'sm': 'var(--radius-sm)',
        'md': 'var(--radius-md)',
        'lg': 'var(--radius-lg)',
        'xl': 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
      },
      boxShadow: {
        'sm': 'var(--shadow-sm)',
        'md': 'var(--shadow-md)',
        'lg': 'var(--shadow-lg)',
        'xl': 'var(--shadow-xl)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-primary': 'var(--gradient-primary)',
        'gradient-card': 'var(--gradient-card)',
        'gradient-success': 'linear-gradient(135deg, hsl(var(--success)), hsl(var(--success) / 0.8))',
        'gradient-destructive': 'linear-gradient(135deg, hsl(var(--destructive)), hsl(var(--destructive) / 0.8))',
      },
      keyframes: {
        'grid': {
          '0%': { transform: 'translateY(-50%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-subtle': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
        'status-pulse': {
          '0%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.7', transform: 'scale(1.05)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'status-glow': {
          '0%, 100%': { boxShadow: '0 0 5px currentColor' },
          '50%': { boxShadow: '0 0 20px currentColor, 0 0 30px currentColor' },
        },
        'status-breathe': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.1)', opacity: '0.8' },
        },
        'status-bounce': {
          '0%, 20%, 50%, 80%, 100%': { transform: 'translateY(0)' },
          '40%': { transform: 'translateY(-4px)' },
          '60%': { transform: 'translateY(-2px)' },
        },
      },
      animation: {
        'grid': 'grid 15s linear infinite',
        'fade-in': 'fade-in 0.3s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
        'slide-up': 'slide-up 0.4s ease-out',
        'pulse-subtle': 'pulse-subtle 2s ease-in-out infinite',
        'status-pulse': 'status-pulse 2s ease-in-out infinite',
        'status-glow': 'status-glow 2s ease-in-out infinite',
        'status-breathe': 'status-breathe 3s ease-in-out infinite',
        'status-bounce': 'status-bounce 2s infinite',
      },
    },
  },
  plugins: [],
}
