/**
 * Seed Parent Companion App - Storybox Transparency Portal Logic
 * Coordinates settings synchronization (TX), live diagnostics/telemetry parsing (RX),
 * story database logs, insights donut charting, and mobile navigation.
 */

// ==========================================================================
// 1. Initial State & Prepopulated Story History
// ==========================================================================

const DEFAULT_STORIES = [
    {
        id: "story_1",
        title: "Barnaby Bear's Heavy Branch",
        timestamp: new Date(Date.now() - 3600000 * 24 * 3).toISOString(), // 3 days ago
        wordCount: 312,
        pacing: "Calm",
        beads: { meat: 3, plants: 1, grains: 1, dairy: 0 },
        favorite: false,
        notes: "Liam wanted to carry a heavy twig just like Barnaby Bear in the garden today. Helpful story!",
        protagonist: "Barnaby Bear",
        content: "Continuing from the path where they last rested, a new morning arrived with soft, grey light. Early light broke through the silent forest, warming the dew on the ferns. The sky was a pale, gentle blue, and the grass was cool underfoot. Barnaby Bear walked along the river path with steady confidence, taking in the scent of the pine needles. From behind the mossy logs, Gideon Grain and Miss Broccoli followed along, each finding their own unhurried way side by side. As they continued down the dirt path, they noticed the wind had knocked down a small twig. It lay across the pathway, surrounded by yellow leaves. Mr. Claws the Crab stepped around it with a soft, guiding movement, while the others paused to inspect its rough bark. Each friend helped in their own quiet way, moving at a comfortable pace without force. The air felt warm, and the birds chirped softly from the higher branches. They could feel the dry soil under their feet and hear the rhythmic rustle of the leaves above. It was a pleasant moment of shared effort in the shade of the valley. Taking small, steady steps can open the way for everyone.",
        insight: "This story featured a high Meat/Fish count (3 beads) and Grains (1 bead). The narrative focused on Barnaby Bear's physical presence and steady determination. The obstacle was a small twig (Dairy=0 constraint), encouraging Liam to think about resolving group tasks calmly without forced actions. Liam's choices show a high interest in animal-themed stories today."
    },
    {
        id: "story_2",
        title: "Miss Broccoli and the Hidden Brook",
        timestamp: new Date(Date.now() - 3600000 * 24 * 1.5).toISOString(), // 1.5 days ago
        wordCount: 345,
        pacing: "Calming",
        beads: { meat: 1, plants: 1, grains: 1, dairy: 1 },
        favorite: true,
        notes: "Liam loved the character Captain Cheese! He asked for a glass of milk while listening.",
        protagonist: "Miss Broccoli",
        content: "A soft morning breeze drifted through the green meadows, bringing a clean, warm scent of wet moss. The afternoon sun warmed the smooth river rocks, painting the sky in soft shades of butter yellow and amber. Miss Broccoli and Gideon Grain continued side by side, quietly taking in the peaceful surroundings. Together, Captain Cheese and Barnaby Bear walked down the winding trail, sharing the quietness of the woods. They wanted to inspect the small hollow at the base of the great elm. A light tangle of dry meadow grass was blocking the narrow entryway. Captain Cheese stepped forward with a calm sense of purpose, helping to clear the dry stalks without rush. They worked slowly and steadily, enjoying the feel of the cool air and the smell of the damp earth. A sense of calm achievement filled the clearing as the sun began to filter through the canopy. They sat down on a smooth log to rest, listening to the peaceful murmur of the forest. The yellow buttercups swayed gently in the meadow breeze, their petals catching the soft light. A perfectly balanced day leaves everyone feeling rested and content.",
        insight: "This story was perfectly balanced, utilizing 1 bead from all four categories. The narrative had a calming pace, introducing Miss Broccoli, Gideon Grain, Captain Cheese, and Barnaby Bear working in harmony to clear dry meadow grass. This reflects excellent dietary balance, showing that a mixture of all food categories builds a balanced day."
    },
    {
        id: "story_3",
        title: "Gideon Grain's Gentle Climb",
        timestamp: new Date(Date.now() - 3600000 * 4).toISOString(), // 4 hours ago
        wordCount: 295,
        pacing: "Dynamic",
        beads: { meat: 0, plants: 0, grains: 4, dairy: 1 },
        favorite: false,
        notes: "",
        protagonist: "Gideon Grain",
        content: "The forest was waking up slowly, filled with the fresh smell of damp soil. A light mist hung over the grassy knoll, and the morning air smelled clean and crisp like pine needles. Gideon Grain lead the way, while Captain Cheese stepped along close behind, checking the smooth bark of the birch trees. As they continued down the dirt path, they noticed the wind had knocked down a small pile of firewood. It lay across the pathway, surrounded by yellow leaves. Gideon Grain helped to move the small logs with a soft, steady push, taking care not to snag their clothing. Step by step, the path became clear, and they continued their journey under the warm sunshine. A small grey squirrel sat on a nearby branch, watching their progress with quiet curiosity. The sound of the brook was a comforting murmur that filled the silent gaps in their journey. Even a winding road is easy when friends find their rhythm.",
        insight: "This story was dominated by Grains (4 beads), indicating energy and active pacing. Gideon Grain was the protagonist, teaching a lesson on stamina and steady climbing. Grains supply slow-release energy, reflecting Liam's choice for a highly active storyline today."
    }
];

const DEFAULT_SETTINGS = {
    volume: 65,
    voice: "FEMALE",
    lang: "en",
    sleepTimer: "off",
    avgLength: "medium",
    wifiSsid: "",
    wifiPass: "",
    ledBrightness: 180,
    ledSpeed: 15,
    ledColor: "#0ea5e9"
};

