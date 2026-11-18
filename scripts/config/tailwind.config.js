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
                limeAccent: '#22E562',           // signature emerald (legacy name)
                // Tailwind's lime scale, re-based on the signature emerald #22E562: every *-lime-* class is emerald
                lime: { 50: '#ECFDF2', 100: '#D1FADF', 200: '#A6F4C1', 300: '#6EEB98', 400: '#4BEA82', 500: '#22E562', 600: '#18B84D', 700: '#13903D', 800: '#127234', 900: '#105D2D', 950: '#053418' },
                appDark: '#121820',
                appBg: '#08080a',                // app-wide dark page (matches Home)
                brandBlue: '#007AFF',
                rainBg: '#0F172A',
                brand: {
                    lime: '#22E562',             // signature emerald (legacy name; same as brand-emerald)
                    emerald: '#22E562',          // signature emerald
                    limeHover: '#1BC453',
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
                // Dark theme: shadows are deeper (they sit on near-black) and carry no white glow
                '2xs': '0 1px rgb(0 0 0 / 0.3)',
                'xs': '0 1px 2px 0 rgb(0 0 0 / 0.3)',
                'apple': '0 10px 30px -8px rgba(0, 0, 0, 0.5), 0 4px 12px -4px rgba(0, 0, 0, 0.3)',
                'apple-lg': '0 20px 40px -12px rgba(0, 0, 0, 0.6), 0 8px 16px -6px rgba(0, 0, 0, 0.35)',
                'glow': '0 0 25px -5px rgba(34, 229, 98, 0.4)',
                'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
            }
        }
    }
}
