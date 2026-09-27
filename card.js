// card.js
// Main entry point. Loads the three data files (CALENDAR / ITEM / WORK —
// the JSON exports of the three Excel spreadsheets), joins them by key for
// today's date, and renders the daily card. Also wires up the buttons that
// belong to the card itself (Save / PLAY ME / Share, bio toggle, Other
// Works). Menu content and mechanics live in content.js; YouTube playback
// lives in engine.js; category/country/bio formatting lives in item.js;
// track selection helpers live in work.js.

import { YouTubeEngine } from "./engine.js";
import { getCategoryConfig, formatMeta, resolveWikiUrl } from "./item.js";
import { getActiveWorks, getMainWork, getOtherWorks, formatMoodTags, formatDuration } from "./work.js";
import { saveMoment, initMenu } from "./content.js";

document.addEventListener("DOMContentLoaded", async () => {
    try {
        const [calendar, items, works] = await Promise.all([
            fetch("calendar.json").then(r => r.json()),
            fetch("items.json").then(r => r.json()),
            fetch("works.json").then(r => r.json())
        ]);

        // Date is read from the user's own local clock, so everyone in the
        // world sees the card that matches the day they are actually having.
        const today = new Date();
        const day = String(today.getDate()).padStart(2, "0");
        const month = String(today.getMonth() + 1).padStart(2, "0");
        const dayMonthKey = `${month}-${day}`;

        const calendarEntry = calendar.find(c => c.day_month_key === dayMonthKey);
        if (!calendarEntry) {
            console.error(`No calendar entry for day_month_key: ${dayMonthKey}`);
            return;
        }

        const item = items.find(i => i.item_id === calendarEntry.item_id);
        if (!item) {
            console.error(`No item found for item_id: ${calendarEntry.item_id}`);
            return;
        }

        const activeWorks = getActiveWorks(works, item.item_id);
        if (activeWorks.length === 0) {
            console.error(`No active works found for item_id: ${item.item_id}`);
            return;
        }

        const artistName = item.display_name;

        // --- Header: badge, name, meta, bio, event note ---
        const config = getCategoryConfig(calendarEntry.card_type);

        document.getElementById("anchor-badge").textContent = config.badge;
        document.getElementById("composer-name").textContent = artistName;
        document.getElementById("composer-meta").textContent = formatMeta(item);

        const aboutLabelEl = document.getElementById("about-panel-title");
        if (aboutLabelEl) aboutLabelEl.textContent = config.aboutLabel;

        const composerBioEl = document.getElementById("composer-bio");
        if (composerBioEl) composerBioEl.textContent = item.bio || "";

        const eventNoteEl = document.getElementById("event-note");
        if (eventNoteEl) {
            if (calendarEntry.card_type !== "BORN_TODAY" && item.event_note) {
                eventNoteEl.textContent = item.event_note;
                eventNoteEl.style.display = "block";
            } else {
                eventNoteEl.style.display = "none";
            }
        }

        // Bio expands in place, downward — the card simply grows, no page
        // scroll (unlike Other Works, which is anchored from the bottom).
        const bioToggle = document.getElementById("bio-toggle");
        const bioWrap = document.querySelector(".bio-wrap");
        if (bioToggle && bioWrap) {
            bioToggle.addEventListener("click", () => {
                bioWrap.classList.toggle("expanded");
            });
        }

        // "READ MORE" is a constant, generic label in the HTML (ready for
        // different sources later — Wikipedia today, Britannica etc. down
        // the line) — here we just wire up the right link and visibility.
        const wikiLinkEl = document.getElementById("wiki-link");
        const wikiUrl = resolveWikiUrl(item);
        if (wikiUrl) {
            wikiLinkEl.href = wikiUrl;
            wikiLinkEl.style.display = "flex";
        } else {
            wikiLinkEl.style.display = "none";
        }

        // --- Main track + Other Works ---
        let selectedWorkId = getMainWork(activeWorks).work_id;

        function getSelectedWork() {
            return activeWorks.find(w => w.work_id === selectedWorkId) || activeWorks[0];
        }

        function renderMainTrack(work) {
            document.getElementById("main-track-title").textContent = work.title;
            document.getElementById("main-track-duration").innerHTML = formatDuration(work);
            document.getElementById("main-track-moods").innerHTML = formatMoodTags(work);
            document.getElementById("main-track-fact").innerHTML = `<strong>Insight:</strong> ${work.insight || ""}`;
        }

        function bringMainCardIntoView() {
            const card = document.getElementById("main-track-card");
            if (!card) return;
            const rect = card.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const topGap = 10;
            const bottomGap = 10;
            let delta = 0;
            if (rect.bottom > viewportHeight - bottomGap) delta = rect.bottom - (viewportHeight - bottomGap);
            if (rect.top - delta < topGap) delta = rect.top - topGap;
            if (Math.abs(delta) > 2) window.scrollBy({ top: delta, behavior: "smooth" });
        }

        function renderDiscoverList() {
            const tracksContainer = document.getElementById("tracks-container");
            tracksContainer.innerHTML = "";
            const otherWorks = getOtherWorks(activeWorks, selectedWorkId);

            const discoverLabelEl = document.getElementById("discover-more-label");
            if (discoverLabelEl) discoverLabelEl.textContent = "OTHER WORKS";

            otherWorks.forEach((work) => {
                const trackEl = document.createElement("div");
                trackEl.className = "track-card";
                const moodHTML = work.mood_tags && work.mood_tags.length
                    ? `<div class="track-mood-row">${formatMoodTags(work)}</div>`
                    : "";
                trackEl.innerHTML = `
                    <div class="track-header">
                        <div class="track-main-info">
                            <div class="track-title-row">
                                <span class="track-rank">#${work.rank}</span>
                                <h3 class="track-title">${work.title}</h3>
                            </div>
                        </div>
                        <div class="track-right-column">
                            <div class="track-duration">${formatDuration(work)}</div>
                            ${moodHTML}
                        </div>
                    </div>`;

                trackEl.addEventListener("click", () => {
                    if (work.work_id === selectedWorkId) return;
                    engine.stop();
                    selectedWorkId = work.work_id;
                    renderMainTrack(work);
                    renderDiscoverList();
                    setDiscoverExpanded(false);
                });
                tracksContainer.appendChild(trackEl);
            });
        }

        renderMainTrack(getMainWork(activeWorks));
        renderDiscoverList();

        // --- Playback engine (YouTube) ---
        function updatePlayButton() {
            const playButton = document.getElementById("btn-2");
            if (!playButton) return;
            const primary = playButton.querySelector(".play-primary");
            const secondary = playButton.querySelector(".play-secondary");
            const split = engine.isPlaying || engine.isPaused;
            playButton.classList.toggle("is-playing", engine.isPlaying);
            playButton.classList.toggle("is-split", split);

            if (primary && secondary) {
                primary.textContent = engine.isPaused ? "RESUME" : "PAUSE";
                secondary.textContent = "STOP";
                primary.hidden = !split;
                secondary.hidden = !split;
                if (!split) {
                    primary.textContent = "PLAY ME";
                    primary.hidden = false;
                    secondary.hidden = true;
                }
            }

            playButton.setAttribute(
                "aria-label",
                engine.isPlaying ? "Pause or stop playback" : engine.isPaused ? "Resume or stop playback" : "Play selected track"
            );
        }

        const engine = new YouTubeEngine({
            getSelectedTrack: getSelectedWork,
            onStateChange: updatePlayButton,
            onPlaybackStarted: bringMainCardIntoView
        });
        engine.init();
        updatePlayButton();

        document.getElementById("btn-2").addEventListener("click", async (event) => {
            const splitButton = event.currentTarget;
            if (engine.isPlaying || engine.isPaused) {
                const rect = splitButton.getBoundingClientRect();
                const clickedLeftHalf = event.clientX < rect.left + rect.width / 2;
                if (clickedLeftHalf) {
                    if (engine.isPlaying) engine.pause();
                    else engine.resume();
                } else {
                    engine.stop();
                }
                return;
            }
            await engine.play();
        });

        // --- Save / Share (main screen) ---
        document.getElementById("btn-1").addEventListener("click", () => {
            const wasNew = saveMoment(artistName, getSelectedWork());
            if (!wasNew) return;
            const saveBtn = document.getElementById("btn-1");
            const original = saveBtn.textContent;
            saveBtn.textContent = "Saved";
            setTimeout(() => { saveBtn.textContent = original; }, 1200);
        });

        document.getElementById("btn-3").addEventListener("click", async () => {
            const work = getSelectedWork();
            const shareText = `${work?.title || ""} — ${artistName}`;
            if (navigator.share) {
                try {
                    await navigator.share({ title: work?.title || artistName, text: shareText });
                } catch (error) {
                    if (error.name !== "AbortError") console.error("Share error:", error);
                }
            } else {
                try {
                    await navigator.clipboard.writeText(shareText);
                } catch (error) {
                    console.error("Share fallback error:", error);
                }
            }
        });

        // --- Other Works: expand/collapse, anchored from the bottom ---
        const discoverToggle = document.getElementById("discover-toggle");
        const discoverContent = document.getElementById("discover-content");
        const discoverArrow = document.getElementById("discover-arrow");
        const discoverWrapper = document.querySelector(".discover-more-section");

        let discoverScrollOffset = 0;

        function setDiscoverExpanded(expanded) {
            const beforeHeight = discoverWrapper.getBoundingClientRect().height;

            discoverContent.classList.toggle("expanded", expanded);
            discoverArrow.style.transform = expanded ? "rotate(180deg)" : "rotate(0deg)";

            // Anchored from the bottom: once the CSS transition finishes,
            // scroll by the exact added/removed height so the lower edge
            // stays in place and the list visually unfolds upward.
            const onTransitionEnd = (event) => {
                if (event.propertyName !== "max-height") return;

                const afterHeight = discoverWrapper.getBoundingClientRect().height;
                const heightDelta = afterHeight - beforeHeight;

                if (expanded && heightDelta > 0) {
                    discoverScrollOffset = heightDelta;
                    window.scrollBy({ top: heightDelta, behavior: "smooth" });
                } else if (!expanded && discoverScrollOffset > 0) {
                    window.scrollBy({ top: -discoverScrollOffset, behavior: "smooth" });
                    discoverScrollOffset = 0;
                }

                discoverContent.removeEventListener("transitionend", onTransitionEnd);
            };

            discoverContent.addEventListener("transitionend", onTransitionEnd);
        }

        discoverToggle.addEventListener("click", () => {
            setDiscoverExpanded(!discoverContent.classList.contains("expanded"));
        });

        // --- Menu (Why 366 / About Author / My Moments / Settings / Version & Feedback) ---
        initMenu();

    } catch (error) {
        console.error("Error loading Classics in 7 content:", error);
    }
});
