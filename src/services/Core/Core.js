// Copyright (C) 2017-2023 Smart code 203358507

const EventEmitter = require('eventemitter3');
const CoreTransport = require('./CoreTransport');

const DEFAULT_PREINSTALLED_ADDON_URLS = [
    // Torrentio Lite
    'https://torrentio.strem.fun/lite/manifest.json'
];

function getPreinstalledAddonUrls() {
    const raw = typeof process !== 'undefined' && process.env && typeof process.env.PREINSTALLED_ADDONS === 'string'
        ? process.env.PREINSTALLED_ADDONS
        : '';
    const fromEnv = raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    return fromEnv.length > 0 ? fromEnv : DEFAULT_PREINSTALLED_ADDON_URLS;
}

async function installAddonFromTransportUrl(transport, transportUrl) {
    if (!transport || typeof transport.dispatch !== 'function' || typeof transport.getState !== 'function') {
        return false;
    }

    // Load the addon details model so Core fetches the manifest and exposes a full addon object.
    // Then dispatch InstallAddon with the resolved addon payload.
    const model = 'addon_details';
    const actionLoad = {
        action: 'Load',
        args: {
            model: 'AddonDetails',
            args: { transportUrl }
        }
    };

    return new Promise((resolve) => {
        let finished = false;

        const cleanup = () => {
            if (finished) return;
            finished = true;
            try { transport.off('NewState', onNewState); } catch {}
            try { transport.dispatch({ action: 'Unload' }, model); } catch {}
        };

        const onNewState = async (models) => {
            if (!Array.isArray(models) || models.indexOf(model) === -1) return;
            try {
                const state = await transport.getState(model);
                const remoteAddon = state && state.remoteAddon;
                const content = remoteAddon && remoteAddon.content;

                if (content && content.type === 'Ready' && content.content) {
                    transport.dispatch({
                        action: 'Ctx',
                        args: {
                            action: 'InstallAddon',
                            args: content.content
                        }
                    });
                    cleanup();
                    resolve(true);
                } else if (content && content.type === 'Err') {
                    cleanup();
                    resolve(false);
                }
            } catch (e) {
                cleanup();
                resolve(false);
            }
        };

        try {
            transport.on('NewState', onNewState);
            transport.dispatch(actionLoad, model);
            // Kick an immediate check in case state is already available.
            Promise.resolve().then(() => onNewState([model]));
        } catch (e) {
            cleanup();
            resolve(false);
        }
    });
}

function Core(args) {
    let active = false;
    let error = null;
    let starting = false;
    let transport = null;

    let preinstallStarted = false;

    const events = new EventEmitter();

    function onTransportInit() {
        active = true;
        error = null;
        starting = false;
        onStateChanged();

        if (!preinstallStarted) {
            preinstallStarted = true;
            const urls = getPreinstalledAddonUrls();
            Promise.resolve().then(async () => {
                for (const url of urls) {
                    try {
                        // Best-effort; do not block app startup.
                        // If the addon is already installed, Core should no-op.
                        await installAddonFromTransportUrl(transport, url);
                    } catch {}
                }
            });
        }
    }
    function onTransportError(args) {
        console.error(args);
        active = false;
        error = new Error('Stremio Core Transport initialization failed', { cause: args });
        starting = false;
        onStateChanged();
        transport = null;
    }
    function onStateChanged() {
        events.emit('stateChanged');
    }

    Object.defineProperties(this, {
        active: {
            configurable: false,
            enumerable: true,
            get: function() {
                return active;
            }
        },
        error: {
            configurable: false,
            enumerable: true,
            get: function() {
                return error;
            }
        },
        starting: {
            configurable: false,
            enumerable: true,
            get: function() {
                return starting;
            }
        },
        transport: {
            configurable: false,
            enumerable: true,
            get: function() {
                return transport;
            }
        }
    });

    this.start = function() {
        if (active || error instanceof Error || starting) {
            return;
        }

        starting = true;
        transport = new CoreTransport(args);
        transport.on('init', onTransportInit);
        transport.on('error', onTransportError);
        onStateChanged();
    };
    this.stop = function() {
        active = false;
        error = null;
        starting = false;
        onStateChanged();
        if (transport !== null) {
            transport.removeAllListeners();
            transport = null;
        }
    };
    this.on = function(name, listener) {
        events.on(name, listener);
    };
    this.off = function(name, listener) {
        events.off(name, listener);
    };
}

module.exports = Core;
