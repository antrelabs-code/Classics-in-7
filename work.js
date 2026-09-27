// work.js
// Everything related to the WORK entity (an individual track/recording)
// — matches EXCEL 3 in the 3-spreadsheet data model.
//
// Note on architecture: a WORK is the musical piece; a future RECORDING
// layer (specific performer/year/ISRC/platform IDs) can sit on top of this
// without changing the calendar or item layers — see the original player
// master prompt, section "WORK ≠ RECORDING".

/** Only ACTIVE works are shown in the app; BACKUP/RETIRED stay in the data
 *  as a buffer for future swaps (e.g. a dead YouTube link) without needing
 *  to touch the calendar or item layers. */
export function getActiveWorks(works, itemId) {
    return works
        .filter(w => w.item_id === itemId && w.status === "ACTIVE")
        .sort((a, b) => a.rank - b.rank);
}

export function getMainWork(activeWorks) {
    return activeWorks[0] || null;
}

export function getOtherWorks(activeWorks, selectedWorkId) {
    return activeWorks.filter(w => w.work_id !== selectedWorkId);
}

export function formatMoodTags(work) {
    if (!work.mood_tags || !Array.isArray(work.mood_tags)) return "";
    return work.mood_tags.map(tag => `<span class="mood-tag">${tag}</span>`).join("");
}

export function formatDuration(work) {
    return work.duration
        ? `<span class="duration-clock" aria-hidden="true">◷</span><span>${work.duration}</span>`
        : "";
}
