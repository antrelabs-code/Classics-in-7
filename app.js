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

        // Obsługa kliknięć dla trzech przycisków w jednej linii
        document.getElementById("btn-1").addEventListener("click", () => {
            console.log("Save dla utworu:", currentTracks[0]?.title);
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
            const track = currentTracks[0];
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
                discoverLabelEl.textContent = `${subTracks.length} OTHER WORKS`;
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

        settingsBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            settingsMenu.classList.toggle("expanded");
            settingsBtn.classList.toggle("active");
        });

        document.addEventListener("click", (e) => {
            if (!settingsMenu.contains(e.target) && e.target !== settingsBtn) {
                settingsMenu.classList.remove("expanded");
                settingsBtn.classList.remove("active");
            }
        });

    } catch (error) {
        console.error("Error loading Classics in 7 content:", error);
    }
});
