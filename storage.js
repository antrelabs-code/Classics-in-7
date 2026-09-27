// Local device storage for user-owned app data.
// This module intentionally contains no UI logic.

const SAVED_MOMENTS_KEY = "cif7_saved_moments";
const REMINDER_KEY = "cif7_reminder_hour";

export function loadSavedMoments() {
    try {
        return JSON.parse(localStorage.getItem(SAVED_MOMENTS_KEY)) || [];
    } catch (_) {
        return [];
    }
}

export function saveSavedMoments(list) {
    try {
        localStorage.setItem(SAVED_MOMENTS_KEY, JSON.stringify(list));
    } catch (error) {
        console.error("Nie udało się zapisać My Moments:", error);
    }
}

export function getMomentKey(artistName, track) {
    return `${artistName}::${track?.title}`;
}

export function getReminderHour() {
    return localStorage.getItem(REMINDER_KEY);
}

export function setReminderHour(hour) {
    localStorage.setItem(REMINDER_KEY, hour);
}

export function clearAppStorage() {
    localStorage.clear();
}
