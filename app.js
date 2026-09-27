document.addEventListener("DOMContentLoaded", async () => {
    try {
        const response = await fetch("muz-content.json");
        const data = await response.json();

        // Pobieranie daty według czasu lokalnego użytkownika
        const today = new Date();
        const day = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const currentDate = `${day}-${month}`;

        // Pobranie karty dla dzisiejszej daty
        const dayRecord = data.find(item => item.date === currentDate);

        // Brak karty dla danego dnia — nie pokazujemy karty z innej daty
        if (!dayRecord) {
            console.error(`Brak karty dla daty: ${currentDate}`);
            return;
        }

        // Skrót kraju bez zmiany danych źródłowych (JSON zostaje w pełnej formie,
        // np. "Italy" — skracamy tylko na etapie wyświetlania).
        const countryAbbreviations = {
            "Italy": "ITA", "Austria": "AUT", "Germany": "GER", "France": "FRA",
            "Poland": "POL", "Russia": "RUS", "Spain": "ESP", "Hungary": "HUN",
            "Czech Republic": "CZE", "United Kingdom": "GBR", "Great Britain": "GBR",
            "United States": "USA", "Latvia": "LVA", "Switzerland": "CHE",
            "Sweden": "SWE", "Norway": "NOR", "Finland": "FIN", "Netherlands": "NLD",
            "Belgium": "BEL", "Portugal": "PRT", "India": "IND", "Brazil": "BRA",
            "Argentina": "ARG", "Ukraine": "UKR"
        };
        const rawCountry = dayRecord.composer.birth_country || "";
        const displayCountry = countryAbbreviations[rawCountry] || rawCountry;

        document.getElementById("composer-name").textContent = dayRecord.composer.name;
        document.getElementById("composer-meta").textContent = `${dayRecord.composer.birth_year}–${dayRecord.composer.death_year} (${dayRecord.composer.period}) • ${displayCountry}`;

        const composerBioEl = document.getElementById("composer-bio");
        if (composerBioEl) {
            composerBioEl.textContent = dayRecord.composer.artist_bio || "";
        }

        // Etykieta z lewej mówi WPROST czym jest karta: Artist / Celebration / Anniversary.
        // Sentence case, jak "Insight:" — treść, nie odznaka strukturalna.
        // "MORE BELOW" po prawej jest już stałe w HTML — nie zmienia się per typ karty,
        // dzięki temu jedno słowo "MORE" pojawia się raz, a nie w czterech wariantach.
        const categoryConfig = {
            birth:       { badge: "BORN TODAY",  aboutLabel: "Artist:" },
            premiere:    { badge: "CELEBRATION", aboutLabel: "Celebration:" },
            celebration: { badge: "CELEBRATION", aboutLabel: "Celebration:" },
            anniversary: { badge: "ANNIVERSARY", aboutLabel: "Anniversary:" },
            movie:       { badge: "MOVIE",       aboutLabel: "Score:" }
        };
        const config = categoryConfig[dayRecord.anchor_type] || categoryConfig.birth;

        const badgeEl = document.getElementById("anchor-badge");
        const eventNoteEl = document.getElementById("event-note");
        const aboutLabelEl = document.getElementById("about-panel-title");

        badgeEl.textContent = config.badge;
        if (aboutLabelEl) aboutLabelEl.textContent = config.aboutLabel;

        if (eventNoteEl) {
            if (dayRecord.anchor_type !== "birth" && dayRecord.event_note) {
                eventNoteEl.textContent = dayRecord.event_note;
                eventNoteEl.style.display = "block";
            } else {
                eventNoteEl.style.display = "none";
            }
        }

        // Bio rozwija się w miejscu (w dół), karta po prostu rośnie, bez przewijania
        // strony (inaczej niż Discover More/More From This Artist, które kotwiczy
        // od dołu). Etykieta przycisku ("MORE BELOW") jest stała — tylko strzałka
        // się obraca, zgodnie z konwencją Material Design.
        const bioToggle = document.getElementById("bio-toggle");
        const bioWrap = document.querySelector(".bio-wrap");
        if (bioToggle && bioWrap) {
            bioToggle.addEventListener("click", () => {
                bioWrap.classList.toggle("expanded");
            });
        }

        const wikiLinkEl = document.getElementById("wiki-link");
        // "READ MORE" jest stałą, generyczną etykietą w HTML (gotową pod różne
        // źródła — Wikipedia dziś, docelowo też Britannica itd.) — tu tylko
        // podpinamy właściwy link i pokazujemy/ukrywamy cały pasek.
        if (dayRecord.composer && dayRecord.composer.wiki_url) {
            wikiLinkEl.href = dayRecord.composer.wiki_url;
            wikiLinkEl.style.display = "flex";
        } else if (dayRecord.composer && dayRecord.composer.name) {
            wikiLinkEl.href = `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(dayRecord.composer.name)}`;
            wikiLinkEl.style.display = "flex";
        } else {
            wikiLinkEl.style.display = "none";
        }

        let currentTracks = [...dayRecord.tracks];
        const composerName = dayRecord.composer.name;

        function renderMainTrack(track) {
            document.getElementById("main-track-title").textContent = track.title;
            document.getElementById("main-track-duration").innerHTML = track.duration
                ? `<span class="duration-clock" aria-hidden="true">◷</span><span>${track.duration}</span>`
                : "";
            
            const moodsContainer = document.getElementById("main-track-moods");
            if (track.mood_tags && Array.isArray(track.mood_tags)) {
                moodsContainer.innerHTML = track.mood_tags.map(tag => `<span class="mood-tag">${tag}</span>`).join("");
            } else {
                moodsContainer.innerHTML = "";
            }

            document.getElementById("main-track-fact").innerHTML = `<strong>Insight:</strong> ${track.fact}`;

            const searchQuery = encodeURIComponent(`${composerName} ${track.title}`);
            window.currentTrackSearchQuery = searchQuery;
        }

        function getSelectedTrack() {
            return currentTracks.find(t => t.id === selectedTrackId) || currentTracks[0];
        }

        // --- My Moments: zapis lokalny (localStorage), bez backendu ---
        const SAVED_KEY = "cif7_saved_moments";

        function loadSavedMoments() {
            try {
                return JSON.parse(localStorage.getItem(SAVED_KEY)) || [];
            } catch (e) {
                return [];
            }
        }

        function saveSavedMoments(list) {
            try {
                localStorage.setItem(SAVED_KEY, JSON.stringify(list));
            } catch (e) {
                console.error("Nie udało się zapisać My Moments:", e);
            }
        }

        function momentKey(track) {
            return `${composerName}::${track?.title}`;
        }

        document.getElementById("btn-1").addEventListener("click", () => {
            const track = getSelectedTrack();
            if (!track) return;
            const list = loadSavedMoments();
            const key = momentKey(track);
            if (list.some(m => m.key === key)) return; // już zapisane, bez duplikatu
            list.unshift({
                key,
                artist: composerName,
                title: track.title,
                duration: track.duration || "",
                mood: (track.mood_tags && track.mood_tags[0]) || ""
            });
            saveSavedMoments(list);

            const saveBtn = document.getElementById("btn-1");
            const original = saveBtn.textContent;
            saveBtn.textContent = "Saved";
            setTimeout(() => { saveBtn.textContent = original; }, 1200);
        });

        // PLAY ME — YouTube is the playback engine, but its visual player stays hidden.
        // The CLASSICS IN 7 UI owns PLAY/STOP and track selection.
        let ytPlayer = null;
        let ytApiReady = false;
        let isPlaying = false;
        let isPaused = false;
        let selectedTrackId = currentTracks[0]?.id || null;
        let pendingPlay = false;

        const youtubeHost = document.createElement("div");
        youtubeHost.id = "youtube-player-hidden";
        youtubeHost.setAttribute("aria-hidden", "true");
        document.body.appendChild(youtubeHost);

        function updatePlayButton() {
            const playButton = document.getElementById("btn-2");
            if (!playButton) return;
            const primary = playButton.querySelector(".play-primary");
            const secondary = playButton.querySelector(".play-secondary");
            const split = isPlaying || isPaused;
            playButton.classList.toggle("is-playing", isPlaying);
            playButton.classList.toggle("is-split", split);

            if (primary && secondary) {
                primary.textContent = isPaused ? "RESUME" : "PAUSE";
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
                isPlaying ? "Pause or stop playback" : isPaused ? "Resume or stop playback" : "Play selected track"
            );
        }

        function stopPlayback() {
            pendingPlay = false;
            if (ytPlayer && typeof ytPlayer.stopVideo === "function") {
                try { ytPlayer.stopVideo(); } catch (_) {}
            }
            isPlaying = false;
            isPaused = false;
            updatePlayButton();
        }

        function pausePlayback() {
            if (!ytPlayer || typeof ytPlayer.pauseVideo !== "function") return;
            try { ytPlayer.pauseVideo(); } catch (_) {}
            isPlaying = false;
            isPaused = true;
            updatePlayButton();
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

        function getSelectedTrack() {
            return currentTracks.find(t => t.id === selectedTrackId) || currentTracks[0];
        }

        function createYouTubePlayer() {
            if (!window.YT || !window.YT.Player) return false;
            if (ytPlayer) return true;
            ytPlayer = new YT.Player("youtube-player-hidden", {
                width: "1",
                height: "1",
                videoId: "",
                playerVars: {
                    autoplay: 0,
                    controls: 0,
                    disablekb: 1,
                    fs: 0,
                    playsinline: 1,
                    rel: 0
                },
                events: {
                    onReady: () => {
                        ytApiReady = true;
                        if (pendingPlay) playSelectedTrack();
                    },
                    onStateChange: (event) => {
                        if (event.data === YT.PlayerState.PLAYING) {
                            isPlaying = true;
                            isPaused = false;
                            pendingPlay = false;
                            updatePlayButton();
                            bringMainCardIntoView();
                        } else if (event.data === YT.PlayerState.PAUSED) {
                            if (isPlaying) {
                                isPlaying = false;
                                isPaused = true;
                                updatePlayButton();
                            }
                        } else if (event.data === YT.PlayerState.ENDED) {
                            isPlaying = false;
                            isPaused = false;
                            updatePlayButton();
                        }
                    },
                    onError: (event) => {
                        isPlaying = false;
                        isPaused = false;
                        pendingPlay = false;
                        updatePlayButton();
                        console.error("YouTube playback error:", event.data);
                    }
                }
            });
            return true;
        }

        window.onYouTubeIframeAPIReady = () => {
            ytApiReady = true;
            createYouTubePlayer();
        };

        // Load the official YouTube IFrame API once.
        if (!document.getElementById("youtube-iframe-api")) {
            const script = document.createElement("script");
            script.id = "youtube-iframe-api";
            script.src = "https://www.youtube.com/iframe_api";
            document.head.appendChild(script);
        }

        async function playSelectedTrack() {
            const track = getSelectedTrack();
            if (!track || !track.youtube_id) {
                console.log("PLAY ME: selected track has no YouTube ID.");
                return;
            }

            pendingPlay = true;
            if (!ytPlayer) {
                if (!createYouTubePlayer()) return;
            }
            if (!ytApiReady || !ytPlayer || typeof ytPlayer.loadVideoById !== "function") return;

            try {
                ytPlayer.loadVideoById(track.youtube_id);
                isPlaying = true;
                pendingPlay = false;
                updatePlayButton();
                bringMainCardIntoView();
            } catch (error) {
                isPlaying = false;
                pendingPlay = false;
                updatePlayButton();
                console.error("YouTube playback error:", error);
            }
        }

        document.getElementById("btn-2").addEventListener("click", async (event) => {
            const splitButton = event.currentTarget;
            if (isPlaying || isPaused) {
                const rect = splitButton.getBoundingClientRect();
                const clickedLeftHalf = event.clientX < rect.left + rect.width / 2;
                if (clickedLeftHalf) {
                    if (isPlaying) pausePlayback();
                    else {
                        try { ytPlayer.playVideo(); } catch (_) {}
                        isPlaying = true;
                        isPaused = false;
                        updatePlayButton();
                    }
                } else {
                    stopPlayback();
                }
                return;
            }
            await playSelectedTrack();
        });

        document.getElementById("btn-3").addEventListener("click", async () => {
            const track = getSelectedTrack();
            const shareText = `${track?.title || ""} — ${composerName}`;
            if (navigator.share) {
                try {
                    await navigator.share({ title: track?.title || composerName, text: shareText });
                } catch (error) {
                    if (error.name !== "AbortError") console.error("Share error:", error);
                }
            } else {
                try {
                    await navigator.clipboard.writeText(shareText);
                    console.log("Share: skopiowano do schowka", shareText);
                } catch (error) {
                    console.error("Share fallback error:", error);
                }
            }
        });

        function renderDiscoverList() {
            const tracksContainer = document.getElementById("tracks-container");
            tracksContainer.innerHTML = "";
            const subTracks = currentTracks.filter(track => track.id !== selectedTrackId);

            const discoverLabelEl = document.getElementById("discover-more-label");
            if (discoverLabelEl) {
                discoverLabelEl.textContent = "OTHER WORKS";
            }

            subTracks.forEach((track) => {
                const fixedNumber = currentTracks.findIndex(t => t.id === track.id) + 1;
                const trackEl = document.createElement("div");
                trackEl.className = "track-card";
                const moodHTML = track.mood_tags && track.mood_tags.length
                    ? `<div class="track-mood-row">${track.mood_tags.map(tag => `<span class="mood-tag">${tag}</span>`).join("")}</div>`
                    : "";
                trackEl.innerHTML = `
                    <div class="track-header">
                        <div class="track-main-info">
                            <div class="track-title-row">
                                <span class="track-rank">#${fixedNumber}</span>
                                <h3 class="track-title">${track.title}</h3>
                            </div>
                        </div>
                        <div class="track-right-column">
                            <div class="track-duration">
                                ${track.duration ? `<span class="duration-clock" aria-hidden="true">◷</span><span>${track.duration}</span>` : ""}
                            </div>
                            ${moodHTML}
                        </div>
                    </div>`;

                trackEl.addEventListener("click", () => {
                    if (track.id === selectedTrackId) return;
                    stopPlayback();
                    selectedTrackId = track.id;
                    renderMainTrack(track);
                    renderDiscoverList();
                    setDiscoverExpanded(false);
                });
                tracksContainer.appendChild(trackEl);
            });
        }

        if (currentTracks.length > 0) {
            selectedTrackId = currentTracks[0].id;
            renderMainTrack(currentTracks[0]);
            renderDiscoverList();
        }
        updatePlayButton();

        // Obsługa rozwijania sekcji Discover More
        const discoverToggle = document.getElementById("discover-toggle");
        const discoverContent = document.getElementById("discover-content");
        const discoverArrow = document.getElementById("discover-arrow");
        const discoverWrapper = document.querySelector(".discover-more-section");

        let discoverScrollOffset = 0;

        function setDiscoverExpanded(expanded, onComplete = null) {
            const beforeHeight = discoverWrapper.getBoundingClientRect().height;

            discoverContent.classList.toggle("expanded", expanded);
            discoverArrow.style.transform = expanded ? "rotate(180deg)" : "rotate(0deg)";

            // Anchored from the bottom: after the CSS transition finishes,
            // scroll by the exact added/removed height so the lower edge stays
            // in place and the Discover list visually unfolds upward.
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
                if (typeof onComplete === "function") onComplete();
            };

            discoverContent.addEventListener("transitionend", onTransitionEnd);
        }

        discoverToggle.addEventListener("click", () => {
            const isExpanded = !discoverContent.classList.contains("expanded");
            setDiscoverExpanded(isExpanded);
        });

        // Obsługa menu pod zębatką w prawym górnym rogu
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

        // WHY 366 / ABOUT AUTHOR — treści statyczne (z paczki komunikacyjnej FB)
        function textToParagraphs(text) {
            return text.split(/\n\n+/).map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");
        }

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

        document.getElementById("why366-body").innerHTML = textToParagraphs(WHY_366_TEXT);
        document.getElementById("about-author-body").innerHTML = textToParagraphs(ABOUT_AUTHOR_TEXT);

        // MY MOMENTS — renderowane na nowo za każdym otwarciem (dane mogły się zmienić)
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
                    saveSavedMoments(remaining);
                    renderMyMoments();
                });
            });

            body.querySelectorAll(".moment-share-btn").forEach(btn => {
                btn.addEventListener("click", async () => {
                    const moment = loadSavedMoments().find(m => m.key === btn.dataset.key);
                    if (!moment) return;
                    // Inny tekst niż na ekranie głównym — bez linku do instalacji apki.
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

        // SETTINGS — przypominajka (UI, zapamiętane lokalnie, bez realnych powiadomień jeszcze)
        const REMINDER_KEY = "cif7_reminder_hour";
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

        // VERSION & FEEDBACK
        document.getElementById("version-string").textContent =
            `v1.0 · built ${new Date().toISOString().slice(0, 10)}`;
        // TODO: podmień na właściwy link do Google Form, gdy będzie gotowy.
        document.getElementById("feedback-link").href = "https://forms.gle/REPLACE_WITH_YOUR_FORM";

        // NAWIGACJA: kliknięcie pozycji z listy -> pokaż panel; Back -> wróć do listy; Main -> zamknij całe menu
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

    } catch (error) {
        console.error("Error loading Classics in 7 content:", error);
    }
});
