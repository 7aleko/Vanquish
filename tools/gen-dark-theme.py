# Generates styles/dark-theme.css. Edit the mapping tables below, then run:
#   python3 tools/gen-dark-theme.py styles/dark-theme.css

import re, sys
out = []
def esc(c): return re.sub(r'([:/\[\].])', r'\\\1', c)
def sel_variants(base, variant=''):
    # exact class + any opacity modifier, matched as whole class tokens only
    v = variant
    cls = v + base
    return [f'.{esc(cls)}', f'[class^="{cls}/"]', f'[class*=" {cls}/"]']
def rule(selectors, decl, prefix='html ', suffix=''):
    out.append(',\n'.join(f'{prefix}{s}{suffix}' for s in selectors) + f' {{ {decl} }}')
def comment(t): out.append(f'\n/* {t} */')

W = lambda a: f'rgba(255, 255, 255, {a})'

out.append('''/* App-wide dark theme (Home is the reference).
   Every screen, sheet and control was built with light Tailwind utilities; this layer maps each light
   utility to its Home equivalent - #08080A page, smoked glass rgba(255,255,255,.04-.08) surfaces,
   white/.08 hairlines, white ink with #a1a1aa / #8e9299 secondary text, status colours as tints, lime
   untouched - so a class looks the same wherever it is reused. Only colours change: no sizes, spacing,
   radii or layout. Generated from one table (see the dark-theme notes in README.md).

   Tailwind's runtime <style> is injected after the stylesheets, so every rule is prefixed with `html`
   (or a deeper selector) to win on specificity rather than order. Translucent whites at 0.2 and below
   (bg-white/10, bg-white/[0.04] ...) are already dark-theme glass on Home and the drawer; they are left alone. */

html { color-scheme: dark; }   /* native controls: select menus, date pickers, scrollbars */
html body { color: var(--ink-primary); }''')

comment('Surfaces: light cards -> Home smoked glass')
light_white = ['40','50','60','70','75','80','85','90','95']
rule([f'.bg-white'] + [f'.{esc("bg-white/"+o)}' for o in light_white] + ['.bg-appBg'] , f'background-color: {W(0.05)};')
rule(sum([sel_variants(c) for c in ['bg-slate-50','bg-gray-50','bg-zinc-50','bg-neutral-50']],[]), f'background-color: {W(0.04)};')
rule(sum([sel_variants(c) for c in ['bg-slate-100','bg-gray-100','bg-zinc-100']],[]), f'background-color: {W(0.06)};')
rule(sum([sel_variants(c) for c in ['bg-slate-200','bg-gray-200','bg-zinc-200']],[]), f'background-color: {W(0.08)};')
rule(sum([sel_variants(c) for c in ['bg-slate-300','bg-gray-300']],[]), f'background-color: {W(0.14)};')
rule(['#app-main-stage.bg-appBg', '.bg-appBg'], 'background-color: #08080a;', prefix='html body ')
comment('Raised dark controls (primary buttons, selected chips, avatars) sit one step above the glass')
rule(['.bg-slate-900', '.bg-gray-900', '.bg-zinc-900'], 'background-color: #1f1f23;')
rule(['.bg-slate-800'], 'background-color: #27272a;')
comment('Selected segment in a segmented control (white pill on a slate track) -> lighter glass')
rule([f':is(.{esc("bg-slate-200/80")}, .bg-slate-200, .{esc("bg-slate-100/90")}, .bg-slate-100) > .bg-white',
      f':is(.{esc("bg-slate-200/80")}, .bg-slate-200, .{esc("bg-slate-100/90")}, .bg-slate-100) > .{esc("bg-white/90")}'],
     f'background-color: {W(0.16)}; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);', prefix='html body ')
comment('Knobs and dots stay white')
rule(['.bg-white.rounded-full.shadow', '.bg-white.rounded-full.shadow-sm', '.bg-white.rounded-full.shadow-md'], 'background-color: #ffffff;', prefix='html body ')

comment('Interaction states')
hov = lambda v, base: [f'.{esc(v+base)}:{v[:-1].split("-")[-1] if v.startswith("group") else v[:-1]}']
def state_rule(classes, decl, state):
    sels=[]
    for c in classes:
        if state=='group-hover':
            sels.append(f'.group:hover .{esc("group-hover:"+c)}')
        else:
            sels.append(f'.{esc(state+":"+c)}:{state}')
    if state in ('hover', 'group-hover'):
        # Same gate as Tailwind's hoverOnlyWhenSupported (scripts/config/tailwind.config.js): on touch screens
        # the finger that starts a scroll counts as a hover in iOS Safari and leaves the row lit after it moves on
        rule(sels, decl, prefix='    html ')
        out[-1] = '@media (hover: hover) and (pointer: fine) {\n' + out[-1] + '\n}'
    else:
        rule(sels, decl)
