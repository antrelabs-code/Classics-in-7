// content.js
// Everything that is NOT the daily card itself: the menu (Why 366, About
// Author, My Moments, Settings, Version & Feedback), local "My Moments"
// storage, and the settings/menu navigation mechanics.

const SAVED_KEY = "cif7_saved_moments";
const REMINDER_KEY = "cif7_reminder_hour";

// TODO: replace with the real feedback form URL once it exists.
const FEEDBACK_FORM_URL = "https://forms.gle/REPLACE_WITH_YOUR_FORM";

const WHY_366_TEXT = `THE STORY BEHIND THE 366 DAYS

The idea is simple: 366 days should give you 366 good reasons to listen to music.

366 reasons — not 366 famous names. The calendar was not designed as an encyclopedia of composers or a list of birthdays. For every date, the starting question is: "Why this music, on this day?"

A date may have several possible connections: a composer's birthday, a performer's birthday, a death anniversary, a premiere, an important concert, an anniversary connected with an ensemble or institution, or another meaningful musical event. The strongest reason is not always the most obvious one.

THE "HOLE" PRINCIPLE

One of the most important rules is also one of the simplest: a weak card is worse than an empty date. If a date does not have a sufficiently strong candidate, the process does not simply choose an obscure name to make the calendar look complete.

WHY THE CALENDAR MATTERS

A good card should make the decision easy: "I have a few minutes. What should I listen to today?" Here. One date. One story. One musical moment. Seven minutes.

366 DAYS. 366 GOOD REASONS TO LISTEN.`;

const ABOUT_AUTHOR_TEXT = `The 366-day calendar started with a simple question: what would I like to find when I open a music app on an ordinary day?

I love music, and I enjoy building things with code. I've been teaching myself to code in my spare time, after work, and Classics in 7 grew out of that combination. There was no big team behind it.

I was originally looking for something like this for myself — a small, quiet way to discover or revisit classical music without falling into endless browsing, recommendations, notifications and noise.

I didn't want 366 famous names just because they had birthdays. I wanted 366 genuine reasons to listen. That meant researching dates, comparing candidates, checking facts, and sometimes deciding that a date simply wasn't strong enough. I've spent many evenings doing that work.

The result is still an experiment. I don't know yet whether Classics in 7 will become a daily habit for anyone other than me. That is exactly what I'm trying to find out.

If you're here, I hope you find something worth listening to today.

— The creator of Classics in 7`;

function textToParagraphs(text) {
    return text.split(/\n\n+/).map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");
}

// --- My Moments: local storage only, no backend ---

function loadSavedMoments() {
    try {
        return JSON.parse(localStorage.getItem(SAVED_KEY)) || [];
    } catch (e) {
        return [];
    }
}

function persistSavedMoments(list) {
    try {
        localStorage.setItem(SAVED_KEY, JSON.stringify(list));
    } catch (e) {
        console.error("Failed to save My Moments:", e);
    }
}

function momentKey(artistName, work) {
    return `${artistName}::${work?.title}`;
}

/** Called from card.js when the user taps Save. Returns true if it was a
 *  new save, false if this piece was already saved (no duplicates). */
export function saveMoment(artistName, work) {
    if (!work) return false;
    const list = loadSavedMoments();
    const key = momentKey(artistName, work);
    if (list.some(m => m.key === key)) return false;
    list.unshift({
        key,
        artist: artistName,
        title: work.title,
        duration: work.duration || "",
        mood: (work.mood_tags && work.mood_tags[0]) || ""
    });
    persistSavedMoments(list);
    return true;
}

