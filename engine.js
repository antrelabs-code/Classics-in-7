// engine.js
// The YouTube playback engine. Deliberately decoupled from the data model:
// it only needs a track object with a `youtube_id`, plus a couple of
// callbacks. The visual YouTube player itself stays hidden — the app owns
// PLAY/PAUSE/STOP and track selection in its own UI.

export class YouTubeEngine {
    /**
     * @param {Object} options
     * @param {() => ({youtube_id?: string}|null)} options.getSelectedTrack
     *        Returns the track that should play next.
     * @param {() => void} [options.onStateChange]
     *        Called whenever isPlaying/isPaused change, so the UI can update.
     * @param {() => void} [options.onPlaybackStarted]
     *        Called right after playback actually starts (e.g. to scroll
     *        the main card into view).
     */
    constructor({ getSelectedTrack, onStateChange = () => {}, onPlaybackStarted = () => {} }) {
        this.getSelectedTrack = getSelectedTrack;
        this.onStateChange = onStateChange;
        this.onPlaybackStarted = onPlaybackStarted;

        this.ytPlayer = null;
        this.ytApiReady = false;
        this.isPlaying = false;
        this.isPaused = false;
        this.pendingPlay = false;
    }

    init() {
        const host = document.createElement("div");
        host.id = "youtube-player-hidden";
        host.setAttribute("aria-hidden", "true");
        document.body.appendChild(host);

        window.onYouTubeIframeAPIReady = () => {
            this.ytApiReady = true;
            this._createPlayer();
        };

        if (!document.getElementById("youtube-iframe-api")) {
            const script = document.createElement("script");
            script.id = "youtube-iframe-api";
            script.src = "https://www.youtube.com/iframe_api";
            document.head.appendChild(script);
        }
    }

    _createPlayer() {
        if (!window.YT || !window.YT.Player) return false;
        if (this.ytPlayer) return true;

        this.ytPlayer = new YT.Player("youtube-player-hidden", {
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
                    this.ytApiReady = true;
                    if (this.pendingPlay) this.play();
                },
                onStateChange: (event) => {
                    if (event.data === YT.PlayerState.PLAYING) {
                        this.isPlaying = true;
                        this.isPaused = false;
                        this.pendingPlay = false;
                        this.onStateChange();
                        this.onPlaybackStarted();
                    } else if (event.data === YT.PlayerState.PAUSED) {
                        if (this.isPlaying) {
                            this.isPlaying = false;
                            this.isPaused = true;
                            this.onStateChange();
                        }
                    } else if (event.data === YT.PlayerState.ENDED) {
                        this.isPlaying = false;
                        this.isPaused = false;
                        this.onStateChange();
                    }
                },
                onError: (event) => {
                    this.isPlaying = false;
                    this.isPaused = false;
                    this.pendingPlay = false;
                    this.onStateChange();
                    console.error("YouTube playback error:", event.data);
                }
            }
        });
        return true;
    }

    async play() {
        const track = this.getSelectedTrack();
        if (!track || !track.youtube_id) {
            console.log("PLAY ME: selected track has no YouTube ID.");
            return;
        }

        this.pendingPlay = true;
        if (!this.ytPlayer) {
            if (!this._createPlayer()) return;
        }
        if (!this.ytApiReady || !this.ytPlayer || typeof this.ytPlayer.loadVideoById !== "function") return;

        try {
            this.ytPlayer.loadVideoById(track.youtube_id);
            this.isPlaying = true;
            this.pendingPlay = false;
            this.onStateChange();
            this.onPlaybackStarted();
        } catch (error) {
            this.isPlaying = false;
            this.pendingPlay = false;
            this.onStateChange();
            console.error("YouTube playback error:", error);
        }
    }

    resume() {
        if (!this.ytPlayer) return;
        try { this.ytPlayer.playVideo(); } catch (_) {}
        this.isPlaying = true;
        this.isPaused = false;
        this.onStateChange();
    }

    pause() {
        if (!this.ytPlayer || typeof this.ytPlayer.pauseVideo !== "function") return;
        try { this.ytPlayer.pauseVideo(); } catch (_) {}
        this.isPlaying = false;
        this.isPaused = true;
        this.onStateChange();
    }

    stop() {
        this.pendingPlay = false;
        if (this.ytPlayer && typeof this.ytPlayer.stopVideo === "function") {
            try { this.ytPlayer.stopVideo(); } catch (_) {}
        }
        this.isPlaying = false;
        this.isPaused = false;
        this.onStateChange();
    }
}