state_rule(['bg-white'] + ['bg-white/'+o for o in light_white] + ['bg-slate-50','bg-slate-50/80','bg-slate-100','bg-slate-100/80','bg-gray-100'], f'background-color: {W(0.08)};', 'hover')
state_rule(['bg-slate-200','bg-slate-200/90','bg-slate-200/80','bg-gray-200'], f'background-color: {W(0.12)};', 'hover')
state_rule(['bg-black','bg-slate-900','bg-slate-800'], 'background-color: #2a2a2f;', 'hover')
state_rule(['bg-black','bg-slate-900'], 'background-color: #2a2a2f;', 'group-hover')
state_rule(['bg-white','bg-slate-50','bg-slate-100'], f'background-color: {W(0.08)};', 'group-hover')
state_rule(['bg-slate-50','bg-slate-100','bg-slate-100/80','bg-slate-50/80','bg-slate-200'], f'background-color: {W(0.1)};', 'active')
state_rule(['bg-white'], f'background-color: {W(0.07)};', 'focus')
state_rule(['text-slate-900','text-slate-800','text-slate-700','text-black','text-gray-900'], 'color: #ffffff;', 'hover')
state_rule(['text-slate-900','text-slate-800','text-black'], 'color: #ffffff;', 'group-hover')
state_rule(['border-slate-200','border-slate-300','border-slate-400'], f'border-color: {W(0.16)};', 'hover')
state_rule(['border-slate-900','border-black'], f'border-color: {W(0.5)};', 'hover')

comment('Ink: dark text -> Home white / zinc')
ink = {'#ffffff':['text-slate-950','text-slate-900','text-gray-900','text-gray-950','text-zinc-900','text-zinc-950','text-black','text-neutral-900'],
       '#f4f4f5':['text-slate-800','text-gray-800','text-zinc-800'],
       '#e4e4e7':['text-slate-700','text-gray-700','text-zinc-700'],
       '#a1a1aa':['text-slate-600','text-gray-600','text-zinc-600'],
       '#8e9299':['text-slate-500','text-gray-500']}
for col, cls in ink.items():
    rule(sum([sel_variants(c) for c in cls],[]), f'color: {col};')

comment('Hairlines')
rule(['.border-white'] + [f'.{esc("border-white/"+o)}' for o in light_white] +
     sum([sel_variants(c) for c in ['border-slate-50','border-slate-100','border-slate-200','border-gray-100','border-gray-200','border-zinc-200']],[]),
     f'border-color: {W(0.08)};')
rule(sum([sel_variants(c) for c in ['border-slate-300','border-gray-300','border-slate-400']],[]), f'border-color: {W(0.14)};')
rule(['.border-slate-900', '.border-black'], f'border-color: {W(0.22)};')
comment('Rings around presence dots match the surface they sit on')
rule(['.border-2.border-white', '.ring-2.ring-white'], 'border-color: #141417; --tw-ring-color: #141417;', prefix='html body ')
rule([f'.{esc("divide-"+c)} > :not([hidden]) ~ :not([hidden])' for c in ['slate-100','slate-200','gray-100','gray-200','slate-200/60','slate-100/80']], f'border-color: {W(0.06)};')

comment('Status colours: light tints -> translucent tints with light ink (same hue, dark-theme legible)')
hues = {'emerald':(16,185,129,'#6ee7b7','#34d399'), 'green':(34,197,94,'#86efac','#4ade80'), 'teal':(20,184,166,'#5eead4','#2dd4bf'),
        'cyan':(6,182,212,'#67e8f9','#22d3ee'), 'sky':(14,165,233,'#7dd3fc','#38bdf8'), 'blue':(59,130,246,'#93c5fd','#60a5fa'),
        'indigo':(99,102,241,'#a5b4fc','#818cf8'), 'violet':(139,92,246,'#c4b5fd','#a78bfa'), 'purple':(168,85,247,'#d8b4fe','#c084fc'),
        'rose':(244,63,94,'#fda4af','#fb7185'), 'red':(239,68,68,'#fca5a5','#f87171'), 'orange':(249,115,22,'#fdba74','#fb923c'),
        'amber':(245,158,11,'#fcd34d','#fbbf24'), 'yellow':(234,179,8,'#fde047','#facc15'), 'lime':(132,204,22,'#bef264','#a3e635')}
