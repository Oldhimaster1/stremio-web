// Copyright (C) 2017-2023 Smart code 203358507

const React = require('react');
const { useModelState } = require('stremio/common');

const PREINSTALLED_ADDONS = [
    "https://torrentio.strem.fun/lite/manifest.json"
];

const useInstalledAddons = (urlParams) => {
    const action = React.useMemo(() => {
        if (typeof urlParams.transportUrl !== 'string' && typeof urlParams.catalogId !== 'string') {

            // Original action
            const originalAction = {
                action: 'Load',
                args: {
                    model: 'InstalledAddonsWithFilters',
                    args: {
                        request: {
                            type: typeof urlParams.type === 'string' ? urlParams.type : null
                        }
                    }
                }
            };

            // Merge preinstalled addons
            const preinstalledAction = {
                action: 'Load',
                args: {
                    model: 'InstalledAddonsWithFilters',
                    args: {
                        request: {
                            type: typeof urlParams.type === 'string' ? urlParams.type : null,
                            urls: PREINSTALLED_ADDONS // <--- Add this line
                        }
                    }
                }
            };

            return preinstalledAction;

        } else {
            return {
                action: 'Unload'
            };
        }
    }, [urlParams]);

    return useModelState({ model: 'installed_addons', action });
};

module.exports = useInstalledAddons;