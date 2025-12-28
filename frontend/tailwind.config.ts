import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Consistent color palette
        primary: "hsl(221, 83%, 53%)", // blue-600
        secondary: "hsl(210, 40%, 96%)", // gray-50
        accent: "hsl(221, 83%, 53%)", // blue-600
        destructive: "hsl(0, 84%, 60%)", // red-500
      },
      fontSize: {
        'display': ['2rem', { lineHeight: '1.2', fontWeight: '700', letterSpacing: '-0.02em' }],
        'h1': ['1.5rem', { lineHeight: '1.3', fontWeight: '600', letterSpacing: '-0.01em' }],
        'h2': ['1.125rem', { lineHeight: '1.4', fontWeight: '600', letterSpacing: '-0.01em' }],
        'h3': ['1rem', { lineHeight: '1.5', fontWeight: '600' }],
        'body': ['0.9375rem', { lineHeight: '1.6', fontWeight: '400' }],
        'body-lg': ['1rem', { lineHeight: '1.6', fontWeight: '400' }],
        'small': ['0.875rem', { lineHeight: '1.5', fontWeight: '400' }],
        'caption': ['0.75rem', { lineHeight: '1.4', fontWeight: '400' }],
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
} satisfies Config;
