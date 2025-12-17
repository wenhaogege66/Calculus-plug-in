/** @type {import('tailwindcss').Config} */
module.exports = {
    mode: "jit",
    darkMode: "class",
    content: ["./src/**/*.{ts,tsx}"],
    theme: {
        extend: {
            colors: {
                primary: {
                    50: '#F0F9FF',
                    100: '#E0F2FE',
                    500: '#0EA5E9',
                    600: '#0284C7',
                    700: '#0369A1'
                },
                slate: {
                    850: '#1E293B'
                }
            },
            boxShadow: {
                'figma': '0 2px 5px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
                'figma-hover': '0 8px 12px -3px rgba(0, 0, 0, 0.05), 0 3px 5px -2px rgba(0, 0, 0, 0.03)',
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
            }
        },
    },
    plugins: [],
}