// Date Formatting Helpers
function formatStoryDate(dateStr) {
    if (!dateStr) return "Recent";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Recent";
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatStoryDateTime(dateStr) {
    if (!dateStr) return "Recent";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Recent";
    return d.toLocaleString([], { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
}


// ==========================================================================
// 2. Connection Bridges
// ==========================================================================

class ConnectionBridge {
    constructor() {
        this.statusCallback = null;
        this.messageCallback = null;
        this.status = 'disconnected';
    }

    onStatusChange(callback) {
        this.statusCallback = callback;
    }

    onMessage(callback) {
        this.messageCallback = callback;
    }

    updateStatus(newStatus) {
        this.status = newStatus;
        if (this.statusCallback) this.statusCallback(newStatus);
    }

    connect(address) { this.updateStatus('connected'); }
    disconnect() { this.updateStatus('disconnected'); }
    send(dataString) {}
}

class MockStoryboxBridge extends ConnectionBridge {
    constructor() {
        super();
        this.telemetryInterval = null;
        this.beadDriftInterval = null;
        this.mockPlayTimeout = null;
        this.battery = 82;
        this.cpuTemp = 34.2;
        this.wifiRssi = -42;
        this.isPlaying = false;
        
        // Mock physical beads on the board
        this.mockBeads = {
            meat: 0,
            plants: 0,
            grains: 0,
            dairy: 0
        };

        this.deviceState = { ...DEFAULT_SETTINGS };
    }

    connect(address) {
        this.updateStatus('connecting');
        setTimeout(() => {
            this.updateStatus('connected');
            this.startDiagnosticsFeed();
        }, 500);
    }

    disconnect() {
        this.stopDiagnosticsFeed();
        this.updateStatus('disconnected');
    }

    send(dataString) {
        try {
            const config = JSON.parse(dataString);
            Object.assign(this.deviceState, config);
            
            setTimeout(() => {
                const ack = {
                    success: true,
                    applied: config,
                    timestamp: Date.now()
                };
                if (this.messageCallback) {
                    this.messageCallback(JSON.stringify(ack), 'inbound');
                }
            }, 60);
        } catch (e) {
            if (this.messageCallback) {
                this.messageCallback(`[ACK] Raw: ${dataString}`, 'inbound');
            }
        }
    }

    startDiagnosticsFeed() {
        this.telemetryInterval = setInterval(() => {
            const drainRate = this.isPlaying ? 0.08 : 0.01;
            this.battery = Math.max(1, parseFloat((this.battery - drainRate).toFixed(2)));
            
            const targetTemp = this.isPlaying ? 41.5 : 34.0;
            const drift = (Math.random() - 0.5) * 0.4;
            this.cpuTemp = parseFloat((this.cpuTemp + (targetTemp - this.cpuTemp) * 0.1 + drift).toFixed(1));
            this.wifiRssi = -40 - Math.round(Math.random() * 5);

            const diagTelemetry = {
                battery: Math.round(this.battery),
                cpu: this.cpuTemp,
                rssi: this.wifiRssi,
                playing: this.isPlaying,
                beads: this.mockBeads
            };

            if (this.messageCallback) {
                this.messageCallback(JSON.stringify(diagTelemetry), 'inbound');
            }
        }, 1500);

        // Drift loop representing a child dynamically plugging in beads on the board (every 18s)
        this.beadDriftInterval = setInterval(() => {
            if (this.isPlaying) return; // Don't change beads while playing a story!

            const keys = Object.keys(this.mockBeads);
            const randomKey = keys[Math.floor(Math.random() * keys.length)];
            const rand = Math.random();

            if (rand < 0.4) {
                if (this.mockBeads[randomKey] < 5) {
                    this.mockBeads[randomKey]++;
                    this.triggerMockPlayCycle();
                }
            } else if (rand < 0.7) {
                if (this.mockBeads[randomKey] > 0) {
                    this.mockBeads[randomKey]--;
                }
            }
        }, 18000);
    }

    triggerMockPlayCycle() {
        const total = Object.values(this.mockBeads).reduce((a, b) => a + b, 0);
        if (total === 0 || this.isPlaying) return;

        // Child presses START STORY button
        setTimeout(() => {
            this.isPlaying = true;
            
            // Story plays for 15 seconds then returns to idle
            this.mockPlayTimeout = setTimeout(() => {
                this.isPlaying = false;
            }, 15000);
        }, 2000);
    }

    stopDiagnosticsFeed() {
        if (this.telemetryInterval) clearInterval(this.telemetryInterval);
        if (this.beadDriftInterval) clearInterval(this.beadDriftInterval);
        if (this.mockPlayTimeout) clearTimeout(this.mockPlayTimeout);
    }
}

class WebSocketStoryboxBridge extends ConnectionBridge {
    constructor() {
        super();
        this.ws = null;
    }

    connect(address) {
        this.updateStatus('connecting');
        
        try {
            const wsAddress = address.startsWith('ws://') || address.startsWith('wss://') 
                ? address 
                : `ws://${address}`;

            this.ws = new WebSocket(wsAddress);

            this.ws.onopen = () => {
                this.updateStatus('connected');
            };

            this.ws.onmessage = (event) => {
                if (this.messageCallback) {
                    this.messageCallback(event.data, 'inbound');
                }
            };

            this.ws.onclose = () => {
                this.updateStatus('disconnected');
            };

            this.ws.onerror = (error) => {
                if (this.messageCallback) {
                    this.messageCallback(`WebSocket Error: ${error.message || 'Connection failed'}`, 'error');
                }
                this.updateStatus('disconnected');
            };
        } catch (e) {
            if (this.messageCallback) {
                this.messageCallback(`WS Init Error: ${e.message}`, 'error');
            }
            this.updateStatus('disconnected');
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.updateStatus('disconnected');
    }

    send(dataString) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(dataString);
        } else {
            if (this.messageCallback) {
                this.messageCallback('WS Error: Cannot transmit configuration, socket disconnected.', 'error');
            }
        }
    }
}

class HTTPStoryboxBridge extends ConnectionBridge {
    constructor() {
        super();
        this.serverUrl = '';
        this.pollInterval = null;
    }

    connect(address) {
        this.updateStatus('connecting');
        
        this.serverUrl = address.startsWith('http://') || address.startsWith('https://')
            ? address
            : `http://${address}`;

        fetch(`${this.serverUrl}/telemetry`)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP status ${res.status}`);
                return res.json();
            })
            .then(data => {
                this.updateStatus('connected');
                
                this.pollInterval = setInterval(() => {
                    this.pollTelemetry();
                }, 1500);

                if (this.messageCallback) {
                    this.messageCallback(JSON.stringify(data), 'inbound');
                }
            })
            .catch(err => {
                if (this.messageCallback) {
                    this.messageCallback(`HTTP Connect Error: ${err.message}`, 'error');
                }
                this.updateStatus('disconnected');
            });
    }

    disconnect() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        this.updateStatus('disconnected');
    }

    pollTelemetry() {
        fetch(`${this.serverUrl}/telemetry`)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP Status ${res.status}`);
                return res.json();
            })
            .then(data => {
                if (this.messageCallback) {
                    this.messageCallback(JSON.stringify(data), 'inbound');
                }
            })
            .catch(err => {
                if (this.messageCallback) {
                    this.messageCallback(`HTTP Telemetry Poll Error: ${err.message}`, 'error');
                }
                this.disconnect();
            });
    }

    send(dataString) {
        if (this.status !== 'connected') return;

        fetch(`${this.serverUrl}/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: dataString
        })
        .then(res => {
            if (!res.ok) throw new Error(`HTTP Status ${res.status}`);
            return res.json();
        })
        .then(ack => {
            if (this.messageCallback) {
                this.messageCallback(JSON.stringify(ack), 'inbound');
            }
        })
        .catch(err => {
            if (this.messageCallback) {
                this.messageCallback(`HTTP Config Send Error: ${err.message}`, 'error');
            }
        });
    }
}


// ==========================================================================
// 3. UI Coordinator & Narrative Engine
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    let currentBridge = new MockStoryboxBridge();

    // --- State Initialization ---
    let appState = {
        stories: [],
        settings: { ...DEFAULT_SETTINGS },
        activeTab: "screen-home",
        selectedStoryId: null,
        
        // Active telemetry beads
        beads: { meat: 0, plants: 0, grains: 0, dairy: 0 },
        isPlaying: false
    };

    // Load from localStorage or defaults
    function loadState() {
        const savedStories = localStorage.getItem("seed_stories");
        const savedSettings = localStorage.getItem("seed_settings");
        
        if (savedStories) {
            try {
                appState.stories = JSON.parse(savedStories);
            } catch (e) {
                appState.stories = [ ...DEFAULT_STORIES ];
            }
        } else {
            appState.stories = [ ...DEFAULT_STORIES ];
            localStorage.setItem("seed_stories", JSON.stringify(appState.stories));
        }

        if (savedSettings) {
            try {
                appState.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) };
            } catch (e) {
                appState.settings = { ...DEFAULT_SETTINGS };
            }
        } else {
            appState.settings = { ...DEFAULT_SETTINGS };
            localStorage.setItem("seed_settings", JSON.stringify(appState.settings));
        }
    }
    loadState();


    // 4-Category Character Dictionary (Seed v2.2)
    const characterMap = {
        meat: { name: "Barnaby Bear", icon: "🐻", label: "Animal", color: "#E76F51", colorLight: "rgba(230, 111, 81, 0.12)" },
        plants: { name: "Miss Broccoli", icon: "🥦", label: "Plant", color: "#4EAA78", colorLight: "rgba(78, 170, 120, 0.12)" },
        grains: { name: "Gideon Grain", icon: "🌾", label: "Grain", color: "#E9C46A", colorLight: "rgba(233, 196, 106, 0.15)" },
        dairy: { name: "Captain Cheese", icon: "🥛", label: "Dairy", color: "#4EA8DE", colorLight: "rgba(78, 168, 222, 0.12)" }
    };

    // --- UI Cache Selectors ---
    const navItems = document.querySelectorAll(".nav-item");
    const screens = document.querySelectorAll(".app-screen");
    const detailOverlay = document.getElementById("screen-story-detail");

    // Telemetry displays
    const statusValBattery = document.getElementById("status-val-battery");
    const statusValWifi = document.getElementById("status-val-wifi");
    const statusValVolume = document.getElementById("status-val-volume");
    const homeStatusBadge = document.getElementById("home-status-badge");
    const miniStatusDot = document.getElementById("mini-status-dot");
    const miniStatusLabel = document.getElementById("mini-status-label");
    const batteryFill = document.getElementById("phone-battery-fill");
    const batteryPercentage = document.getElementById("phone-battery-display");
    
    // Live Activity Displays
    const homeLiveStatusBadge = document.getElementById("home-live-status-badge");
    const homeLiveRing = document.getElementById("home-live-ring");
    const homeLiveIcon = document.getElementById("home-live-icon");
    const homeLiveTitle = document.getElementById("home-live-status-title");
    const homeLiveDesc = document.getElementById("home-live-status-desc");
    
    const countTodayText = document.getElementById("stat-count-today");
    const countFavoritesText = document.getElementById("stat-count-favorites");
    const homeInsightsPromoText = document.getElementById("home-insights-text");

    // Console Logging & AI Compiler
    const consoleOutput = document.getElementById("console-output");
    const promptOutput = document.getElementById("prompt-output");
    const btnClearConsole = document.getElementById("btn-clear-console");
    const consoleTabs = document.querySelectorAll(".console-tab");

    // Settings inputs
    const inputVolume = document.getElementById("device-volume");
    const labelVolume = document.getElementById("volume-val");
    const selectLanguage = document.getElementById("device-lang");
    const selectSleepTimer = document.getElementById("sleep-timer");
    const selectVoiceButtons = document.querySelectorAll('[data-voice]');
    const selectLengthButtons = document.querySelectorAll('[data-length]');
    const inputLedBrightness = document.getElementById("led-brightness");
    const labelLedBrightness = document.getElementById("led-brightness-val");
    const inputLedSpeed = document.getElementById("led-speed");
    const labelLedSpeed = document.getElementById("led-speed-val");
    const inputLedColor = document.getElementById("led-color");
    const swatches = document.querySelectorAll(".swatch");
    const inputWifiSsid = document.getElementById("wifi-ssid");
    const inputWifiPass = document.getElementById("wifi-pass");
    const btnSaveWifi = document.getElementById("btn-save-wifi");
    const btnOtaUpdate = document.getElementById("btn-ota-update");

    // Diagnostics slots
    const diagCpu = document.getElementById("diag-cpu");
    const diagWifi = document.getElementById("diag-wifi");
    const diagAdcMeat = document.getElementById("diag-adc-meat");
    const diagAdcPlants = document.getElementById("diag-adc-veggies");
    const diagAdcGrains = document.getElementById("diag-adc-grains");
    const diagAdcDairy = document.getElementById("diag-adc-dairy");

    // Bridge config
    const bridgeTypeSelect = document.getElementById("bridge-type");
    const remoteAddressRow = document.getElementById("remote-address-row");
    const remoteAddressInput = document.getElementById("remote-address");
    const btnConnect = document.getElementById("btn-connect");
    const btnClearBeads = document.getElementById("btn-clear-beads");

    // Insights view
    const donutChart = document.getElementById("insights-donut-chart");
    const donutTotalBeads = document.getElementById("donut-total-beads");
    const coachAssessmentText = document.getElementById("coach-assessment-text");

    // detailed Overlay elements
    const btnCloseDetail = document.getElementById("btn-close-detail");
    const detailBtnFav = document.getElementById("detail-btn-fav");
    const detailAvatar = document.getElementById("detail-avatar");
    const detailTitle = document.getElementById("detail-title");
    const detailDate = document.getElementById("detail-date");
    const detailWordcount = document.getElementById("detail-wordcount");
    const detailBeadBadges = document.getElementById("detail-bead-badges");
    const detailTextBody = document.getElementById("detail-text-body");
    const detailNutritionDesc = document.getElementById("detail-nutrition-desc");
    const detailNotesInput = document.getElementById("detail-notes-input");
    const notesSavedLabel = document.getElementById("notes-saved-lbl");
    const btnDeleteStory = document.getElementById("detail-btn-delete");

    // Custom Audio Player inside Detail View
    const playerPlayBtn = document.getElementById("player-play-btn");
    const playerStatusText = document.getElementById("player-status-txt");
    const playerSpeedSelect = document.getElementById("player-speed");
    const playerWaveformCanvas = document.getElementById("player-waveform");

    // ======================================================================
    // General UI Helpers & Setup
    // ======================================================================

    // --- Mock Status Bar Clock Synchronization ---
    const phoneTimeDisplay = document.getElementById("phone-time-display");

    function updatePhoneStatusBar(batteryPercent) {
        if (phoneTimeDisplay) {
            const now = new Date();
            let hrs = now.getHours();
            let mins = now.getMinutes();
            hrs = hrs < 10 ? "0" + hrs : hrs;
            mins = mins < 10 ? "0" + mins : mins;
            phoneTimeDisplay.textContent = `${hrs}:${mins}`;
        }
        
        if (batteryPercent !== undefined) {
            if (batteryPercentage) batteryPercentage.textContent = `${batteryPercent}%`;
            if (batteryFill) batteryFill.style.width = `${batteryPercent}%`;
        }
    }

    updatePhoneStatusBar(85);
    setInterval(() => {
        updatePhoneStatusBar();
    }, 10000);

    function writeToConsole(message, type = 'system') {
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        const time = new Date().toLocaleTimeString([], { hour12: false });
        entry.textContent = `[${time}] ${message}`;
        consoleOutput.appendChild(entry);
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
        
        while (consoleOutput.children.length > 50) {
            consoleOutput.removeChild(consoleOutput.firstChild);
        }
    }

    function updateSliderBackgrounds() {
        const sliders = [
            { el: inputVolume, fill: document.getElementById('volume-fill'), max: 100 },
            { el: inputLedBrightness, fill: document.getElementById('led-brightness-fill'), max: 255 },
            { el: inputLedSpeed, fill: document.getElementById('led-speed-fill'), min: 5, max: 30 }
        ];

        sliders.forEach(item => {
            if (!item.el || !item.fill) return;
            const min = item.min !== undefined ? item.min : 0;
            const val = item.el.value;
            const percent = ((val - min) / (item.max - min)) * 100;
            item.fill.style.width = `${percent}%`;
        });
    }

    // Tab view navigation switcher
    function switchScreen(targetScreenId) {
        screens.forEach(screen => {
            screen.classList.remove("active");
            if (screen.id === targetScreenId) {
                screen.classList.add("active");
            }
        });

        navItems.forEach(item => {
            item.classList.remove("active");
            if (item.dataset.target === targetScreenId) {
                item.classList.add("active");
            }
        });

        appState.activeTab = targetScreenId;
        
        // Specific screen hooks
        if (targetScreenId === "screen-stories") {
            renderStoriesList();
        } else if (targetScreenId === "screen-insights") {
            recalculateInsights();
        } else if (targetScreenId === "screen-settings") {
            updateSliderBackgrounds();
        }
    }

    navItems.forEach(item => {
        item.addEventListener("click", () => {
            switchScreen(item.dataset.target);
        });
    });

    // Home Insights promo card click
    document.getElementById("btn-go-to-insights").addEventListener("click", () => {
        switchScreen("screen-insights");
    });

    // Console switcher
    consoleTabs.forEach(btn => {
        btn.addEventListener('click', () => {
            consoleTabs.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const activeTab = btn.dataset.tab;
            if (activeTab === 'logs') {
                consoleOutput.classList.remove('hide');
                promptOutput.classList.add('hide');
            } else {
                consoleOutput.classList.add('hide');
                promptOutput.classList.remove('hide');
                updateCompiledPromptView();
            }
        });
    });

    btnClearConsole.addEventListener('click', () => {
        consoleOutput.innerHTML = '';
        writeToConsole('[SYSTEM] Event console cleared.', 'system');
    });

    // Load Settings into UI
    function loadSettingsIntoUI() {
        const s = appState.settings;
        inputVolume.value = s.volume;
        labelVolume.textContent = `${s.volume}%`;
        statusValVolume.textContent = `${s.volume}%`;
        selectLanguage.value = s.lang;
        selectSleepTimer.value = s.sleepTimer;
        
        // Voice buttons
        selectVoiceButtons.forEach(btn => {
            btn.classList.remove("active");
            if (btn.dataset.voice === s.voice.toLowerCase()) {
                btn.classList.add("active");
            }
        });

        // Length buttons
        selectLengthButtons.forEach(btn => {
            btn.classList.remove("active");
            if (btn.dataset.length === s.avgLength) {
                btn.classList.add("active");
            }
        });

        inputLedBrightness.value = s.ledBrightness;
        labelLedBrightness.textContent = s.ledBrightness;
        inputLedSpeed.value = s.ledSpeed;
        labelLedSpeed.textContent = `${(s.ledSpeed / 10).toFixed(1)}x`;
        inputLedColor.value = s.ledColor;

        // Swatches selection
        swatches.forEach(sw => {
            sw.classList.remove("active");
            if (sw.dataset.color.toUpperCase() === s.ledColor.toUpperCase()) {
                sw.classList.add("active");
            }
        });

        updateSliderBackgrounds();
    }
    loadSettingsIntoUI();

    function saveSettingsToLocal() {
        localStorage.setItem("seed_settings", JSON.stringify(appState.settings));
    }

    // ======================================================================
    // Telemetry Sync & Dynamic Screen Updates
    // ======================================================================

    function syncPhysicalBeadCards() {
        const beads = appState.beads;

        // Update home pills
        Object.keys(beads).forEach(key => {
            const count = beads[key];
            const pillId = `home-pill-${key === 'plants' ? 'veggies' : key}`;
            const countId = `home-count-${key}`;
            
            const pill = document.getElementById(pillId);
            const countText = document.getElementById(countId);

            if (pill && countText) {
                countText.textContent = count;
                if (count > 0) {
                    pill.classList.add("active");
                } else {
                    pill.classList.remove("active");
                }
            }
        });
        
        // Sync setting Diagnostics pegs (ADC values)
        const getMockAdcVal = (count) => {
            if (count === 0) return 92 + Math.round(Math.random() * 8);
            if (count === 1) return 275 + Math.round(Math.random() * 15);
            if (count === 2) return 485 + Math.round(Math.random() * 15);
            if (count === 3) return 690 + Math.round(Math.random() * 15);
            if (count === 4) return 885 + Math.round(Math.random() * 15);
            return 1010 + Math.round(Math.random() * 6);
        };

        diagAdcMeat.textContent = getMockAdcVal(beads.meat);
        diagAdcPlants.textContent = getMockAdcVal(beads.plants);
        diagAdcGrains.textContent = getMockAdcVal(beads.grains);
        diagAdcDairy.textContent = getMockAdcVal(beads.dairy);
    }

    function calculateNarrativeProperties() {
        const beads = appState.beads;
        const totalBeads = Object.values(beads).reduce((a, b) => a + b, 0);

        if (totalBeads === 0) {
            return {
                total: 0,
                protagonist: 'None',
                protagonistKey: null,
                activeGroups: [],
                balance: 'Empty Rack'
            };
        }

        const activeGroups = Object.keys(beads).filter(k => beads[k] > 0);
        
        let maxCount = 0;
        let protagonistKey = null;
        activeGroups.forEach(k => {
            if (beads[k] > maxCount) {
                maxCount = beads[k];
                protagonistKey = k;
            }
        });

        const protagonist = characterMap[protagonistKey].name;

        let balance = 'Balanced (Calm)';
        const activeCounts = activeGroups.map(k => beads[k]);
        const max = Math.max(...activeCounts);
        const min = Math.min(...activeCounts);

        if (activeGroups.length === 4 && max === min) {
            balance = 'Perfect Balance (Calming)';
        } else if (activeGroups.length === 1 || max >= 3 || (max - min) >= 2) {
            balance = 'Unbalanced (Dynamic)';
        }

        return {
            total: totalBeads,
            protagonist: protagonist,
            protagonistKey: protagonistKey,
            activeGroups: activeGroups,
            balance: balance
        };
    }

    function updateCompiledPromptView() {
        const meta = calculateNarrativeProperties();
        if (meta.total === 0) {
            promptOutput.textContent = "[AI COMPILER] Prompt template is empty. Adjust physical bead slots to compile the payload.";
            return;
        }

        const secondaryKeys = meta.activeGroups.filter(k => k !== meta.protagonistKey);
        const secondaries = secondaryKeys.map(k => `${characterMap[k].name} (Weight: ${appState.beads[k]}/5)`);
        
        const excludedKeys = Object.keys(appState.beads).filter(k => appState.beads[k] === 0);
        const excluded = excludedKeys.map(k => characterMap[k].label);

        const systemHeader = `🌱 SEED — Final System Prompt v2.2\n` +
                             `4-Category Model (Fruits & Vegetables United) — With Length Enforcement + patches\n` +
                             `------------------------------------------------------------------------\n` +
                             `1. IDENTITY: warm, sensory, grounded, past-tense storyteller.\n` +
                             `   NO child-greeting, NO questions, NO reference to beads/devices.\n` +
                             `2. STORY WORLD: Natural, whimsical but strictly non-magical/non-supernatural.\n` +
                             `3. CATEGORIES: Meat/Fish (Animal), Fruits & Veg (Plant), Grains (Grain), Dairy (Dairy).\n` +
                             `4. PACING SHAPE: Balanced = Calm & cooperative. Unbalanced = Lively & dynamic.\n` +
                             `5. LENGTH ENFORCEMENT: Strictly 260-380 words (uses sensory expansion details).`;

        const userPayload = `\n\n========================================================================\n` +
                            `[COMPILED API USER PAYLOAD]\n` +
                            `========================================================================\n` +
                            `## Active Input Context:\n` +
                            `- Animal Group (Meat/Fish): ${appState.beads.meat} beads\n` +
                            `- Grain Group (Grains): ${appState.beads.grains} beads\n` +
                            `- Dairy Group (Dairy): ${appState.beads.dairy} beads\n` +
                            `- Plant Group (Fruits & Veg): ${appState.beads.plants} beads\n` +
                            `- Total Bead Count: ${meta.total}/20\n` +
                            `- Tone Pacing: ${meta.balance}\n` +
                            `- Length Target: 260-380 words (strict)\n\n` +
                            `## Character Weights & Hierarchy:\n` +
                            `- Protagonist: ${meta.protagonist} (Weight: ${appState.beads[meta.protagonistKey]}/5)\n` +
                            `- Secondary Characters: ${secondaries.length > 0 ? secondaries.join(', ') : 'None'}\n` +
                            `- Excluded Groups: ${excluded.length > 0 ? excluded.join(', ') : 'None'}\n\n` +
                            `## Active Constraint Patches:\n` +
                            (appState.beads[meta.protagonistKey] === 5 ? `- PROTAGONIST SOFTENING PATCH ACTIVE: ${meta.protagonist} must move with gentle determination, not force; act with steady confidence, not intensity; avoid precision-timed actions; avoid strong physical verbs.\n` : '') +
                            (appState.beads.dairy === 0 ? `- DAIRY=0 CONFLICT LIMIT ACTIVE: Obstacles must be low-effort, soft items (twig, puddle, misplaced pebble). No heavy stones/logs, no coordinated physical force.\n` : '- Dairy active. Small, natural obstacles allowed.\n') +
                            `- ENSEMBLE MOVEMENT SOFTENING ACTIVE: Do not use coordinated/synchronized terms (no "in perfect harmony" or "synchronized"). Keep group movement unchoreographed and organic.\n\n` +
                            `Please generate the story chapter matching these specifications.`;

        promptOutput.textContent = systemHeader + userPayload;
    }

    // ======================================================================
    // Dynamic Story Generator (Triggered by physical device loop)
    // ======================================================================

    function generateAndLogTelemetryStory() {
        const meta = calculateNarrativeProperties();
        if (meta.total === 0) return;

        const beads = appState.beads;
        const protagonist = meta.protagonist;
        const pacingType = meta.balance.includes('Perfect') ? 'Calming' : (meta.balance.includes('Unbalanced') ? 'Dynamic' : 'Calm');

        const secondaryKeys = meta.activeGroups.filter(k => k !== meta.protagonistKey);
        const secondaries = secondaryKeys.map(k => characterMap[k].name);

        let title = "";
        const dynamicTitles = [`${protagonist}'s Steady Journey`, `The Path Across the Valley with ${protagonist}`, `${protagonist}'s Great Exploration`];
        const calmTitles = [`A Calm Afternoon with ${protagonist}`, `The Quiet Forest and ${protagonist}`, `A Peaceful Rest with ${protagonist}`];
        
        if (pacingType === 'Dynamic') {
            title = dynamicTitles[Math.floor(Math.random() * dynamicTitles.length)];
        } else {
            title = calmTitles[Math.floor(Math.random() * calmTitles.length)];
        }

        // Generate paragraph content
        let opening = `A soft morning breeze drifted through the green meadows, bringing a clean, warm scent of wet moss. The forest was waking up slowly, filled with the fresh smell of damp soil. `;
        let setting = `The sky was a pale, gentle blue, and the grass was cool underfoot. Sunlight filtered through the broad branches of the oak trees, casting moving patterns of shadow on the woodland path. `;
        
        let introduction = "";
        if (beads[meta.protagonistKey] === 5) {
            introduction = `${protagonist} walked along the river path with steady confidence, taking in the scent of the pine needles. From behind the mossy logs, ${secondaries.length > 0 ? secondaries.join(' and ') : 'friends'} followed along, each finding their own unhurried way side by side. `;
        } else {
            introduction = `${protagonist} and ${secondaries.length > 0 ? secondaries.join(', ') : 'friends'} continued side by side, quietly taking in the peaceful surroundings, sharing the quietness of the woods. `;
        }

        let obstacle = "";
        if (beads.dairy === 0) {
            obstacle = `As they continued down the dirt path, they noticed a small twig lay across the pathway, surrounded by yellow leaves. Barnaby Bear stepped around it with a soft, guiding movement, while the others paused to inspect its rough bark. `;
        } else {
            obstacle = `They wanted to inspect the small hollow at the base of the great elm. A light tangle of dry meadow grass was blocking the narrow entryway. Captain Cheese stepped forward with a calm sense of purpose, helping to clear the dry stalks without rush. `;
        }

        let resolution = `Each friend helped in their own quiet way, moving at a comfortable pace without force. The air felt warm, and the birds chirped softly from the higher branches. They sat down on a smooth log to rest, listening to the peaceful murmur of the forest. `;
        let moral = pacingType === 'Dynamic' 
            ? `Working together made the path ahead feel clear and welcoming.` 
            : `A perfectly balanced day leaves everyone feeling rested and content.`;

        let content = opening + setting + introduction + obstacle + resolution + moral;
        let wordCount = content.split(/\s+/).filter(Boolean).length;

        // Custom nutritional insight text based on dominant
        let dominantLabel = characterMap[meta.protagonistKey].label;
        let insight = `This story featured a high ${dominantLabel} count (${beads[meta.protagonistKey]} beads). The narrative focused on ${protagonist}'s core settings. Liam's choices show a high interest in ${dominantLabel.toLowerCase()}-themed stories today.`;

        // Create new story object
        const newStory = {
            id: "story_" + Date.now(),
            title: title,
            timestamp: new Date().toISOString(),
            wordCount: wordCount,
            pacing: pacingType,
            beads: { ...beads },
            favorite: false,
            notes: "",
            protagonist: protagonist,
            content: content,
            insight: insight
        };

        // Add to array, save to local
        appState.stories.unshift(newStory);
        localStorage.setItem("seed_stories", JSON.stringify(appState.stories));
        
        writeToConsole(`[TRANSPARENCY LINK] Synchronized new generated story: "${title}"`, 'system');
        
        // Refresh views
        renderStoriesList();
        recalculateInsights();
        recalculateMilestones();
    }

    // ======================================================================
    // Archive Screen rendering (Screen 2)
    // ======================================================================

    const archiveList = document.getElementById("archive-stories-list");
    const searchInput = document.getElementById("stories-search-input");
    const filterButtons = document.querySelectorAll(".filter-badge");

    let activeFilter = "all";

    function renderStoriesList() {
        archiveList.innerHTML = "";
        const query = searchInput.value.trim().toLowerCase();

        const filtered = appState.stories.filter(story => {
            // Search query matches title or protagonist
            const matchSearch = story.title.toLowerCase().includes(query) || 
                                story.protagonist.toLowerCase().includes(query);
            
            if (!matchSearch) return false;

            // Category filters
            if (activeFilter === "all") return true;
            if (activeFilter === "fav") return story.favorite;
            
            // Check if category bead > 0
            return story.beads[activeFilter] > 0;
        });

        if (filtered.length === 0) {
            archiveList.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">🔍</span>
                    <h4>No stories match your filter</h4>
                    <p>Try searching for a different keyword or reset filters.</p>
                </div>`;
            return;
        }

        filtered.forEach(story => {
            // Find dominant bead for icon color
            let maxCount = -1;
            let dominantCat = "plants";
            Object.keys(story.beads).forEach(cat => {
                if (story.beads[cat] > maxCount) {
                    maxCount = story.beads[cat];
                    dominantCat = cat;
                }
            });

            const charIcon = characterMap[dominantCat] ? characterMap[dominantCat].icon : "📖";

            const card = document.createElement("div");
            card.className = `story-archive-card ${dominantCat}`;
            card.innerHTML = `
                <div class="card-indicator"></div>
                <div class="card-left-info">
                    <div class="story-avatar">${charIcon}</div>
                    <div class="story-meta-text">
                        <h4>${story.title}</h4>
                        <div class="story-sub-meta">
                            <span>${formatStoryDate(story.timestamp)}</span>
                            <span>•</span>
                            <span class="pacing-badge">${story.pacing}</span>
                            <span>•</span>
                            <span>${story.wordCount} words</span>
                        </div>
                    </div>
                </div>
                <span class="fav-heart-btn ${story.favorite ? 'active' : ''}">♥</span>
            `;

            // open detail screen click
            card.addEventListener("click", (e) => {
                // Ignore click if it is on the favorite heart
                if (e.target.classList.contains("fav-heart-btn")) {
                    e.stopPropagation();
                    story.favorite = !story.favorite;
                    localStorage.setItem("seed_stories", JSON.stringify(appState.stories));
                    renderStoriesList();
                    recalculateInsights();
                    return;
                }

                openStoryDetail(story.id);
            });

            archiveList.appendChild(card);
        });

        // Sync header counts
        countTodayText.textContent = appState.stories.filter(s => {
            const d = new Date(s.timestamp);
            return d.toDateString() === new Date().toDateString();
        }).length;

        countFavoritesText.textContent = appState.stories.filter(s => s.favorite).length;
    }

    // Filter clicks
    filterButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            filterButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            activeFilter = btn.dataset.filter;
            renderStoriesList();
        });
    });

    searchInput.addEventListener("input", renderStoriesList);

    // ======================================================================
    // Detailed Overlay View (Screen 5)
    // ======================================================================

    let notesAutosaveTimeout = null;

    function openStoryDetail(storyId) {
        const story = appState.stories.find(s => s.id === storyId);
        if (!story) return;

        appState.selectedStoryId = storyId;
        
        detailTitle.textContent = story.title;
        detailDate.textContent = formatStoryDateTime(story.timestamp);
        detailWordcount.textContent = `${story.wordCount} words`;
        detailTextBody.textContent = story.content;
        detailNutritionDesc.textContent = story.insight;
        detailNotesInput.value = story.notes || "";
        
        // Dominant character avatar
        let maxCount = -1;
        let dominantCat = "plants";
        Object.keys(story.beads).forEach(cat => {
            if (story.beads[cat] > maxCount) {
                maxCount = story.beads[cat];
                dominantCat = cat;
            }
        });
        detailAvatar.textContent = characterMap[dominantCat] ? characterMap[dominantCat].icon : "🐰";

        // Favorite button state
        detailBtnFav.className = `btn-fav-detail ${story.favorite ? 'active' : ''}`;
        detailBtnFav.innerHTML = story.favorite ? '♥' : '♡';

        // Bead badges list
        detailBeadBadges.innerHTML = "";
        Object.keys(story.beads).forEach(cat => {
            const count = story.beads[cat];
            if (count > 0) {
                const badge = document.createElement("span");
                badge.className = `detail-bead-badge ${cat}`;
                badge.textContent = `${characterMap[cat].icon} ${characterMap[cat].label}: ${count}`;
                detailBeadBadges.appendChild(badge);
            }
        });

        // Reset notes save indicator
        notesSavedLabel.classList.remove("visible");

        // Canvas waveform draw
        drawAudioPlayerWaveform();

        // Reveal panel overlay
        detailOverlay.classList.remove("hidden");
    }

    btnCloseDetail.addEventListener("click", () => {
        detailOverlay.classList.add("hidden");
        
        // Stop audio animations
        if (waveformAnimFrame) {
            cancelAnimationFrame(waveformAnimFrame);
            waveformAnimFrame = null;
        }
        playerPlayBtn.classList.remove("playing");
        playerStatusText.textContent = "Listening paused.";
        
        renderStoriesList();
    });

    // Detail view favorite toggle
    detailBtnFav.addEventListener("click", () => {
        const story = appState.stories.find(s => s.id === appState.selectedStoryId);
        if (story) {
            story.favorite = !story.favorite;
            detailBtnFav.className = `btn-fav-detail ${story.favorite ? 'active' : ''}`;
            detailBtnFav.innerHTML = story.favorite ? '♥' : '♡';
            localStorage.setItem("seed_stories", JSON.stringify(appState.stories));
        }
    });

    // Notes autosave on typing (de-bounced)
    detailNotesInput.addEventListener("input", () => {
        if (notesAutosaveTimeout) clearTimeout(notesAutosaveTimeout);
        
        notesSavedLabel.textContent = "Saving notes...";
        notesSavedLabel.classList.add("visible");

        notesAutosaveTimeout = setTimeout(() => {
            const story = appState.stories.find(s => s.id === appState.selectedStoryId);
            if (story) {
                story.notes = detailNotesInput.value;
                localStorage.setItem("seed_stories", JSON.stringify(appState.stories));
                notesSavedLabel.textContent = "Saved automatically";
            }
        }, 1000);
    });

    // Delete story
    btnDeleteStory.addEventListener("click", () => {
        if (confirm("Are you sure you want to permanently delete this story from the parent archive?")) {
            appState.stories = appState.stories.filter(s => s.id !== appState.selectedStoryId);
            localStorage.setItem("seed_stories", JSON.stringify(appState.stories));
            
            detailOverlay.classList.add("hidden");
            renderStoriesList();
            recalculateInsights();
            recalculateMilestones();
        }
    });

    // --- Waveform Canvas drawing ---
    let waveformAnimFrame = null;
    function drawAudioPlayerWaveform() {
        const ctx = playerWaveformCanvas.getContext("2d");
        const w = playerWaveformCanvas.width;
        const h = playerWaveformCanvas.height;

        let phase = 0;
        
        function draw() {
            ctx.clearRect(0, 0, w, h);
            ctx.fillStyle = "rgba(91, 130, 102, 0.12)";
            ctx.fillRect(0, 0, w, h);

            // Waveform bars
            ctx.fillStyle = "#5B8266";
            const barWidth = 3;
            const barSpacing = 2;
            const barCount = Math.floor(w / (barWidth + barSpacing));

            const isPlaying = playerPlayBtn.classList.contains("playing");
            if (isPlaying) phase += 0.15;

            for (let i = 0; i < barCount; i++) {
                const x = i * (barWidth + barSpacing);
                
                // Simulating sound frequencies
                let heightMult = isPlaying 
                    ? Math.sin(i * 0.15 + phase) * Math.cos(i * 0.05 + phase * 0.5)
                    : Math.sin(i * 0.1);
                
                heightMult = Math.abs(heightMult);
                const barHeight = Math.max(3, heightMult * h * 0.85);
                const y = (h - barHeight) / 2;

                ctx.fillRect(x, y, barWidth, barHeight);
            }

            waveformAnimFrame = requestAnimationFrame(draw);
        }

        if (waveformAnimFrame) cancelAnimationFrame(waveformAnimFrame);
        draw();
    }

    playerPlayBtn.addEventListener("click", () => {
        playerPlayBtn.classList.toggle("playing");
        const isPlaying = playerPlayBtn.classList.contains("playing");
        playerStatusText.textContent = isPlaying ? "Reading story aloud..." : "Playback paused.";
        
        // Log telemetry
        writeToConsole(`[AUDIO] Playback state changed: ${isPlaying ? 'PLAY' : 'PAUSE'} at ${playerSpeedSelect.value}x speed.`, 'system');
    });

    playerSpeedSelect.addEventListener("change", () => {
        writeToConsole(`[AUDIO] Playback speed set to ${playerSpeedSelect.value}x.`, 'system');
    });


    // ======================================================================
    // Insights & Milestone Charts (Screen 3)
    // ======================================================================

    function recalculateInsights() {
        const stories = appState.stories;
        
        let totalBeads = 0;
        const beadTotals = { meat: 0, plants: 0, grains: 0, dairy: 0 };

        // sum all stories
        stories.forEach(s => {
            Object.keys(beadTotals).forEach(cat => {
                const count = s.beads[cat] || 0;
                beadTotals[cat] += count;
                totalBeads += count;
            });
        });

        // Fallback for empty array
        if (totalBeads === 0) {
            donutTotalBeads.textContent = "0";
            donutChart.style.setProperty("--meat-pct", "25%");
            donutChart.style.setProperty("--plants-pct", "50%");
            donutChart.style.setProperty("--grains-pct", "75%");
            donutChart.style.setProperty("--dairy-pct", "100%");

            document.getElementById("legend-count-meat").textContent = "0 (0%)";
            document.getElementById("legend-count-plants").textContent = "0 (0%)";
            document.getElementById("legend-count-grains").textContent = "0 (0%)";
            document.getElementById("legend-count-dairy").textContent = "0 (0%)";

            coachAssessmentText.textContent = "Story logs are empty. Let Liam play with beads on the device to generate stories, and I will write a customized dietary review here.";
            homeInsightsPromoText.textContent = "No stories recorded this week yet. Start simulating child play to see insights!";
            return;
        }

        donutTotalBeads.textContent = totalBeads;

        // Compute percentages
        const meatPct = (beadTotals.meat / totalBeads) * 100;
        const plantsPct = (beadTotals.plants / totalBeads) * 100;
        const grainsPct = (beadTotals.grains / totalBeads) * 100;
        const dairyPct = (beadTotals.dairy / totalBeads) * 100;

        // Sync CSS conic gradients segments
        const meatVal = meatPct;
        const plantsVal = meatVal + plantsPct;
        const grainsVal = plantsVal + grainsPct;

        donutChart.style.setProperty("--meat-pct", `${meatVal}%`);
        donutChart.style.setProperty("--plants-pct", `${plantsVal}%`);
        donutChart.style.setProperty("--grains-pct", `${grainsVal}%`);

        document.getElementById("legend-count-meat").textContent = `${beadTotals.meat} (${Math.round(meatPct)}%)`;
        document.getElementById("legend-count-plants").textContent = `${beadTotals.plants} (${Math.round(plantsPct)}%)`;
        document.getElementById("legend-count-grains").textContent = `${beadTotals.grains} (${Math.round(grainsPct)}%)`;
        document.getElementById("legend-count-dairy").textContent = `${beadTotals.dairy} (${Math.round(dairyPct)}%)`;

        // Determine dominant category
        let maxCount = -1;
        let dominantKey = "grains";
        Object.keys(beadTotals).forEach(k => {
            if (beadTotals[k] > maxCount) {
                maxCount = beadTotals[k];
                dominantKey = k;
            }
        });

        // Set coach assessment strings
        let coachDesc = "";
        let promoDesc = "";
        
        if (dominantKey === "grains") {
            coachDesc = "Liam has chosen a high ratio of Grains & Carbohydrates 🌾 this week. Grains supply slow-release energy, reflecting Liam's choice for highly active storylines. Make sure to pair this energy with refreshing plants!";
            promoDesc = "Liam has chosen a high ratio of Grains & Carbohydrates 🌾 this week. Tap to view detailed coaching advice!";
        } else if (dominantKey === "plants") {
            coachDesc = "Liam has chosen a high ratio of Fruits & Vegetables 🥦 this week. Plant-rich choices bring wonderful sensory, calming settings. Liam is exploring natural, peaceful storylines.";
            promoDesc = "Liam is exploring natural, peaceful storylines with Fruits & Veggies 🥦. View detailed coaching advice!";
        } else if (dominantKey === "meat") {
            coachDesc = "Liam has chosen a high ratio of Animal Protein 🍖 this week. The stories highlight physical strength and determined characters like Barnaby Bear. Encourage Liam to balance these with whole grains!";
            promoDesc = "Liam has chosen a high ratio of Animal Protein 🍖 this week. Tap to view detailed coaching advice!";
        } else {
            coachDesc = "Liam has chosen a high ratio of Calcium-rich Dairy Products 🥛 this week. Dairy beads introduce gentle obstacle resolutions. Pair these calcium-rich themes with fresh plant explore paths!";
            promoDesc = "Liam is resolving stories with soft Dairy 🥛 obstacles. View detailed coaching advice!";
        }

        coachAssessmentText.textContent = coachDesc;
        homeInsightsPromoText.textContent = promoDesc;
    }
    recalculateInsights();

    // Milestone Badges unlock checks
    function recalculateMilestones() {
        const stories = appState.stories;
        
        const badgeFirst = document.getElementById("badge-first-story");
        const badgeRainbow = document.getElementById("badge-rainbow-plate");
        const badgeVeggie = document.getElementById("badge-veggie-explorer");
        const badgeHarmony = document.getElementById("badge-perfect-balance");

        // 1. First Story badge
        if (stories.length >= 1) {
            badgeFirst.classList.remove("locked");
        } else {
            badgeFirst.classList.add("locked");
        }

        // 2. Rainbow choice (all 4 categories > 0 in one story)
        const hasRainbow = stories.some(s => s.beads.meat > 0 && s.beads.plants > 0 && s.beads.grains > 0 && s.beads.dairy > 0);
        if (hasRainbow) {
            badgeRainbow.classList.remove("locked");
        } else {
            badgeRainbow.classList.add("locked");
        }

        // 3. Veggie Explorer (5 stories dominated by plant category)
        const veggieHeavyCount = stories.filter(s => {
            let maxCount = -1;
            let dominantCat = "";
            Object.keys(s.beads).forEach(cat => {
                if (s.beads[cat] > maxCount) {
                    maxCount = s.beads[cat];
                    dominantCat = cat;
                }
            });
            return dominantCat === "plants" && maxCount > 0;
        }).length;
        if (veggieHeavyCount >= 5) {
            badgeVeggie.classList.remove("locked");
        } else {
            badgeVeggie.classList.add("locked");
        }

        // 4. Perfect Harmony (equal counts)
        const hasHarmony = stories.some(s => {
            const vals = Object.values(s.beads);
            return vals.every(v => v === vals[0] && v > 0);
        });
        if (hasHarmony) {
            badgeHarmony.classList.remove("locked");
        } else {
            badgeHarmony.classList.add("locked");
        }
    }
    recalculateMilestones();


    // ======================================================================
    // Settings Event Handlers (TX)
    // ======================================================================

    function sendConfigPayload() {
        const payload = {
            volume: appState.settings.volume,
            voice: appState.settings.voice,
            lang: appState.settings.lang,
            sleepTimer: appState.settings.sleepTimer,
            avgLength: appState.settings.avgLength,
            ledBrightness: appState.settings.ledBrightness,
            ledSpeed: appState.settings.ledSpeed,
            ledColor: appState.settings.ledColor
        };
        
        writeToConsole(`[TX CONFIG] Pushing parameters: ${JSON.stringify(payload)}`, 'outbound');
        currentBridge.send(JSON.stringify(payload));
    }

    // Volume Slider
    inputVolume.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        appState.settings.volume = val;
        labelVolume.textContent = `${val}%`;
        statusValVolume.textContent = `${val}%`;
        updateSliderBackgrounds();
    });
    inputVolume.addEventListener('change', () => {
        saveSettingsToLocal();
        sendConfigPayload();
    });

    // Voice Selector Toggles
    selectVoiceButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            selectVoiceButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const voice = btn.dataset.voice.toUpperCase();
            appState.settings.voice = voice;
            saveSettingsToLocal();
            sendConfigPayload();
        });
    });

    // Language Dropdown
    selectLanguage.addEventListener('change', (e) => {
        appState.settings.lang = e.target.value;
        writeToConsole(`[SYSTEM] Language set to ${selectLanguage.options[selectLanguage.selectedIndex].text}.`, 'system');
        saveSettingsToLocal();
        sendConfigPayload();
    });

    // Sleep Timer Dropdown
    selectSleepTimer.addEventListener('change', (e) => {
        appState.settings.sleepTimer = e.target.value;
        writeToConsole(`[SYSTEM] Sleep timer set to: ${selectSleepTimer.options[selectSleepTimer.selectedIndex].text}.`, 'system');
        saveSettingsToLocal();
        sendConfigPayload();
    });

    // Average Story Length Toggles
    selectLengthButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            selectLengthButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            appState.settings.avgLength = btn.dataset.length;
            saveSettingsToLocal();
            sendConfigPayload();
        });
    });

    // LED Brightness Slider
    inputLedBrightness.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        appState.settings.ledBrightness = val;
        labelLedBrightness.textContent = val;
        updateSliderBackgrounds();
    });
    inputLedBrightness.addEventListener('change', () => {
        saveSettingsToLocal();
        sendConfigPayload();
    });

    // LED Speed Slider
    inputLedSpeed.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        appState.settings.ledSpeed = val;
        labelLedSpeed.textContent = `${(val / 10).toFixed(1)}x`;
        updateSliderBackgrounds();
    });
    inputLedSpeed.addEventListener('change', () => {
        saveSettingsToLocal();
        sendConfigPayload();
    });

    // LED Color Picker
    inputLedColor.addEventListener('input', (e) => {
        const color = e.target.value.toUpperCase();
        appState.settings.ledColor = color;
        
        swatches.forEach(sw => sw.classList.remove('active'));
    });
    inputLedColor.addEventListener('change', () => {
        saveSettingsToLocal();
        sendConfigPayload();
    });

    // LED Swatch Presets
    swatches.forEach(swatch => {
        swatch.addEventListener('click', () => {
            swatches.forEach(sw => sw.classList.remove('active'));
            swatch.classList.add('active');
            
            const color = swatch.dataset.color.toUpperCase();
            appState.settings.ledColor = color;
            inputLedColor.value = color.toLowerCase();
            
            saveSettingsToLocal();
            sendConfigPayload();
        });
    });

    // WiFi Setup Sync click
    btnSaveWifi.addEventListener('click', () => {
        const ssid = inputWifiSsid.value.trim();
        const pass = inputWifiPass.value.trim();
        if (ssid === '') {
            writeToConsole(`[WIFI ERROR] SSID name cannot be empty.`, 'error');
            alert("SSID cannot be blank!");
            return;
        }
        appState.settings.wifiSsid = ssid;
        appState.settings.wifiPass = pass;
        saveSettingsToLocal();
        
        writeToConsole(`[WIFI TX] Writing Wi-Fi credentials for "${ssid}"...`, 'outbound');
        currentBridge.send(JSON.stringify({ wifiSsid: ssid, wifiPass: pass }));
        
        setTimeout(() => {
            writeToConsole(`[WIFI RX ACK] WiFi setup successful. Connected.`, 'inbound');
            inputWifiSsid.value = "";
            inputWifiPass.value = "";
            alert("Wi-Fi network coordinates updated on physical device!");
        }, 400);
    });

    // OTA update click
    btnOtaUpdate.addEventListener("click", () => {
        btnOtaUpdate.disabled = true;
        btnOtaUpdate.textContent = "Checking Firmware...";
        writeToConsole("[OTA] Querying server: current version v1.4.2", "system");

        setTimeout(() => {
            writeToConsole("[OTA ACK] Hardware matches current firmware release version.", "inbound");
            btnOtaUpdate.textContent = "Check OTA Updates";
            btnOtaUpdate.disabled = false;
            alert("Firmware coordinates matched. Your Storybox is up to date!");
        }, 1200);
    });

    // Reset calibration pegs in Mock mode
    btnClearBeads.addEventListener('click', () => {
        if (currentBridge instanceof MockStoryboxBridge) {
            currentBridge.mockBeads = { meat: 0, plants: 0, grains: 0, dairy: 0 };
            writeToConsole('[SIMULATOR] Bead slots calibrated to zero.', 'system');
        }
    });

    // ======================================================================
    // Telemetry Receivers (RX)
    // ======================================================================

    function handleInboundTelemetry(message, type) {
        if (type === 'error') {
            writeToConsole(message, 'error');
            return;
        }

        try {
            const packet = JSON.parse(message);

            // 1. Settings configuration ACK
            if (packet.success && packet.applied) {
                writeToConsole(`[ACK RX] Settings sync confirmed: ${JSON.stringify(packet.applied)}`, 'inbound');
                return;
            }

            // 2. Telemetry package
            if (packet.battery !== undefined) {
                // Log raw telemetry packet in debugger console
                writeToConsole(`[RX TELEMETRY] Raw: ${message}`, 'inbound');

                // Update Header battery displays
                statusValBattery.textContent = `${packet.battery}%`;
                
                // Update Phone Mockup Status Bar
                updatePhoneStatusBar(packet.battery);

                // Update settings Diagnostics
                diagCpu.textContent = `${packet.cpu.toFixed(1)} °C`;
                statusValWifi.textContent = packet.rssi >= -50 ? 'Strong' : (packet.rssi >= -70 ? 'Fair' : 'Weak');
                diagWifi.textContent = `${packet.rssi} dBm`;

                // Update Playback details
                const wasPlaying = appState.isPlaying;
                appState.isPlaying = packet.playing;

                const totalBeads = packet.beads ? Object.values(packet.beads).reduce((a, b) => a + b, 0) : 0;

                if (packet.playing) {
                    homeLiveStatusBadge.textContent = "Active";
                    homeLiveStatusBadge.className = "activity-pulse-badge active";
                    homeLiveRing.className = "live-ring-icon playing active";
                    homeLiveIcon.textContent = "🔊";
                    const currentStory = appState.stories[0]; // latest
                    homeLiveTitle.textContent = "Reading Story Aloud";
                    homeLiveDesc.textContent = `Liam is listening to: "${currentStory ? currentStory.title : 'Whimsical story'}"`;
                    
                    // Apply dominant glow color to activity ring
                    let maxCount = 0;
                    let dominantCat = null;
                    if (packet.beads) {
                        Object.keys(packet.beads).forEach(cat => {
                            if (packet.beads[cat] > maxCount) {
                                maxCount = packet.beads[cat];
                                dominantCat = cat;
                            }
                        });
                    }
                    if (dominantCat && characterMap[dominantCat]) {
                        homeLiveRing.style.borderColor = characterMap[dominantCat].color;
                    } else {
                        homeLiveRing.style.removeProperty("border-color");
                    }
                } else {
                    if (totalBeads > 0) {
                        homeLiveStatusBadge.textContent = "Loaded";
                        homeLiveStatusBadge.className = "activity-pulse-badge active";
                        homeLiveRing.className = "live-ring-icon active";
                        homeLiveIcon.textContent = "⚖️";
                        homeLiveTitle.textContent = "Storybox Loaded";
                        homeLiveDesc.textContent = `Beads stacked (${totalBeads}/20). Liam is ready to start his story!`;
                        
                        // Apply dominant glow color to activity ring
                        let maxCount = 0;
                        let dominantCat = null;
                        if (packet.beads) {
                            Object.keys(packet.beads).forEach(cat => {
                                if (packet.beads[cat] > maxCount) {
                                    maxCount = packet.beads[cat];
                                    dominantCat = cat;
                                }
                            });
                        }
                        if (dominantCat && characterMap[dominantCat]) {
                            homeLiveRing.style.borderColor = characterMap[dominantCat].color;
                        } else {
                            homeLiveRing.style.removeProperty("border-color");
                        }
                    } else {
                        homeLiveStatusBadge.textContent = "Idle";
                        homeLiveStatusBadge.className = "activity-pulse-badge";
                        homeLiveRing.className = "live-ring-icon";
                        homeLiveIcon.textContent = "💤";
                        homeLiveTitle.textContent = "Storybox is Idle";
                        homeLiveDesc.textContent = "No beads currently stacked. Liam can plug in food beads on the physical box to start.";
                        homeLiveRing.style.removeProperty("border-color");
                    }
                }

                // Eject/Update bead status slots
                if (packet.beads) {
                    const beadConfigChanged = JSON.stringify(appState.beads) !== JSON.stringify(packet.beads);
                    
                    if (beadConfigChanged) {
                        appState.beads = packet.beads;
                        syncPhysicalBeadCards();
                        syncNarrativeMetaUI();
                    }
                }

                // Trigger automatic story archive generation on Play start
                if (!wasPlaying && packet.playing) {
                    writeToConsole(`[STORY START] Storybox starting play phase. Compiling API request...`, 'system');
                    generateAndLogTelemetryStory();
                }
            }
        } catch (e) {
            writeToConsole(`[RAW RX] ${message}`, 'inbound');
        }
    }

    function syncNarrativeMetaUI() {
        updateCompiledPromptView();
    }

    // ======================================================================
    // Connection Badging & Bridge Control
    // ======================================================================

    function updateConnectionBadgeUI(status) {
        // Toggle badging indicators
        const badgeClass = status === 'connected' ? 'online' : 'offline';
        homeStatusBadge.className = 'status-indicator ' + badgeClass;
        miniStatusDot.className = 'status-dot ' + status;
        
        if (status === 'connected') {
            homeStatusBadge.textContent = 'ONLINE';
            miniStatusLabel.textContent = 'Storybox';
            btnConnect.textContent = 'Disconnect Board';
            btnConnect.className = 'btn-settings-action secondary';
            writeToConsole('[CONNECTION] Storybox link established.', 'system');
        } else if (status === 'connecting') {
            homeStatusBadge.textContent = 'CONNECTING';
            homeStatusBadge.className = 'status-indicator simulated';
            miniStatusLabel.textContent = 'Connecting';
            btnConnect.textContent = 'Connecting...';
            btnConnect.disabled = true;
        } else {
            homeStatusBadge.textContent = 'OFFLINE';
            miniStatusLabel.textContent = 'Storybox';
            btnConnect.textContent = 'Connect Board';
            btnConnect.className = 'btn-settings-action';
            btnConnect.disabled = false;
            writeToConsole('[CONNECTION] Storybox disconnected.', 'system');
        }
    }

    bridgeTypeSelect.addEventListener('change', () => {
        const type = bridgeTypeSelect.value;
        if (type === 'mock') {
            remoteAddressRow.classList.add('hide');
            btnClearBeads.classList.add('hide');
        } else {
            remoteAddressRow.classList.remove('hide');
            btnClearBeads.classList.remove('hide');
            
            if (type === 'websocket') {
                remoteAddressInput.value = 'ws://192.168.1.20:8080';
            } else {
                remoteAddressInput.value = 'http://192.168.1.20:80';
            }
        }

        if (currentBridge.status !== 'disconnected') {
            currentBridge.disconnect();
        }
    });

    btnConnect.addEventListener('click', () => {
        if (currentBridge.status === 'connected') {
            currentBridge.disconnect();
            return;
        }

        const type = bridgeTypeSelect.value;
        const address = remoteAddressInput.value.trim();

        if (type === 'mock') {
            currentBridge = new MockStoryboxBridge();
        } else if (type === 'websocket') {
            if (address === '') {
                alert("WebSocket address cannot be empty!");
                return;
            }
            currentBridge = new WebSocketStoryboxBridge();
        } else if (type === 'http') {
            if (address === '') {
                alert("REST server URL path cannot be empty!");
                return;
            }
            currentBridge = new HTTPStoryboxBridge();
        }

        currentBridge.onStatusChange(updateConnectionBadgeUI);
        currentBridge.onMessage(handleInboundTelemetry);
        currentBridge.connect(address);
    });

    // Auto connect default Mock mode
    currentBridge.onStatusChange(updateConnectionBadgeUI);
    currentBridge.onMessage(handleInboundTelemetry);
    currentBridge.connect();

    // Initial render
    renderStoriesList();
});
