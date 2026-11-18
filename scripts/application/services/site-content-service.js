/**
 * Application service: site content. Adding a daily site log, with any photos taken for it, for a site and
 * day. The log and its photos are saved in one transaction (all or nothing), audited, and put in the cache,
 * so the Site Hub's Site Logs section and search update at once. Drawings are read-only here (they come from
 * the drawing register).
 */

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

    return Object.freeze({ addLog });
}
