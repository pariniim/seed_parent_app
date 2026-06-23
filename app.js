/**
 * Seed Parent Companion App - Storybox IoT Dashboard Logic
 * Coordinates settings transmission (TX), parses real-time device telemetry (RX),
 * monitors health diagnostics, and dynamic AI prompt compilation.
 */

// ==========================================================================
// 1. Connection Bridges
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
        this.driftInterval = null;
        this.battery = 82;
        this.cpuTemp = 34.2;
        this.wifiRssi = -42;
        this.isPlaying = false;
        
        // Mock physical beads on the board (can change over time)
        this.mockBeads = {
            meat: 0,
            grains: 0,
            dairy: 0,
            plants: 0
        };

        this.deviceState = {
            volume: 65,
            voice: 'FEMALE',
            lang: 'en',
            sleepTimer: 'off',
            avgLength: 'medium',
            ledBrightness: 180,
            ledSpeed: 15,
            ledColor: '#0ea5e9'
        };
    }

    connect(address) {
        this.updateStatus('connecting');
        setTimeout(() => {
            this.updateStatus('connected');
            this.startDiagnosticsFeed();
        }, 600);
    }

    disconnect() {
        this.stopDiagnosticsFeed();
        this.updateStatus('disconnected');
    }

    send(dataString) {
        try {
            const config = JSON.parse(dataString);
            Object.assign(this.deviceState, config);
            
            // Simulating short latency and sending ACK packet
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
        // Feed loop representing periodic telemetry pushing from Arduino (1500ms)
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

        // Drift loop representing a child dynamically plugging in beads on the board (every 12s)
        this.driftInterval = setInterval(() => {
            const keys = Object.keys(this.mockBeads);
            const randomKey = keys[Math.floor(Math.random() * keys.length)];
            
            // Decide whether to add, remove, or do nothing
            const rand = Math.random();
            if (rand < 0.4) {
                // Add a bead if below cap 5
                if (this.mockBeads[randomKey] < 5) {
                    this.mockBeads[randomKey]++;
                }
            } else if (rand < 0.7) {
                // Eject a bead if count > 0
                if (this.mockBeads[randomKey] > 0) {
                    this.mockBeads[randomKey]--;
                }
            }
        }, 12000);
    }

    stopDiagnosticsFeed() {
        if (this.telemetryInterval) {
            clearInterval(this.telemetryInterval);
            this.telemetryInterval = null;
        }
        if (this.driftInterval) {
            clearInterval(this.driftInterval);
            this.driftInterval = null;
        }
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
            // Address protocol check
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
        
        // Ensure proper HTTP URL prefix
        this.serverUrl = address.startsWith('http://') || address.startsWith('https://')
            ? address
            : `http://${address}`;

        // Attempt initial Ping/Telemetry check
        fetch(`${this.serverUrl}/telemetry`)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP status ${res.status}`);
                return res.json();
            })
            .then(data => {
                this.updateStatus('connected');
                
                // Start polling HTTP telemetry every 1.5s
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
// 2. UI Coordinator & Narrative Engine
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    let currentBridge = new MockStoryboxBridge();

    // UI Nodes - Connections
    const bridgeTypeSelect = document.getElementById('bridge-type');
    const remoteAddressRow = document.getElementById('remote-address-row');
    const remoteAddressInput = document.getElementById('remote-address');
    const btnConnect = document.getElementById('btn-connect');
    const connectionStatusBadge = document.getElementById('connection-status');
    const connectionStatusLabel = connectionStatusBadge.querySelector('.status-label');

    // UI Nodes - Story Settings inputs
    const inputVolume = document.getElementById('device-volume');
    const selectLanguage = document.getElementById('device-lang');
    const selectSleepTimer = document.getElementById('sleep-timer');
    const selectVoiceButtons = document.querySelectorAll('[data-voice]');
    const selectLengthButtons = document.querySelectorAll('[data-length]');

    // UI Nodes - LEDs
    const inputLedBrightness = document.getElementById('led-brightness');
    const inputLedSpeed = document.getElementById('led-speed');
    const inputLedColor = document.getElementById('led-color');

    // WiFi Setup
    const inputWifiSsid = document.getElementById('wifi-ssid');
    const inputWifiPass = document.getElementById('wifi-pass');
    const btnSaveWifi = document.getElementById('btn-save-wifi');

    // Display Labels
    const valVolume = document.getElementById('volume-val');
    const valVoice = document.getElementById('voice-val');
    const valLength = document.getElementById('length-val');
    const valLedBrightness = document.getElementById('led-brightness-val');
    const valLedSpeed = document.getElementById('led-speed-val');
    const valLedColor = document.getElementById('led-color-val');

    // Diagnostics Display
    const valBatteryPct = document.getElementById('battery-percentage');
    const valBatteryFill = document.getElementById('battery-fill');
    const valCpuTemp = document.getElementById('diag-cpu');
    const valWifiRssi = document.getElementById('diag-wifi');
    const playbackStatusText = document.getElementById('current-playback-status');

    // Read-only Bead Slot Elements
    const beadStatusCards = document.querySelectorAll('.bead-status-card');

    // Narrative Properties
    const labelProtagonist = document.getElementById('meta-protagonist');
    const labelBalance = document.getElementById('meta-balance');
    const btnClearBeads = document.getElementById('btn-clear-beads');

    // Debug Console & AI Compiler
    const consoleOutput = document.getElementById('console-output');
    const promptOutput = document.getElementById('prompt-output');
    const btnClearConsole = document.getElementById('btn-clear-console');
    const tabButtons = document.querySelectorAll('.console-tab');

    // 4-Category Character Dictionary (Seed v2.2)
    const characterMap = {
        meat: { name: "Mr. Chicken", label: "Meat/Fish", color: "#f07167" },
        grains: { name: "Mrs. Rice", label: "Grains", color: "#ffd166" },
        dairy: { name: "Egghead", label: "Dairy", color: "#4ea8de" },
        plants: { name: "Miss Banana", label: "Fruits & Veg", color: "#8ac926" }
    };

    // Dashboard State Object
    let appState = {
        volume: 65,
        voice: 'FEMALE',
        lang: 'en',
        sleepTimer: 'off',
        avgLength: 'medium',
        ledBrightness: 180,
        ledSpeed: 15,
        ledColor: '#0ea5e9',
        userSelectedLedColor: '#0ea5e9',
        wifiSsid: '',
        wifiPass: '',
        
        // Bead counts read from physical box telemetry
        beads: {
            meat: 0,
            grains: 0,
            dairy: 0,
            plants: 0
        },
        isPlaying: false,
        totalStoriesGenerated: 0
    };

    // Initialize UI backgrounds
    updateSliderBackgrounds();

    // ======================================================================
    // UI General Helpers
    // ======================================================================

    function writeToConsole(message, type = 'system') {
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        const time = new Date().toLocaleTimeString([], { hour12: false });
        entry.textContent = `[${time}] ${message}`;
        consoleOutput.appendChild(entry);
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
        
        // Cap lines at 80 to prevent DOM overflow
        while (consoleOutput.children.length > 80) {
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

    // Dynamic LED color overrides for settings
    function syncLEDColor() {
        const beads = appState.beads;
        const totalBeads = Object.values(beads).reduce((a, b) => a + b, 0);

        if (totalBeads === 0) {
            const defaultColor = appState.userSelectedLedColor || '#0ea5e9';
            appState.ledColor = defaultColor;
            valLedColor.textContent = defaultColor.toUpperCase();
            inputLedColor.value = defaultColor.toLowerCase();
            return;
        }

        let maxCount = 0;
        Object.keys(beads).forEach(k => {
            if (beads[k] > maxCount) {
                maxCount = beads[k];
            }
        });

        const dominantKeys = Object.keys(beads).filter(k => beads[k] === maxCount && maxCount > 0);

        if (dominantKeys.length === 1) {
            const dominantColor = characterMap[dominantKeys[0]].color;
            appState.ledColor = dominantColor;
            valLedColor.textContent = dominantColor.toUpperCase();
            inputLedColor.value = dominantColor.toLowerCase();
        } else if (dominantKeys.length > 1) {
            // Just display the first dominant color for configuration status
            const blendColor = characterMap[dominantKeys[0]].color;
            appState.ledColor = blendColor;
            valLedColor.textContent = blendColor.toUpperCase() + "*";
            inputLedColor.value = blendColor.toLowerCase();
        }
    }

    // Sync read-only beads status display cards
    function syncPhysicalBeadCards() {
        Object.keys(appState.beads).forEach(key => {
            const count = appState.beads[key];
            const card = document.querySelector(`.bead-status-card.${key}`);
            const countLabel = document.getElementById(`count-${key}`);
            const progressBar = document.getElementById(`bar-${key}`);

            if (card && countLabel && progressBar) {
                countLabel.textContent = count;
                progressBar.style.width = `${(count / 5) * 100}%`;

                if (count > 0) {
                    card.classList.add('active');
                } else {
                    card.classList.remove('active');
                }
            }
        });
        
        syncLEDColor();
    }

    // ======================================================================
    // Tab Controller
    // ======================================================================

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
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

    // ======================================================================
    // Narrative Calculator (Storybox Rules v2.2)
    // ======================================================================

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

        // Determine Tone Pacing Balance
        // - Perfectly Balanced: All active categories are equal AND all 4 are active.
        // - Balanced: Active category counts difference <= 1.
        // - Unbalanced: Maximum count >= 3, or only 1 category active.
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

    function syncNarrativeMetaUI() {
        const meta = calculateNarrativeProperties();
        labelProtagonist.textContent = meta.protagonist;
        labelBalance.textContent = meta.balance;
        updateCompiledPromptView();
    }

    // ======================================================================
    // Prompt Compiler Engine (Seed v2.2)
    // ======================================================================

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
    // Settings Event Handlers (TX)
    // ======================================================================

    function sendConfigPayload() {
        const payload = {
            volume: appState.volume,
            voice: appState.voice,
            lang: appState.lang,
            sleepTimer: appState.sleepTimer,
            avgLength: appState.avgLength,
            ledBrightness: appState.ledBrightness,
            ledSpeed: appState.ledSpeed,
            ledColor: appState.ledColor
        };
        
        writeToConsole(`[TX CONFIG] Pushing: ${JSON.stringify(payload)}`, 'outbound');
        currentBridge.send(JSON.stringify(payload));
    }

    // Volume Drag Listener
    inputVolume.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        appState.volume = val;
        valVolume.textContent = `${val}%`;
        updateSliderBackgrounds();
    });
    // Volume Release Listener
    inputVolume.addEventListener('change', sendConfigPayload);

    // Voice Segment Selector
    selectVoiceButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            selectVoiceButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const voice = btn.dataset.voice.toUpperCase();
            appState.voice = voice;
            valVoice.textContent = btn.textContent;
            sendConfigPayload();
        });
    });

    // Language Dropdown
    selectLanguage.addEventListener('change', (e) => {
        appState.lang = e.target.value;
        writeToConsole(`[SYSTEM] Language updated to ${selectLanguage.options[selectLanguage.selectedIndex].text}.`, 'system');
        sendConfigPayload();
    });

    // Sleep Timer Dropdown
    selectSleepTimer.addEventListener('change', (e) => {
        appState.sleepTimer = e.target.value;
        writeToConsole(`[SYSTEM] Sleep timer updated to: ${selectSleepTimer.options[selectSleepTimer.selectedIndex].text}.`, 'system');
        sendConfigPayload();
    });

    // Story Duration Segment Selector
    selectLengthButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            selectLengthButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const len = btn.dataset.length;
            appState.avgLength = len;
            
            let displayStr = 'Medium (7m)';
            if (len === 'short') displayStr = 'Short (3m)';
            if (len === 'long') displayStr = 'Long (15m)';
            valLength.textContent = displayStr;
            sendConfigPayload();
        });
    });

    // LED Brightness
    inputLedBrightness.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        appState.ledBrightness = val;
        valLedBrightness.textContent = val;
        updateSliderBackgrounds();
    });
    inputLedBrightness.addEventListener('change', sendConfigPayload);

    // LED Speed
    inputLedSpeed.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        appState.ledSpeed = val;
        valLedSpeed.textContent = `${(val / 10).toFixed(1)}x`;
        updateSliderBackgrounds();
    });
    inputLedSpeed.addEventListener('change', sendConfigPayload);

    // LED Color Picker
    inputLedColor.addEventListener('input', (e) => {
        const color = e.target.value.toUpperCase();
        appState.userSelectedLedColor = color;
        valLedColor.textContent = color;
        
        // Deactivate color presets
        document.querySelectorAll('.swatch').forEach(sw => sw.classList.remove('active'));
        
        syncLEDColor();
    });
    inputLedColor.addEventListener('change', sendConfigPayload);

    // LED Swatch Presets
    document.querySelectorAll('.swatch').forEach(swatch => {
        swatch.addEventListener('click', () => {
            document.querySelectorAll('.swatch').forEach(sw => sw.classList.remove('active'));
            swatch.classList.add('active');
            
            const color = swatch.dataset.color.toUpperCase();
            appState.userSelectedLedColor = color;
            
            syncLEDColor();
            sendConfigPayload();
        });
    });

    // WiFi Configuration
    btnSaveWifi.addEventListener('click', () => {
        const ssid = inputWifiSsid.value.trim();
        const pass = inputWifiPass.value.trim();
        if (ssid === '') {
            writeToConsole(`[WIFI ERROR] SSID cannot be blank.`, 'error');
            return;
        }
        appState.wifiSsid = ssid;
        appState.wifiPass = pass;
        
        writeToConsole(`[WIFI TX] Sending network settings for "${ssid}"...`, 'outbound');
        
        // Simulating writing to Arduino serial port
        currentBridge.send(JSON.stringify({ wifiSsid: ssid, wifiPass: pass }));
        
        setTimeout(() => {
            writeToConsole(`[WIFI RX ACK] WiFi SSID and credentials written to flash memory.`, 'inbound');
        }, 300);
    });

    // Reset Calibration button callback (In case they want to eject simulation beads)
    btnClearBeads.addEventListener('click', () => {
        if (currentBridge instanceof MockStoryboxBridge) {
            currentBridge.mockBeads = { meat: 0, grains: 0, dairy: 0, plants: 0 };
            writeToConsole('[SIMULATOR] Cleared all bead slots.', 'system');
        }
    });

    // ======================================================================
    // Telemetry Receiver Manager (RX)
    // ======================================================================

    function handleInboundTelemetry(message, type) {
        if (type === 'error') {
            writeToConsole(message, 'error');
            return;
        }

        try {
            const packet = JSON.parse(message);

            // 1. Connection settings ACK
            if (packet.success && packet.applied) {
                writeToConsole(`[ACK RX] Config applied: ${JSON.stringify(packet.applied)}`, 'inbound');
                return;
            }

            // 2. Hardware Telemetry Packet
            if (packet.battery !== undefined) {
                // Log raw packet in console
                writeToConsole(`[RX TELEMETRY] Raw: ${message}`, 'inbound');

                // Update Battery Widgets
                valBatteryPct.textContent = `${packet.battery}%`;
                valBatteryFill.style.width = `${packet.battery}%`;
                
                // Color codes battery levels
                if (packet.battery < 20) {
                    valBatteryFill.style.backgroundColor = 'var(--accent-meat)';
                } else if (packet.battery < 50) {
                    valBatteryFill.style.backgroundColor = 'var(--accent-grains)';
                } else {
                    valBatteryFill.style.backgroundColor = 'var(--accent-green)';
                }

                // Diagnostics Stats
                valCpuTemp.textContent = `${packet.cpu.toFixed(1)} °C`;
                valWifiRssi.textContent = `${packet.rssi} dBm`;
                
                appState.isPlaying = packet.playing;
                playbackStatusText.textContent = packet.playing ? 'Playing' : 'Stopped';
                if (packet.playing) {
                    playbackStatusText.style.color = 'var(--accent-green)';
                } else {
                    playbackStatusText.style.color = 'var(--text-secondary)';
                }

                // Check bead status updates
                if (packet.beads) {
                    const countChanged = JSON.stringify(appState.beads) !== JSON.stringify(packet.beads);
                    
                    if (countChanged) {
                        appState.beads = packet.beads;
                        syncPhysicalBeadCards();
                        syncNarrativeMetaUI();
                    }
                }
            }
        } catch (e) {
            // Non-JSON logging
            writeToConsole(`[RAW RX] ${message}`, 'inbound');
        }
    }

    // ======================================================================
    // Connection Management
    // ======================================================================

    function updateConnectionBadgeUI(status) {
        connectionStatusBadge.className = 'connection-status-badge ' + status;
        
        if (status === 'connected') {
            connectionStatusLabel.textContent = 'Connected';
            btnConnect.textContent = 'Disconnect Board';
            btnConnect.className = 'btn-primary-small';
            writeToConsole('[CONNECTION] Storybox device online.', 'system');
        } else if (status === 'connecting') {
            connectionStatusLabel.textContent = 'Connecting...';
            btnConnect.textContent = 'Connecting...';
            btnConnect.disabled = true;
        } else {
            connectionStatusLabel.textContent = 'Disconnected';
            btnConnect.textContent = 'Connect Board';
            btnConnect.className = 'btn-primary';
            btnConnect.disabled = false;
            writeToConsole('[CONNECTION] Storybox disconnected.', 'system');
        }
    }

    // Toggle Connection address UI based on bridge type
    bridgeTypeSelect.addEventListener('change', () => {
        const type = bridgeTypeSelect.value;
        
        if (type === 'mock') {
            remoteAddressRow.classList.add('hide');
            btnClearBeads.classList.add('hide');
        } else {
            remoteAddressRow.classList.remove('hide');
            btnClearBeads.classList.remove('hide'); // Allow reset calibration when connected
            
            if (type === 'websocket') {
                remoteAddressInput.value = 'ws://192.168.1.20:8080';
            } else {
                remoteAddressInput.value = 'http://192.168.1.20:80';
            }
        }

        // Auto disconnect current bridge when changing type
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
                writeToConsole('[CONNECTION ERROR] WebSocket address cannot be empty.', 'error');
                return;
            }
            currentBridge = new WebSocketStoryboxBridge();
        } else if (type === 'http') {
            if (address === '') {
                writeToConsole('[CONNECTION ERROR] HTTP Server URL cannot be empty.', 'error');
                return;
            }
            currentBridge = new HTTPStoryboxBridge();
        }

        // Register callbacks
        currentBridge.onStatusChange((status) => {
            updateConnectionBadgeUI(status);
        });

        currentBridge.onMessage((msg, msgType) => {
            handleInboundTelemetry(msg, msgType);
        });

        // Fire connection
        currentBridge.connect(address);
    });

    // Mobile Tab Navigation click handlers
    const mobileTabButtons = document.querySelectorAll('.mobile-tab-bar .tab-item');
    const mobileTabPanels = document.querySelectorAll('.mobile-tab-panel');

    mobileTabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            mobileTabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const targetTab = btn.dataset.mobileTab;
            
            mobileTabPanels.forEach(panel => {
                panel.classList.remove('active');
                if (panel.id === `panel-${targetTab}`) {
                    panel.classList.add('active');
                }
            });

            writeToConsole(`[SYSTEM] Switched mobile view to: ${targetTab}`, 'system');
        });
    });

    // Auto connect mock mode on page load
    currentBridge.onStatusChange((status) => {
        updateConnectionBadgeUI(status);
    });
    currentBridge.onMessage((msg, msgType) => {
        handleInboundTelemetry(msg, msgType);
    });
    currentBridge.connect();

});
