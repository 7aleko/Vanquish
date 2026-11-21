/**
 * Role avatars: one visual language for people across the app (Team directory, Roster crew pills,
 * Home crew stack). The gradient comes from the person's job title only - never their name, id or
 * position in a list - so the same person looks the same everywhere.
 *
 *   getRoleCategory(title)      job title -> 'supervisor' | 'carpenter' | 'tradesman' | 'apprentice' | 'labour' | 'other'
 *   getRoleGradient(title)      CSS gradient for that category
 *   getRoleSeniority(title)     1 (supervisor) .. 5 (labour), 6 unknown
 *   getPersonRole(name)         the person's role from the employees (getEmployeeByName, scripts/application/selectors.js)
 *   sortCrewBySeniority(names)  new array, most senior first; stable within a role; input untouched
 *   renderRoleAvatar(person, size)  HTML for one avatar; sizes in styles/role-avatar.css
 *   renderPoppyAvatar(size)         Poppy's avatar: her live orb (call mountPoppyAvatars(container) after inserting)
 *   renderIconAvatar(icon, size)    a channel / site avatar: a Phosphor icon in the same circle
 *   withAvatarStatus(html, status)  adds a status dot ('online' | 'ai') - Poppy; a person only in their chat header
 *
 * Every profile picture in the app comes from these, styled only by styles/role-avatar.css.
 */

// Dark-glass orbs lit from below: obsidian at the top, the role's colour glowing up from the bottom
const ROLE_CATEGORIES = {
    supervisor: { seniority: 1, gradient: 'linear-gradient(180deg, #121110 25%, #92400E 75%, #F59E0B 100%)' },
    carpenter:  { seniority: 2, gradient: 'linear-gradient(180deg, #0D120F 25%, #127234 75%, #4BEA82 100%)' },
    tradesman:  { seniority: 3, gradient: 'linear-gradient(180deg, #0D1017 25%, #1D4ED8 75%, #60A5FA 100%)' },
    apprentice: { seniority: 4, gradient: 'linear-gradient(180deg, #0D1414 25%, #0F766E 75%, #2DD4BF 100%)' },
    labour:     { seniority: 5, gradient: 'linear-gradient(180deg, #111214 25%, #334155 75%, #94A3B8 100%)' },
    other:      { seniority: 6, gradient: 'linear-gradient(180deg, #121214 25%, #27272A 75%, #52525B 100%)' }   // neutral graphite
};

// Specialist trades that share the Tradesman colour
const ROLE_TRADE_WORDS = ['tradesman', 'tradesperson', 'electrician', 'plumber', 'tiler', 'bricklayer', 'plasterer',
    'painter', 'roofer', 'concreter', 'renderer', 'glazier', 'joiner', 'steel fixer', 'scaffolder', 'welder'];

function getRoleCategory(title) {
    const t = String(title || '').toLowerCase();
    if (!t) return 'other';
    // Order matters: "Apprentice Carpenter" is an apprentice; "Labour Hire Carpenter" keeps its listed role
    if (t.includes('apprentice')) return 'apprentice';
    if (/\blabou?r(er| hire)?\b/.test(t)) return 'labour';
    if (/supervisor|manager|foreman|director/.test(t)) return 'supervisor';
    if (t.includes('carpenter')) return 'carpenter';
    if (ROLE_TRADE_WORDS.some(w => t.includes(w))) return 'tradesman';
    return 'other';
}

function getRoleGradient(title) { return ROLE_CATEGORIES[getRoleCategory(title)].gradient; }
function getRoleSeniority(title) { return ROLE_CATEGORIES[getRoleCategory(title)].seniority; }

// A person's role from the team directory. Roster placeholders such as "Labour Hire 1" name a role, not a
// person, so they resolve to that role. Anyone not in the directory gets no role (the neutral fallback).
function getPersonRole(name) {
    const n = String(name || '').trim().toLowerCase();
    const member = (typeof getEmployeeByName === 'function') ? getEmployeeByName(n) : null;
    if (member) return member.role;
    if (/^labou?r hire\b/.test(n)) return 'Labour Hire';
    return '';
}

function getPersonInitials(name) {
    const member = (typeof getEmployeeByName === 'function') ? getEmployeeByName(name) : null;
    if (member && member.initials) return member.initials;
    const words = String(name || '').trim().split(/\s+/).filter(Boolean);
    return ((words[0] || '?')[0] + (words[1] ? words[1][0] : '')).toUpperCase();
}

// Most senior first. Sorts a copy; people with the same seniority keep their original order.
function sortCrewBySeniority(names) {
    return (names || [])
        .map((name, i) => ({ name, i, rank: getRoleSeniority(getPersonRole(name)) }))
        .sort((a, b) => a.rank - b.rank || a.i - b.i)
        .map(x => x.name);
}

const ROLE_AVATAR_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const roleAvatarEscape = (s) => String(s).replace(/[&<>"']/g, c => ROLE_AVATAR_ESC[c]);

/**
 * person: a name string, or { name, role?, initials? } (role/initials default to the directory's)
 * size:   'lg' 44px (Team, Chat) | 'head' 36px (conversation header) | 'msg' 28px (beside messages) | 'md' 30px (Home stack, crew logs) | 'sm' 24px (Roster pills) | 'top' 34px |
 *         'page' 64px | 'xl' 76px (Account sheet, Team profile)
 */
function renderRoleAvatar(person, size = 'lg', extraClass = '') {
    const p = (typeof person === 'string') ? { name: person } : (person || {});
    const role = p.role != null ? p.role : getPersonRole(p.name);
    const initials = p.initials || getPersonInitials(p.name);
    const category = getRoleCategory(role);
    return `<span class="role-avatar role-avatar--${size} ${extraClass}" data-role="${category}" style="--role-gradient: ${ROLE_CATEGORIES[category].gradient}" aria-hidden="true"><span class="role-avatar-initials">${roleAvatarEscape(initials)}</span></span>`;
}

// Poppy (the AI assistant): her orb, drawn into the canvas by mountPoppyAvatars (scripts/components/siri-orb.js)
function renderPoppyAvatar(size = 'lg', extraClass = '') {
    return `<span class="role-avatar role-avatar--${size} role-avatar--poppy ${extraClass}" aria-hidden="true"><canvas class="poppy-avatar-canvas"></canvas></span>`;
}

// A channel or site: a white Phosphor Fill icon (e.g. 'ph-buildings', 'ph-hard-hat') in the same lit orb as a
// person - every avatar is a circle. extraClass picks the glow: 'role-avatar--company' (emerald) or
// 'role-avatar--site' (steel); none is neutral graphite.
function renderIconAvatar(icon, size = 'lg', extraClass = '') {
    return `<span class="role-avatar role-avatar--${size} role-avatar--icon ${extraClass}" aria-hidden="true"><i class="ph-fill ${roleAvatarEscape(icon)}"></i></span>`;
}

// An avatar with a status dot at its lower right (Poppy; a person only in their conversation header)
function withAvatarStatus(avatarHtml, status = 'online') {
    return `<span class="role-avatar-wrap">${avatarHtml}<span class="role-avatar-status is-${status}" aria-hidden="true"></span></span>`;
}
