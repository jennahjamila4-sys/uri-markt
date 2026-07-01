import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        body: ['var(--font-body)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      colors: {
        gold: {
          DEFAULT: '#FFD700',
          lt: '#FFED4E',
          deep: '#FF9800',
          amber: '#F59E0B',
          dim: 'rgba(255,215,0,0.12)',
          glow: 'rgba(255,215,0,0.35)',
          muted: '#A89000',
        },
        obsidian: {
          DEFAULT: '#000000',
          2: '#080808',
          3: '#0f0f0f',
          4: '#161616',
          5: '#1f1f1f',
        },
        glass: {
          DEFAULT: 'rgba(255,255,255,0.055)',
          hover: 'rgba(255,255,255,0.09)',
          border: 'rgba(255,255,255,0.10)',
          strong: 'rgba(255,255,255,0.14)',
        },
        uri: {
          success: '#00D68F',
          danger: '#FF3B30',
          fomo: '#FF2D55',
          fire: '#FF6B2C',
          info: '#4FC3F7',
          purple: '#A78BFA',
        },
      },
      animation: {
        'fomo-pulse': 'fomo-pulse 1.4s ease-in-out infinite',
        'slide-up': 'slide-up 0.35s cubic-bezier(0.16,1,0.3,1)',
        'fade-in': 'fade-in 0.25s ease-out',
        'scale-in': 'scale-in 0.2s cubic-bezier(0.16,1,0.3,1)',
        shimmer: 'shimmer 1.8s linear infinite',
        'stagger-1': 'fade-in 0.4s ease-out 0.1s both',
        'stagger-2': 'fade-in 0.4s ease-out 0.2s both',
        'stagger-3': 'fade-in 0.4s ease-out 0.3s both',
      },
      keyframes: {
        'fomo-pulse': {
          '0%,100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.5', transform: 'scale(0.95)' },
        },
        'slide-up': {
          from: { transform: 'translateY(100%)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          from: { backgroundPosition: '-200% 0' },
          to: { backgroundPosition: '200% 0' },
        },
      },
      backdropBlur: {
        glass: '24px',
        heavy: '40px',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      boxShadow: {
        gold: '0 4px 24px rgba(255,215,0,0.25)',
        card: '0 2px 20px rgba(0,0,0,0.6)',
        modal: '0 -8px 60px rgba(0,0,0,0.8)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