for h,(r,g,b,ink3,ink4) in hues.items():
    rule(sel_variants(f'bg-{h}-50'), f'background-color: rgba({r}, {g}, {b}, 0.10);')
    rule(sel_variants(f'bg-{h}-100'), f'background-color: rgba({r}, {g}, {b}, 0.16);')
    rule(sel_variants(f'bg-{h}-200'), f'background-color: rgba({r}, {g}, {b}, 0.24);')
    rule(sum([sel_variants(f'text-{h}-{n}') for n in ('700','800','900','950')],[]), f'color: {ink3};')
    rule(sel_variants(f'text-{h}-600'), f'color: {ink4};')
    rule(sum([sel_variants(f'border-{h}-{n}') for n in ('100','200','300')],[]), f'border-color: rgba({r}, {g}, {b}, 0.3);')
    state_rule([f'text-{h}-700', f'text-{h}-800'], f'color: {ink3};', 'hover')
    state_rule([f'text-{h}-700'], f'color: {ink3};', 'group-hover')
    state_rule([f'bg-{h}-50', f'bg-{h}-100'], f'background-color: rgba({r}, {g}, {b}, 0.2);', 'hover')

comment('Light gradient stops -> transparent glass stops (same direction and positions)')
def grad(cls, rgba, kind):
    s = f'.{esc(cls)}'
    if kind=='from':
        rule([s], f'--tw-gradient-from: {rgba} var(--tw-gradient-from-position); --tw-gradient-to: rgba(255, 255, 255, 0) var(--tw-gradient-to-position); --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to);')
    elif kind=='via':
        rule([s], f'--tw-gradient-to: rgba(255, 255, 255, 0) var(--tw-gradient-to-position); --tw-gradient-stops: var(--tw-gradient-from), {rgba} var(--tw-gradient-via-position), var(--tw-gradient-to);')
    else:
        rule([s], f'--tw-gradient-to: {rgba} var(--tw-gradient-to-position);')
for c in ['from-white','from-white/95','from-white/90','from-white/80','from-slate-50','from-gray-50']: grad(c, W(0.06), 'from')
for c in ['via-white','via-white/70','via-white/80','via-slate-50']: grad(c, W(0.04), 'via')
for c in ['to-white','to-white/90','to-slate-50','to-slate-100']: grad(c, W(0.03), 'to')
# Only the tinted stops the app actually uses (index.html + scripts), so the layer stays small
for c in ['from-emerald-50/95','from-emerald-50/90','from-emerald-50','from-teal-50','from-blue-50','from-amber-50','from-rose-50']:
    h=c.split('-')[1]; r,g,b=hues[h][:3]; grad(c, f'rgba({r}, {g}, {b}, 0.10)', 'from')
for c in ['via-teal-50/60','via-emerald-50/40','via-emerald-50','via-teal-50']:
    h=c.split('-')[1]; r,g,b=hues[h][:3]; grad(c, f'rgba({r}, {g}, {b}, 0.06)', 'via')
for c in ['to-teal-50/60','to-emerald-50/90','to-blue-50/30','to-cyan-200/80','to-emerald-50','to-teal-50','to-blue-50']:
    h=c.split('-')[1]; r,g,b=hues[h][:3]; grad(c, f'rgba({r}, {g}, {b}, 0.08)', 'to')

comment('Placeholder text stays a quiet grey on dark fields')
rule([f'.{esc("placeholder:text-slate-400")}::placeholder', f'.{esc("placeholder:text-slate-500")}::placeholder'], 'color: #71717a;')

comment('Dark ink stays dark on lime / amber / white solid surfaces (buttons, today tile, badges)')
on_light = ':is(.bg-\\[\\#E5E5EA\\], .bg-brand-lime, .bg-limeAccent, .bg-lime-300, .bg-lime-400, .bg-amber-300, .bg-amber-400, .bg-yellow-300, .bg-yellow-400, .glass-tile-today, .bg-white.rounded-full.shadow)'
darks = ':is(.text-zinc-950, .text-slate-950, .text-slate-900, .text-slate-800, .text-slate-700, .text-slate-600, .text-black, .text-gray-900, .text-zinc-900, .text-amber-900, .text-amber-950)'
rule([f'{on_light}{darks}', f'{on_light} {darks}'], 'color: #0c0f05;', prefix='html body ')
rule([f'{on_light} {darks}'.replace(darks, ':is(.text-slate-500, .text-slate-400)')], 'color: rgba(12, 15, 5, 0.6);', prefix='html body ')
rule([f'.group:hover .{esc("group-hover:text-slate-950")}', f'.{esc("hover:bg-brand-lime")}:hover', f'.{esc("hover:bg-brand-lime")}:hover *', f'.group:hover .{esc("group-hover:bg-brand-lime")}', f'.group:hover .{esc("group-hover:bg-brand-lime")} *'], 'color: #0c0f05;', prefix='html body ')

comment('Home is the reference and was already dark: dark ink there keeps its original colour (e.g. the Sign In label on its lime layer)')
orig = {'text-slate-950':'#020617','text-slate-900':'#0f172a','text-slate-800':'#1e293b','text-slate-700':'#334155','text-slate-600':'#475569','text-slate-500':'#64748b'}
for c,v in orig.items():
    rule([f'#view-home .{c}'], f'color: {v};', prefix='html body ')

open(sys.argv[1],'w').write('\n'.join(out)+'\n')
print(len(out),'blocks')
