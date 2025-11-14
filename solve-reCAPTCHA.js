// ==UserScript==
// @name         Buster: Captcha Solver for Humans (Complete)
// @namespace    buster-captcha-solver
// @version      1.0.0
// @description  Complete Buster extension functionality as userscript - solves audio captchas automatically
// @author       Buster Team
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // WIT.ai Mobile API Integration für Buster
    // Verwendet direkte API-Aufrufe statt Native Messaging für mobile Browser
    const WIT_API_KEY = 'YOUR_KEY_HERE';
    const WIT_API_URL = 'https://api.wit.ai/speech';

    class WitAiMobile {
        constructor() {
            this.apiKey = WIT_API_KEY;
            this.isAvailable = this.testApiConnection();
        }

        async testApiConnection() {
            try {
                const response = await fetch('https://api.wit.ai/message?q=test', {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                });
                return response.ok;
            } catch (error) {
                console.error('WIT.ai API Test fehlgeschlagen:', error);
                return false;
            }
        }

        async prepareAudio(audioBuffer, {trimStart = 0, trimEnd = 0} = {}) {
            // audioBuffer ist bereits ein AudioBuffer (nicht ArrayBuffer)
            const audioSlice = await this.sliceAudio({
                audioBuffer,
                start: trimStart,
                end: audioBuffer.duration - trimEnd
            });
            return this.audioBufferToWav(audioSlice);
        }

        async normalizeAudio(buffer) {
            const ctx = new AudioContext();
            const audioBuffer = await ctx.decodeAudioData(buffer);
            ctx.close();

            const offlineCtx = new OfflineAudioContext(
                1,
                audioBuffer.duration * 16000,
                16000
            );
            const source = offlineCtx.createBufferSource();
            source.connect(offlineCtx.destination);
            source.buffer = audioBuffer;
            source.start();

            return offlineCtx.startRendering();
        }

        async sliceAudio({audioBuffer, start, end}) {
            const sampleRate = audioBuffer.sampleRate;
            const channels = audioBuffer.numberOfChannels;

            const startOffset = sampleRate * start;
            const endOffset = sampleRate * end;
            const frameCount = endOffset - startOffset;

            const ctx = new AudioContext();
            const audioSlice = ctx.createBuffer(channels, frameCount, sampleRate);

            const tempArray = new Float32Array(frameCount);
            for (var channel = 0; channel < channels; channel++) {
                audioBuffer.copyFromChannel(tempArray, channel, startOffset);
                audioSlice.copyToChannel(tempArray, channel, 0);
            }

            ctx.close();
            return audioSlice;
        }

        async convertMp3ToWav(arrayBuffer) {
            try {
                console.log('AudioConverter: Starte MP3-zu-WAV Konvertierung...');

                // 1. ArrayBuffer zu AudioBuffer dekodieren
                console.log('AudioConverter: Dekodiere ArrayBuffer zu AudioBuffer...');
                const audioBuffer = await this.normalizeAudio(arrayBuffer);
                console.log('AudioConverter: AudioBuffer dekodiert', 'success');

                // 2. Audio trimmen (wie Buster)
                const audioOptions = {trimStart: 1.5, trimEnd: 1.5};
                console.log('AudioConverter: Trimming Audio mit Optionen:', audioOptions);
                const wavBuffer = await this.prepareAudio(audioBuffer, audioOptions);
                console.log('AudioConverter: Audio getrimmt und zu WAV konvertiert', 'success');

                return wavBuffer;

            } catch (error) {
                console.error('AudioConverter: Konvertierung fehlgeschlagen:', error);
                throw error;
            }
        }

        async trimAudio(audioBuffer, {trimStart = 0, trimEnd = 0} = {}) {
            const sampleRate = audioBuffer.sampleRate;
            const channels = audioBuffer.numberOfChannels;

            const startOffset = Math.floor(sampleRate * trimStart);
            const endOffset = Math.floor(sampleRate * (audioBuffer.duration - trimEnd));
            const frameCount = endOffset - startOffset;

            const ctx = new AudioContext();
            const audioSlice = ctx.createBuffer(channels, frameCount, sampleRate);

            const tempArray = new Float32Array(frameCount);
            for (let channel = 0; channel < channels; channel++) {
                audioBuffer.copyFromChannel(tempArray, channel, startOffset);
                audioSlice.copyToChannel(tempArray, channel, 0);
            }

            ctx.close();
            return audioSlice;
        }

        async normalizeAudio(arrayBuffer) {
            const ctx = new AudioContext();
            const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
            ctx.close();

            // Korrekte Frame-Berechnung: Anzahl Samples = Duration * SampleRate
            const numFrames = Math.max(1, Math.floor(audioBuffer.duration * 16000));

            const offlineCtx = new OfflineAudioContext(
                1, // Mono
                numFrames,
                16000 // 16kHz
            );
            const source = offlineCtx.createBufferSource();
            source.connect(offlineCtx.destination);
            source.buffer = audioBuffer;
            source.start();

            return offlineCtx.startRendering();
        }

        audioBufferToWav(buffer, opt) {
            opt = opt || {};

            var numChannels = buffer.numberOfChannels;
            var sampleRate = buffer.sampleRate;
            var format = opt.float32 ? 3 : 1;
            var bitDepth = format === 3 ? 32 : 16;

            var result;
            if (numChannels === 2) {
                result = this.interleave(buffer.getChannelData(0), buffer.getChannelData(1));
            } else {
                result = buffer.getChannelData(0);
            }

            return this.encodeWAV(result, format, sampleRate, numChannels, bitDepth);
        }

        interleave(inputL, inputR) {
            var length = inputL.length + inputR.length;
            var result = new Float32Array(length);

            var index = 0;
            var inputIndex = 0;

            while (index < length) {
                result[index++] = inputL[inputIndex];
                result[index++] = inputR[inputIndex];
                inputIndex++;
            }
            return result;
        }

        encodeWAV(samples, format, sampleRate, numChannels, bitDepth) {
            var bytesPerSample = bitDepth / 8;
            var blockAlign = numChannels * bytesPerSample;

            var buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
            var view = new DataView(buffer);

            /* RIFF identifier */
            this.writeString(view, 0, 'RIFF');
            /* RIFF chunk length */
            view.setUint32(4, 36 + samples.length * bytesPerSample, true);
            /* RIFF type */
            this.writeString(view, 8, 'WAVE');
            /* format chunk identifier */
            this.writeString(view, 12, 'fmt ');
            /* format chunk length */
            view.setUint32(16, 16, true);
            /* sample format (raw) */
            view.setUint16(20, format, true);
            /* channel count */
            view.setUint16(22, numChannels, true);
            /* sample rate */
            view.setUint32(24, sampleRate, true);
            /* byte rate (sample rate * block align) */
            view.setUint32(28, sampleRate * blockAlign, true);
            /* block align (channel count * bytes per sample) */
            view.setUint16(32, blockAlign, true);
            /* bits per sample */
            view.setUint16(34, bitDepth, true);
            /* data chunk identifier */
            this.writeString(view, 36, 'data');
            /* data chunk length */
            view.setUint32(40, samples.length * bytesPerSample, true);
            if (format === 1) { // Raw PCM
                this.floatTo16BitPCM(view, 44, samples);
            } else {
                this.writeFloat32(view, 44, samples);
            }

            return buffer;
        }

        writeFloat32(output, offset, input) {
            for (var i = 0; i < input.length; i++, offset += 4) {
                output.setFloat32(offset, input[i], true);
            }
        }

        floatTo16BitPCM(output, offset, input) {
            for (var i = 0; i < input.length; i++, offset += 2) {
                var s = Math.max(-1, Math.min(1, input[i]));
                output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
            }
        }

        writeString(view, offset, string) {
            for (var i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        }

        async transcribeAudio(audioUrl, lang = 'en') {
            try {
                console.log('WIT.ai Mobile: Starte Transkription von:', audioUrl.substring(0, 50) + '...');

                // EXAKT wie Buster: Audio mit GM_xmlhttpRequest laden (CORS-Umgehung)
                console.log('WIT.ai Mobile: Lade Audio mit GM_xmlhttpRequest...');
                const audioBuffer = await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: audioUrl,
                        headers: {
                            'Referer': window.location.href,
                            'User-Agent': navigator.userAgent
                        },
                        responseType: 'arraybuffer',
                        onload: function(response) {
                            if (response.status === 200) {
                                console.log('WIT.ai Mobile: AudioBuffer erhalten, Größe:', response.response.byteLength);
                                resolve(response.response);
                            } else {
                                reject(new Error(`Audio Download Fehler ${response.status}`));
                            }
                        },
                        onerror: function(error) {
                            reject(new Error('Netzwerkfehler beim Audio Download'));
                        }
                    });
                });

                // Konvertiere MP3 zu WAV (wie Buster)
                console.log('WIT.ai Mobile: Konvertiere MP3 zu WAV...');
                const wavBuffer = await this.convertMp3ToWav(audioBuffer);
                console.log('WIT.ai Mobile: WAV konvertiert, Größe:', wavBuffer.byteLength);

                // WAV als Blob für GM_xmlhttpRequest
                const wavBlob = new Blob([wavBuffer], {type: 'audio/wav'});

                // Sende WAV an WIT.ai API (exakt wie Buster)
                console.log('WIT.ai Mobile: Sende WAV an WIT.ai API...');
                const result = await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: 'POST',
                        url: `${WIT_API_URL}?v=20240304`,
                        headers: {
                            'Authorization': `Bearer ${this.apiKey}`,
                            'Content-Type': 'audio/wav',
                            'Accept': 'application/json'
                        },
                        data: wavBlob,
                        responseType: 'json',
                        onload: function(response) {
                            if (response.status === 200) {
                                // DEBUG: Zeige rohe Response
                                console.log('WIT.ai DEBUG: Rohe Response:', response.responseText);
                                console.log('WIT.ai DEBUG: Response Object:', response.response);

                                // EXAKT wie Buster: Response text nehmen und letzte Zeile parsen
                                const responseText = response.responseText || JSON.stringify(response.response);
                                try {
                                    const data = JSON.parse(responseText.split('\r\n').at(-1));
                                    console.log('WIT.ai DEBUG: Geparste Daten:', data);
                                    resolve(data);
                                } catch (e) {
                                    console.log('WIT.ai DEBUG: Split-Fehler, verwende Fallback:', e);
                                    // Fallback: normales JSON parsen
                                    resolve(response.response);
                                }
                            } else {
                                reject(new Error(`WIT.ai API Fehler ${response.status}: ${JSON.stringify(response.response)}`));
                            }
                        },
                        onerror: function(error) {
                            reject(new Error('Netzwerkfehler bei WIT.ai API'));
                        }
                    });
                });
                console.log('WIT.ai Mobile: API Antwort erhalten:', result);

                // EXAKT wie Buster: Text aus der Antwort extrahieren
                let transcribedText = '';

                if (result.text) {
                    transcribedText = result.text;
                } else if (result._text) {
                    transcribedText = result._text;
                } else if (result.entities && result.entities.speech) {
                    transcribedText = result.entities.speech[0]?.value || '';
                }

                console.log('WIT.ai Mobile: Transkription erfolgreich:', transcribedText);
                return transcribedText.trim();

            } catch (error) {
                console.error('WIT.ai Mobile: Transkription fehlgeschlagen:', error);

                // Fallback: Versuche alternative Methoden
                try {
                    return await this.fallbackTranscription(audioUrl);
                } catch (fallbackError) {
                    console.error('WIT.ai Mobile: Fallback auch fehlgeschlagen:', fallbackError);
                    throw error; // Originalen Fehler werfen
                }
            }
        }

        async fallbackTranscription(audioUrl) {
            console.log('WIT.ai Mobile: Versuche Fallback-Transkription');

            // Web Speech API als Fallback
            if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                return await this.useWebSpeechAPI(audioUrl);
            }

            throw new Error('Keine Transkriptions-Methode verfügbar');
        }

        async useWebSpeechAPI(audioUrl) {
            return new Promise((resolve, reject) => {
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                const recognition = new SpeechRecognition();

                recognition.lang = 'en-US';
                recognition.continuous = false;
                recognition.interimResults = false;

                recognition.onresult = (event) => {
                    const transcript = event.results[0][0].transcript;
                    console.log('Web Speech API Ergebnis:', transcript);
                    resolve(transcript);
                };

                recognition.onerror = (event) => {
                    console.error('Web Speech API Fehler:', event.error);
                    reject(new Error('Web Speech API: ' + event.error));
                };

                recognition.onnomatch = () => {
                    reject(new Error('Web Speech API: Keine Übereinstimmung'));
                };

                // Starte Erkennung
                try {
                    recognition.start();
                } catch (error) {
                    reject(error);
                }
            });
        }
    }

    // Storage implementation for userscript
    const storage = {
        async get(keys) {
            if (typeof keys === 'string') {
                const value = GM_getValue(keys);
                return { [keys]: value };
            }
            if (Array.isArray(keys)) {
                const result = {};
                for (const key of keys) {
                    result[key] = GM_getValue(key);
                }
                return result;
            }
            if (typeof keys === 'object') {
                const result = {};
                for (const key of keys) {
                    result[key] = GM_getValue(key);
                }
                return result;
            }
            return {};
        },
        async set(items) {
            for (const [key, value] of Object.entries(items)) {
                GM_setValue(key, value);
            }
        },
        async remove(keys) {
            if (Array.isArray(keys)) {
                for (const key of keys) {
                    GM_deleteValue(key);
                }
            } else {
                GM_deleteValue(keys);
            }
        }
    };

    // Utility functions
    function getText(messageName, substitutions) {
        const messages = {
            'buttonLabel_reset': 'Reset',
            'buttonLabel_solve': 'Solve',
            'extensionName': 'Buster: Captcha Solver for Humans',
            'error_internalError': 'Internal error occurred',
            'error_missingClientApp': 'Client app is missing',
            'error_outdatedClientApp': 'Client app is outdated',
            'error_clientAppUpdateFailed': 'Client app update failed',
            'info_updatingClientApp': 'Updating client app'
        };
        return messages[messageName] || messageName;
    }

    function findNode(selector, {timeout = 0, throwError = true} = {}) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();

            function check() {
                const element = document.querySelector(selector);
                if (element) {
                    resolve(element);
                } else if (timeout && Date.now() - startTime < timeout) {
                    setTimeout(check, 100);
                } else if (throwError) {
                    reject(new Error(`Element not found: ${selector}`));
                } else {
                    resolve(null);
                }
            }

            check();
        });
    }

    function getRandomFloat(min, max) {
        return Math.random() * (max - min) + min;
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function meanSleep(ms) {
        const randomMs = ms + getRandomFloat(-100, 100);
        return sleep(Math.max(0, randomMs));
    }

    function getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function getBrowser() {
        const ua = navigator.userAgent;
        if (ua.includes('Chrome')) return {name: 'chrome', version: '100.0.0'};
        if (ua.includes('Firefox')) return {name: 'firefox', version: '100.0.0'};
        if (ua.includes('Safari')) return {name: 'safari', version: '100.0.0'};
        return {name: 'unknown', version: '100.0.0'};
    }

    function pingClientApp({stop = false, checkResponse = true} = {}) {
        return Promise.resolve({success: true, apiVersion: '2'});
    }

    // Mock browser.runtime.sendMessage functionality
    function mockBrowserRuntimeSendMessage(message) {
        return new Promise((resolve, reject) => {
            switch (message.id) {
                case 'resetCaptcha':
                    console.log('Reset captcha requested for URL:', message.challengeUrl);
                    resolve({success: true});
                    break;
                case 'messageClientApp':
                    // Mock client app messages
                    if (message.message.command === 'typeText') {
                        // Simulate typing text
                        setTimeout(() => {
                            resolve({success: true});
                        }, 1000);
                    } else if (message.message.command === 'pressKey') {
                        resolve({success: true});
                    } else if (message.message.command === 'releaseKey') {
                        resolve({success: true});
                    } else if (message.message.command === 'tapKey') {
                        resolve({success: true});
                    } else if (message.message.command === 'moveMouse') {
                        resolve({success: true});
                    } else if (message.message.command === 'clickMouse') {
                        resolve({success: true});
                    } else {
                        resolve({success: true});
                    }
                    break;
                case 'getOsScale':
                    resolve(1);
                    break;
                case 'getFramePos':
                    resolve({x: 0, y: 0});
                    break;
                case 'getPlatform':
                    resolve({os: 'unknown'});
                    break;
                case 'transcribeAudio':
                    // Fallback to WIT.ai mobile
                    const witAi = new WitAiMobile();
                    witAi.transcribeAudio(message.audioUrl, message.lang)
                        .then(result => resolve(result))
                        .catch(error => reject(error));
                    break;
                case 'captchaSolved':
                    console.log('Captcha solved notification sent');
                    resolve({success: true});
                    break;
                case 'notification':
                    console.log('Notification:', message.messageId);
                    alert(getText(message.messageId));
                    resolve({success: true});
                    break;
                case 'openOptions':
                    console.log('Options page would be opened');
                    resolve({success: true});
                    break;
                case 'stopClientApp':
                    resolve({success: true});
                    break;
                default:
                    resolve({success: true});
            }
        });
    }

    // CSS styles
    const solverButtonCSS = `
        #solver-button {
            background-image: url('data:image/svg+xml,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%20192%20192%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M71.182%20138.872l27.077%2027.077H8.002v-18.051c0-19.947%2032.312-36.103%2072.205-36.103l17.058.993-26.083%2026.084m9.025-117.333c19.939%200%2036.103%2016.164%2036.103%2036.103s-16.164%2036.103-36.103%2036.103S44.105%2077.58%2044.105%2057.641s16.163-36.102%2036.102-36.102z%22%20fill%3D%22%23ff9f43%22%2F%3E%3Cpath%20fill%3D%22%2327ae60%22%20d%3D%22M171.362%2098.256l12.636%2012.726-58.938%2059.479-31.319-31.589%2012.636-12.727%2018.683%2018.774%2046.302-46.663%22%2F%3E%3C%2Fsvg%3E') !important;
            background-position: center !important;
            background-repeat: no-repeat !important;
            background-size: 32px 32px !important;
            width: 48px !important;
            height: 48px !important;
            padding: 0 !important;
            border: 0 !important;
            background-color: transparent !important;
            opacity: 0.8 !important;
            cursor: pointer !important;
        }

        #solver-button:hover {
            background-color: #f8f9fa !important;
            border-color: #5f6368 !important;
        }

        #solver-button.working {
            background-image: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHN0eWxlPi5zcGlubmVye2FuaW1hdGlvbjpzcGluIDFzIGxpbmVhciBpbmZpbml0ZTt9QGtleWZyYW1lcyBzcGluezAle3RyYW5zZm9ybTpyb3RhdGUoMGRlZyk7fTEwMCV7dHJhbnNmb3JtOnJvdGF0ZSgzNjBkZWcpO308L3N0eWxlPgo8cGF0aCBjbGFzcz0ic3Bpbm5lciIgZD0iTTEyIDJDNy41OCAyIDQgNS41OCA0IDEwYzAgMS4yNy4zIDIuNDcuODIgMy41M2wxLjM4LTEuMzhDNS42MiAxMS4xMyA1LjUgMTAuNTkgNS41IDEwYzAtMi40OCAyLjAyLTQuNSA0LjUtNC41czQuNSAyLjAyIDQuNSA0LjVjMCAuNTktLjEyIDEuMTMtLjMgMS42NWwxLjM4IDEuMzhDMTkuNyAxMi40NyAyMCAxMS4yNyAyMCAxMGMwLTQuNDItMy41OC04LThoMFoiIGZpbGw9IiMwMDk2ODgiLz4KPC9zdmc+') !important;
        }

        #reset-button {
            background-image: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDVWMUw3IDZsNSA1VjdjMy4zMSAwIDYgMi42OSA2IDZzLTIuNjkgNi02IDYtNi0yLjY5LTYtNkg0YzAgNC40MiAzLjU4IDggOCA4czgtMy41OCA4LTgtMy41OC04LTgtOFoiIGZpbGw9IiNkYWRjZTAiLz4KPC9zdmc+') !important;
            background-position: center !important;
            background-repeat: no-repeat !important;
            background-size: 20px 20px !important;
            width: 28px !important;
            height: 28px !important;
            border: 1px solid #dadce0 !important;
            border-radius: 4px !important;
            cursor: pointer !important;
            margin: 0 !important;
            padding: 0 !important;
            background-color: #fff !important;
            transition: background-color 0.2s ease !important;
        }

        #reset-button:hover {
            background-color: #f8f9fa !important;
            border-color: #5f6368 !important;
        }

        .solver-controls {
            display: flex;
            gap: 8px;
            align-items: center;
            margin-left: auto;
        }
    `;

    function main() {
        // Script may be injected multiple times.
        if (self.baseModule) {
            return;
        } else {
            self.baseModule = true;
        }

        let solverWorking = false;
        let solverButton = null;

        function setSolverState({working = true} = {}) {
            solverWorking = working;
            if (solverButton) {
                if (working) {
                    solverButton.classList.add('working');
                } else {
                    solverButton.classList.remove('working');
                }
            }
        }

        function resetCaptcha() {
            return mockBrowserRuntimeSendMessage({
                id: 'resetCaptcha',
                challengeUrl: window.location.href
            });
        }

        function syncUI() {
            if (isBlocked()) {
                if (!document.querySelector('.solver-controls')) {
                    const div = document.createElement('div');
                    div.classList.add('solver-controls');

                    const button = document.createElement('button');
                    button.classList.add('rc-button');
                    button.setAttribute('tabindex', '0');
                    button.setAttribute('title', getText('buttonLabel_reset'));
                    button.id = 'reset-button';

                    button.addEventListener('click', resetCaptcha);

                    div.appendChild(button);
                    document.querySelector('.rc-footer').appendChild(div);
                }
                return;
            }

            const helpButton = document.querySelector('#recaptcha-help-button');
            if (helpButton) {
                helpButton.remove();

                const helpButtonHolder = document.querySelector('.help-button-holder');
                helpButtonHolder.tabIndex = document.querySelector('audio#audio-source')
                    ? 0
                    : 2;

                const shadow = helpButtonHolder.attachShadow({
                    mode: 'closed',
                    delegatesFocus: true
                });

                const style = document.createElement('style');
                style.textContent = solverButtonCSS;
                shadow.appendChild(style);

                solverButton = document.createElement('button');
                solverButton.setAttribute('tabindex', '0');
                solverButton.setAttribute('title', getText('buttonLabel_solve'));
                solverButton.id = 'solver-button';
                if (solverWorking) {
                    solverButton.classList.add('working');
                }

                solverButton.addEventListener('click', solveChallenge);

                shadow.appendChild(solverButton);
            }
        }

        function isBlocked({timeout = 0} = {}) {
            const selector = '.rc-doscaptcha-body';
            if (timeout) {
                return new Promise(resolve => {
                    findNode(selector, {timeout, throwError: false}).then(result =>
                        resolve(Boolean(result))
                    );
                });
            }

            return Boolean(document.querySelector(selector));
        }

        function dispatchEnter(node) {
            const keyEvent = {
                code: 'Enter',
                key: 'Enter',
                keyCode: 13,
                which: 13,
                // view: window, // ENTFERNT für Userscript Kompatibilität
                bubbles: true,
                composed: true,
                cancelable: true
            };

            node.focus();
            node.dispatchEvent(new KeyboardEvent('keydown', keyEvent));
            node.dispatchEvent(new KeyboardEvent('keypress', keyEvent));
            node.click();
        }

        async function navigateToElement(node, {forward = true} = {}) {
            if (document.activeElement === node) {
                return;
            }

            if (!forward) {
                await mockBrowserRuntimeSendMessage({id: 'messageClientApp', message: {command: 'pressKey', data: 'shift'}});
                await meanSleep(300);
            }

            while (document.activeElement !== node) {
                await mockBrowserRuntimeSendMessage({id: 'messageClientApp', message: {command: 'tapKey', data: 'tab'}});
                await meanSleep(300);
            }

            if (!forward) {
                await mockBrowserRuntimeSendMessage({id: 'messageClientApp', message: {command: 'releaseKey', data: 'shift'}});
                await meanSleep(300);
            }
        }

        async function tapEnter(node, {navigateForward = true} = {}) {
            await navigateToElement(node, {forward: navigateForward});
            await meanSleep(200);
            await mockBrowserRuntimeSendMessage({id: 'messageClientApp', message: {command: 'tapKey', data: 'enter'}});
        }

        async function clickElement(node, browserBorder, osScale) {
            const targetPos = await getClickPos(node, browserBorder, osScale);
            await mockBrowserRuntimeSendMessage({id: 'messageClientApp', message: {command: 'moveMouse', ...targetPos}});
            await meanSleep(100);
            await mockBrowserRuntimeSendMessage({id: 'messageClientApp', message: {command: 'clickMouse'}});
        }

        async function messageClientApp(message) {
            const rsp = await mockBrowserRuntimeSendMessage({
                id: 'messageClientApp',
                message
            });

            if (!rsp.success) {
                throw new Error(`Client app response: ${rsp.text}`);
            }

            return rsp;
        }

        async function getOsScale() {
            return mockBrowserRuntimeSendMessage({id: 'getOsScale'});
        }

        async function getBrowserBorder(clickEvent, osScale) {
            const framePos = await getFrameClientPos();
            const scale = window.devicePixelRatio;

            let evScreenPropScale = osScale;
            if (
                'firefox' === 'firefox' &&
                parseInt((await getBrowser()).version.split('.')[0], 10) >= 99
            ) {
                // https://bugzilla.mozilla.org/show_bug.cgi?id=1753836
                evScreenPropScale = scale;
            }

            return {
                left:
                    clickEvent.screenX * evScreenPropScale -
                    clickEvent.clientX * scale -
                    framePos.x -
                    window.screenX * scale,
                top:
                    clickEvent.screenY * evScreenPropScale -
                    clickEvent.clientY * scale -
                    framePos.y -
                    window.screenY * scale
            };
        }

        async function getFrameClientPos() {
            if (window !== window.top) {
                let frameIndex;
                const siblingWindows = window.parent.frames;
                for (let i = 0; i < siblingWindows.length; i++) {
                    if (siblingWindows[i] === window) {
                        frameIndex = i;
                        break;
                    }
                }

                return await mockBrowserRuntimeSendMessage({id: 'getFramePos', frameIndex});
            }

            return {x: 0, y: 0};
        }

        async function getElementScreenRect(node, browserBorder, osScale) {
            let {left: x, top: y, width, height} = node.getBoundingClientRect();

            const data = await getFrameClientPos();
            const scale = window.devicePixelRatio;

            x *= scale;
            y *= scale;
            width *= scale;
            height *= scale;

            x += data.x + browserBorder.left + window.screenX * scale;
            y += data.y + browserBorder.top + window.screenY * scale;

            const {os} = await mockBrowserRuntimeSendMessage({id: 'getPlatform'});
            if (['windows', 'macos'].includes(os)) {
                x /= osScale;
                y /= osScale;
                width /= osScale;
                height /= osScale;
            }

            return {x, y, width, height};
        }

        async function getClickPos(node, browserBorder, osScale) {
            let {x, y, width, height} = await getElementScreenRect(
                node,
                browserBorder,
                osScale
            );

            return {
                x: Math.round(x + width * getRandomFloat(0.4, 0.6)),
                y: Math.round(y + height * getRandomFloat(0.4, 0.6))
            };
        }

        async function solve(simulateUserInput, clickEvent) {
            if (isBlocked()) {
                return;
            }

            const {navigateWithKeyboard} = await storage.get('navigateWithKeyboard');

            let browserBorder;
            let osScale;
            let useMouse = true;
            if (simulateUserInput) {
                if (!navigateWithKeyboard && (clickEvent.clientX || clickEvent.clientY)) {
                    osScale = await getOsScale();
                    browserBorder = await getBrowserBorder(clickEvent, osScale);
                } else {
                    useMouse = false;
                }
            }

            const audioElSelector = 'audio#audio-source';
            let audioEl = document.querySelector(audioElSelector);
            if (!audioEl) {
                const audioButton = document.querySelector('#recaptcha-audio-button');
                if (simulateUserInput) {
                    if (useMouse) {
                        await clickElement(audioButton, browserBorder, osScale);
                    } else {
                        audioButton.focus();
                        await tapEnter(audioButton);
                    }
                } else {
                    dispatchEnter(audioButton);
                }

                const result = await Promise.race([
                    new Promise(resolve => {
                        findNode(audioElSelector, {timeout: 10000, throwError: false}).then(
                            el => {
                                meanSleep(500).then(() => resolve({audioEl: el}));
                            }
                        );
                    }),
                    new Promise(resolve => {
                        isBlocked({timeout: 10000}).then(blocked => resolve({blocked}));
                    })
                ]);

                if (result.blocked) {
                    return;
                }

                audioEl = result.audioEl;
            }

            if (simulateUserInput) {
                const muteAudio = function () {
                    audioEl.muted = true;
                };
                const unmuteAudio = function () {
                    removeCallbacks();
                    audioEl.muted = false;
                };

                audioEl.addEventListener('playing', muteAudio, {
                    capture: true,
                    once: true
                });
                audioEl.addEventListener('ended', unmuteAudio, {
                    capture: true,
                    once: true
                });

                const removeCallbacks = function () {
                    window.clearTimeout(timeoutId);
                    audioEl.removeEventListener('playing', muteAudio, {
                        capture: true,
                        once: true
                    });
                    audioEl.removeEventListener('ended', unmuteAudio, {
                        capture: true,
                        once: true
                    });
                };

                const timeoutId = window.setTimeout(unmuteAudio, 10000); // 10 seconds

                const playButton = document.querySelector(
                    '.rc-audiochallenge-play-button > button'
                );
                if (useMouse) {
                    await clickElement(playButton, browserBorder, osScale);
                } else {
                    await tapEnter(playButton);
                }
            }

            const audioUrl = audioEl.src;
            const lang = document.documentElement.lang;

            // Verwende WIT.ai Mobile für direkte Audio-Transkription
            const witAi = new WitAiMobile();
            let solution = '';

            try {
                console.log('WIT.ai Mobile: Starte Transkription...');
                solution = await witAi.transcribeAudio(audioUrl, lang);
                console.log('WIT.ai Mobile: Transkription erfolgreich:', solution);
            } catch (error) {
                console.error('WIT.ai Mobile: Transkription fehlgeschlagen:', error);

                // Fallback auf die alte Methode über Native Messaging
                try {
                    solution = await mockBrowserRuntimeSendMessage({
                        id: 'transcribeAudio',
                        audioUrl,
                        lang
                    });
                } catch (fallbackError) {
                    console.error('Fallback (Native Messaging) auch fehlgeschlagen:', fallbackError);
                    return;
                }
            }

            if (!solution) {
                return;
            }

            const input = document.querySelector('#audio-response');
            if (simulateUserInput) {
                if (useMouse) {
                    await clickElement(input, browserBorder, osScale);
                } else {
                    await navigateToElement(input);
                }
                await meanSleep(200);

                await messageClientApp({command: 'typeText', data: solution});
            } else {
                input.value = solution;
            }

            const submitButton = document.querySelector('#recaptcha-verify-button');
            if (simulateUserInput) {
                if (useMouse) {
                    await clickElement(submitButton, browserBorder, osScale);
                } else {
                    await tapEnter(submitButton);
                }
            } else {
                dispatchEnter(submitButton);
            }

            mockBrowserRuntimeSendMessage({id: 'captchaSolved'});
        }

        function solveChallenge(ev) {
            ev.preventDefault();
            ev.stopImmediatePropagation();

            if (!ev.isTrusted || solverWorking) {
                return;
            }
            setSolverState({working: true});

            runSolver(ev)
                .catch(err => {
                    mockBrowserRuntimeSendMessage({
                        id: 'notification',
                        messageId: 'error_internalError'
                    });
                    console.log(err.toString());
                    throw err;
                })
                .finally(() => {
                    setSolverState({working: false});
                });
        }

        async function runSolver(ev) {
            const {simulateUserInput, autoUpdateClientApp} = await storage.get([
                'simulateUserInput',
                'autoUpdateClientApp'
            ]);

            if (simulateUserInput) {
                try {
                    let pingRsp;

                    try {
                        pingRsp = await pingClientApp({stop: false, checkResponse: false});
                    } catch (err) {
                        mockBrowserRuntimeSendMessage({
                            id: 'notification',
                            messageId: 'error_missingClientApp'
                        });
                        mockBrowserRuntimeSendMessage({id: 'openOptions'});
                        throw err;
                    }

                    if (!pingRsp.success) {
                        if (!pingRsp.apiVersion !== '2') {
                            if (!autoUpdateClientApp || pingRsp.apiVersion === '1') {
                                mockBrowserRuntimeSendMessage({
                                    id: 'notification',
                                    messageId: 'error_outdatedClientApp'
                                });
                                mockBrowserRuntimeSendMessage({id: 'openOptions'});
                                throw new Error('Client app outdated');
                            } else {
                                try {
                                    mockBrowserRuntimeSendMessage({
                                        id: 'notification',
                                        messageId: 'info_updatingClientApp'
                                    });
                                    const rsp = await mockBrowserRuntimeSendMessage({
                                        id: 'messageClientApp',
                                        message: {command: 'installClient', data: '2'}
                                    });

                                    if (rsp.success) {
                                        await mockBrowserRuntimeSendMessage({id: 'stopClientApp'});
                                        await sleep(10000);

                                        await pingClientApp({stop: false});

                                        await mockBrowserRuntimeSendMessage({
                                            id: 'messageClientApp',
                                            message: {command: 'installCleanup'}
                                        });
                                    } else {
                                        throw new Error(`Client app update failed: ${rsp.data}`);
                                    }
                                } catch (err) {
                                    mockBrowserRuntimeSendMessage({
                                        id: 'notification',
                                        messageId: 'error_clientAppUpdateFailed'
                                    });
                                    mockBrowserRuntimeSendMessage({id: 'openOptions'});
                                    throw err;
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.log(err.toString());
                    await mockBrowserRuntimeSendMessage({id: 'stopClientApp'});
                    return;
                }
            }

            try {
                await solve(simulateUserInput, ev);
            } finally {
                if (simulateUserInput) {
                    await mockBrowserRuntimeSendMessage({id: 'stopClientApp'});
                }
            }
        }

        function init() {
            const observer = new MutationObserver(syncUI);
            observer.observe(document, {
                childList: true,
                subtree: true
            });

            syncUI();
        }

        init();
    }

    // Wait for page to load before initializing
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        main();
    }
})();
