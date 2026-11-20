/**
 * Data access: provider factory (composition point). Picks the implementation named in
 * APP_CONFIG.dataProvider and checks it fulfils every repository contract. Nothing else in the app knows
 * which provider is in use.
 *
 * Connecting a real backend:
 *   1. Write scripts/infrastructure/<name>/<name>-provider.js exporting create<Name>DataProvider(options),
 *      which implements REPOSITORY_CONTRACTS with its own SDK / fetch calls and maps rows <-> models.
 *   2. Add a case below and set APP_CONFIG.dataProvider.provider to '<name>'.
 * Screens, services and domain rules don't change.
 */

function createDataProvider(config, context) {
    let provider;
    switch (config.provider) {
        case 'mock':
            provider = createMockDataProvider({
                seed: buildMockSeed({ today: context.today(), payRunPolicy: context.payRunPolicy, siteDay: context.siteDay && context.siteDay() }),
                latencyMs: config.latencyMs,
                failureRate: config.failureRate,
                persistence: config.persistence
            });
            break;
        default:
            throw new AppError(ErrorCode.UNKNOWN, `Unknown data provider "${config.provider}"`);
    }
    return assertImplementsContracts(provider);
}
