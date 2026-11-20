/**
 * Application service: site content. Adding a daily site log, with any photos taken for it, for a site and
 * day. The log and its photos are saved in one transaction (all or nothing), audited, and put in the cache,
 * so the Site Hub's Site Logs section and search update at once. addDrawing records a sheet in the drawing
 * register (its details - the file itself is not stored in the app); a new revision of a sheet replaces the old.
 */
const DRAWING_DISCIPLINES = Object.freeze(['Architectural', 'Structural', 'Civil', 'Electrical', 'Hydraulic', 'Mechanical', 'Landscape']);

const SITE_LOG_MAX_PHOTOS = 6;

function createSiteContentService(kit) {
    const { provider, store } = kit;

    async function addLog({ siteId, date, title, body = '', photos = [] }) {
        const who = kit.actor();
        Permissions.assert(who, 'siteLogs.create');
        const errors = [];
        const site = store.get('sites').find(s => s.id === siteId);
        if (!site) errors.push({ field: 'siteId', message: 'choose a site' });
        else if (!site.active) errors.push({ field: 'siteId', message: 'is archived' });
        if (!DateRules.isIsoDate(date)) errors.push({ field: 'date', message: 'is required' });
        const cleanTitle = String(title || '').trim(), cleanBody = String(body || '').trim();
        if (cleanTitle.length < 3) errors.push({ field: 'title', message: 'Add a short title' });
        if (cleanTitle.length > 120) errors.push({ field: 'title', message: 'Keep the title under 120 characters' });
        if (cleanBody.length > 4000) errors.push({ field: 'body', message: 'Keep the notes under 4000 characters' });
        if (photos.length > SITE_LOG_MAX_PHOTOS) errors.push({ field: 'photos', message: `Attach up to ${SITE_LOG_MAX_PHOTOS} photos` });
        if (photos.some(p => !p || typeof p.src !== 'string' || !/^(data:image\/|https?:)/.test(p.src))) {
            errors.push({ field: 'photos', message: 'A photo could not be read' });
        }
        if (errors.length) throw appErrors.validation('Site log is invalid', errors, errors[0].message + '.');

        const saved = await provider.transaction(async repos => {
            const log = await repos.siteLogs.create({ siteId, date, title: cleanTitle, body: cleanBody, authorId: who.id });
            await kit.audit(repos, 'siteLogs', log.id, AuditAction.CREATE, who.id);
            const added = [];
            for (const p of photos) {
                const photo = await repos.sitePhotos.create({
                    siteId, date, caption: String(p.caption || cleanTitle).slice(0, 200), tag: String(p.tag || 'Progress').slice(0, 40),
                    src: p.src, logId: log.id, takenBy: who.id
                });
                await kit.audit(repos, 'sitePhotos', photo.id, AuditAction.CREATE, who.id);
                added.push(photo);
            }
            return { log, photos: added };
        });
        store.upsert('siteLogs', saved.log);
        saved.photos.forEach(p => store.upsert('sitePhotos', p));
        return saved.log;
    }

    async function addDrawing({ siteId, sheet, title, discipline, revision, date }) {
        const who = kit.actor();
        Permissions.assert(who, 'drawings.create');
        const errors = [];
        const site = store.get('sites').find(s => s.id === siteId);
        if (!site || !site.active) errors.push({ field: 'siteId', message: 'Choose an active site' });
        const cleanSheet = String(sheet || '').trim().toUpperCase().replace(/\s+/g, '');
        const cleanTitle = String(title || '').trim().replace(/\s+/g, ' ');
        const cleanRev = String(revision || '').trim().toUpperCase();
        if (!/^[A-Z0-9][A-Z0-9.\-]{0,11}$/.test(cleanSheet)) errors.push({ field: 'sheet', message: 'Enter the sheet number (e.g. A103)' });
        if (cleanTitle.length < 3 || cleanTitle.length > 120) errors.push({ field: 'title', message: 'Enter the drawing title' });
        if (!DRAWING_DISCIPLINES.includes(discipline)) errors.push({ field: 'discipline', message: 'Choose a discipline' });
        if (!/^[A-Z0-9]{1,4}$/.test(cleanRev)) errors.push({ field: 'revision', message: 'Enter the revision (e.g. A)' });
        if (!DateRules.isIsoDate(date)) errors.push({ field: 'date', message: 'is required' });
        if (errors.length) throw appErrors.validation('Drawing is invalid', errors, errors[0].message + '.');
        const saved = await provider.transaction(async repos => {
            const d = await repos.drawings.create({ siteId, sheet: cleanSheet, title: cleanTitle, discipline, revision: cleanRev, updatedOn: date });
            await kit.audit(repos, 'drawings', d.id, AuditAction.CREATE, who.id, { revision: cleanRev });
            return d;
        });
        store.upsert('drawings', saved);
        return saved;
    }

    return Object.freeze({ addLog, addDrawing });
}
