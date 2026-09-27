// Access layer reserved for future FREE / FULL / PREMIUM entitlements.
// Keep payment providers and UI out of this module.

const ACCESS_LEVEL = "full";

export function getAccessLevel() {
    return ACCESS_LEVEL;
}

export function isFeatureAvailable(_feature) {
    return true;
}

export function getWorkLimit() {
    return Infinity;
}
