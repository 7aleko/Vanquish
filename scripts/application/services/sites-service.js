/**
 * Application service: sites. Creating, renaming, archiving and restoring a site. Every screen shows the
 * change at once because they all read the same cached record.
 */

function createSitesService(kit) {
    const { provider, store } = kit;

    async function change(siteId, action, work) {
        const who = kit.actor();
        Permissions.assert(who, 'sites.manage');
        const saved = await provider.transaction(async repos => {
            const site = await work(repos);
            await kit.audit(repos, 'sites', site.id, action, who.id);
            return site;
        });
        store.upsert('sites', saved);
        return saved;
    }

    return Object.freeze({
        create(input) {
            const id = String(input.id || '').trim().toLowerCase();
            if (!id) throw appErrors.validation('Site id is required', [{ field: 'id', message: 'is required' }], 'Give the site an ID.');
            return change(id, AuditAction.CREATE, repos => repos.sites.create({ ...input, id }));
        },
        // Rename or edit a site (its id never changes - everything points at it)
        update(siteId, changes) { return change(siteId, AuditAction.UPDATE, repos => repos.sites.update(siteId, changes)); },
        // Hide a site from every picker; days, tools and roster entries that point at it keep resolving
        archive(siteId) { return change(siteId, AuditAction.ARCHIVE, repos => repos.sites.archive(siteId)); },
        restore(siteId) { return change(siteId, AuditAction.RESTORE, repos => repos.sites.restore(siteId)); }
    });
}