function renderMyMoments() {
    const body = document.getElementById("my-moments-body");
    const list = loadSavedMoments();

    if (list.length === 0) {
        body.innerHTML = `<p class="saved-empty">Nothing saved yet.<br>Tap Save on a piece you'd like to remember.</p>`;
        return;
    }

    body.innerHTML = list.map(m => `
        <div class="saved-item" data-key="${m.key}">
            <p class="saved-item-artist">${m.artist}</p>
            <p class="saved-item-title">${m.title}</p>
            <p class="saved-item-meta">${[m.duration, m.mood].filter(Boolean).join(" · ")}</p>
            <div class="saved-item-actions">
                <button type="button" class="unsave-btn" data-key="${m.key}">Unsave</button>
                <button type="button" class="moment-share-btn" data-key="${m.key}">Share</button>
            </div>
        </div>
    `).join("");

    body.querySelectorAll(".unsave-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const remaining = loadSavedMoments().filter(m => m.key !== btn.dataset.key);
            persistSavedMoments(remaining);
            renderMyMoments();
        });
    });

    body.querySelectorAll(".moment-share-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
            const moment = loadSavedMoments().find(m => m.key === btn.dataset.key);
            if (!moment) return;
            // Different wording than the main-screen Share — no install link.
            const shareText = `I listened to ${moment.title} by ${moment.artist}. You might like it too.`;
            if (navigator.share) {
                try { await navigator.share({ text: shareText }); }
                catch (err) { if (err.name !== "AbortError") console.error(err); }
            } else {
                try { await navigator.clipboard.writeText(shareText); }
                catch (err) { console.error(err); }
            }
        });
    });
}

/** Wires up the whole menu: the gear button, list <-> detail navigation,
 *  Why 366 / About Author content, My Moments, Settings and
 *  Version & Feedback. Call once on page load. */
export function initMenu() {
    const settingsBtn = document.getElementById("settings-btn");
    const settingsMenu = document.getElementById("settings-menu");

    function closeSettingsMenu() {
        settingsMenu.classList.remove("expanded");
        settingsMenu.classList.remove("detail-open");
        settingsBtn.classList.remove("active");
        document.querySelectorAll(".menu-detail-panel.active").forEach(p => p.classList.remove("active"));
    }

    settingsBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpening = !settingsMenu.classList.contains("expanded");
        if (isOpening) {
            settingsMenu.classList.add("expanded");
            settingsBtn.classList.add("active");
        } else {
            closeSettingsMenu();
        }
    });

    document.addEventListener("click", (e) => {
        if (!settingsMenu.contains(e.target) && e.target !== settingsBtn) {
            closeSettingsMenu();
        }
    });

    document.getElementById("why366-body").innerHTML = textToParagraphs(WHY_366_TEXT);
    document.getElementById("about-author-body").innerHTML = textToParagraphs(ABOUT_AUTHOR_TEXT);

    // Settings — daily reminder (UI only for now, remembered locally; no
    // real notifications are wired up yet).
    const reminderPills = document.querySelectorAll(".reminder-pill");
    const savedHour = localStorage.getItem(REMINDER_KEY);
    reminderPills.forEach(pill => {
        if (pill.dataset.hour === savedHour) pill.classList.add("active");
        pill.addEventListener("click", () => {
            reminderPills.forEach(p => p.classList.remove("active"));
            pill.classList.add("active");
            localStorage.setItem(REMINDER_KEY, pill.dataset.hour);
        });
    });

    document.getElementById("clear-data-btn").addEventListener("click", () => {
        const ok = window.confirm(
            "We store everything only on your device. We do not track or sell your data.\n\n" +
            "This will permanently erase your saved moments and preferences from this app. Proceed?"
        );
        if (ok) {
            localStorage.clear();
            renderMyMoments();
            reminderPills.forEach(p => p.classList.remove("active"));
        }
    });

    document.getElementById("version-string").textContent =
        `v1.0 · built ${new Date().toISOString().slice(0, 10)}`;
    document.getElementById("feedback-link").href = FEEDBACK_FORM_URL;

    // Navigation: tapping a list item shows its panel; Back returns to the
    // list (menu stays open); Main closes the whole menu.
    document.querySelectorAll(".menu-item").forEach(item => {
        item.addEventListener("click", () => {
            const panelId = "panel-" + item.dataset.panel;
            settingsMenu.classList.add("detail-open");
            document.querySelectorAll(".menu-detail-panel").forEach(p => p.classList.remove("active"));
            document.getElementById(panelId).classList.add("active");
            if (item.dataset.panel === "my-moments") renderMyMoments();
        });
    });

    document.querySelectorAll(".menu-back").forEach(btn => {
        btn.addEventListener("click", () => {
            settingsMenu.classList.remove("detail-open");
            document.querySelectorAll(".menu-detail-panel").forEach(p => p.classList.remove("active"));
        });
    });

    document.querySelectorAll(".menu-main").forEach(btn => {
        btn.addEventListener("click", closeSettingsMenu);
    });
}
