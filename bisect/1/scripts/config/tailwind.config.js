/**
 * Tailwind Play CDN configuration (design tokens: fonts, brand colours, shadows).
 * Must load immediately after the Tailwind CDN script.
 */

tailwind.config = {
    darkMode: 'class',
    // Gate every hover: utility behind @media (hover: hover) so taps don't leave sticky hover states on phones
    future: { hoverOnlyWhenSupported: true },
    theme: {
        extend: {
            fontFamily: {
                sans: [
                    'Inter', 
                    '-apple-system', 
                    'BlinkMacSystemFont', 
                    'SF Pro Display', 
                    'SF Pro Text', 
                    'Segoe UI', 
                    'Roboto', 
                    'Helvetica', 
                    'Arial', 
                    'sans-serif'
                ],
            },
            colors: {
                limeAccent: '#D2F818',
                appDark: '#121820',
                appBg: '#F3F4F6',
                brandBlue: '#007AFF',
                rainBg: '#0F172A',
                brand: {
                    lime: '#CCFF00',
                    limeHover: '#b3e000',
                    dark: '#0c0d10',
                    cardDark: '#16181d',
                    cardDarkHover: '#1e2128',
                }
            },
            // Utilities used in the markup that Tailwind v3 (the CDN build) doesn't ship.
            // Without these they silently rendered nothing.
            spacing: {
                '4.5': '1.125rem',
                '7.5': '1.875rem',
                '22': '5.5rem',
            },
            // Radius scale: steps down as surfaces nest (hero/sheet > page card > card inside a sheet > control)
            borderRadius: {
                'control': '16px',
                'inset': '24px',
                'card': '28px',
                'hero': '32px',
            },
            scale: {
                '98': '.98',
            },
            transitionDuration: {
                '350': '350ms',
                '400': '400ms',
            },
            boxShadow: {
                '2xs': '0 1px rgb(0 0 0 / 0.05)',
                'xs': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
                'apple': '0 10px 30px -5px rgba(0, 0, 0, 0.08), 0 4px 12px -2px rgba(0, 0, 0, 0.04)',
                'apple-lg': '0 20px 40px -10px rgba(0, 0, 0, 0.12), 0 8px 16px -4px rgba(0, 0, 0, 0.06)',
                'glow': '0 0 25px -5px rgba(204, 255, 0, 0.4)',
                'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
            }
        }
    }
}
