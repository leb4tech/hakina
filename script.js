document.addEventListener('DOMContentLoaded', () => {

    // --- DOM ELEMENTS ---
    const appElements = {
        html: document.documentElement,
        langSwitcher: document.getElementById('lang-switcher'),
        homeScreen: document.getElementById('home-screen'),
        resultsScreen: document.getElementById('results-screen'),
        searchForm: document.getElementById('search-form'),
        searchInput: document.getElementById('search-input'),
        micBtn: document.getElementById('mic-btn'),
        wordOfTheDayContainer: document.getElementById('word-of-the-day'),
        wodContent: document.getElementById('wod-content'),
        wodLoader: document.getElementById('wod-loader'),
        backBtn: document.getElementById('back-btn'),
        backArrow: document.getElementById('back-arrow'),
        loadingSpinner: document.getElementById('loading-spinner'),
        errorMessage: document.getElementById('error-message'),
        resultsContent: document.getElementById('results-content'),
        resultWord: document.getElementById('result-word'),
        ttsWordBtn: document.getElementById('tts-word-btn'),
        resultMeaning: document.getElementById('result-meaning'),
        resultExplanation: document.getElementById('result-explanation'),
        resultExamples: document.getElementById('result-examples'),
    };

    // --- STATE & CONFIG ---
    let currentLang = 'ar';
    const cache = new Map();
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = SpeechRecognition ? new SpeechRecognition() : null;
   
    // --- TRANSLATIONS (Same as before) ---
    const translations = {
        ar: {
            app_title: "حكينا - قاموس اللهجة اللبنانية الذكي",
            header_title: "حكينا",
            header_subtitle: "قاموس اللهجة اللبنانية الذكي",
            search_placeholder: "اكتب أو الفظ كلمة...",
            mic_tooltip: "البحث بالصوت",
            search_button_text: "ابحث عن الكلمة",
            word_of_the_day_title: "كلمة اليوم",
            back_button: "رجوع",
            quick_meaning_title: "المعنى السريع",
            explanation_title: "الشرح",
            examples_title: "أمثلة",
            error_generic: "حدث خطأ ما. الرجاء المحاولة مرة أخرى.",
            error_no_speech: "عذراً، متصفحك لا يدعم البحث الصوتي.",
            error_no_word: "الرجاء إدخال كلمة للبحث.",
            error_tts_unavailable: "عذراً، ميزة النطق الصوتي غير متاحة حالياً.",
        },
        en: {
            app_title: "Hakeena - The Smart Lebanese Dialect Dictionary",
            header_title: "Hakeena",
            header_subtitle: "The Smart Lebanese Dialect Dictionary",
            search_placeholder: "Type or say a word...",
            mic_tooltip: "Search by voice",
            search_button_text: "Search Word",
            word_of_the_day_title: "Word of the Day",
            back_button: "Back",
            quick_meaning_title: "Quick Meaning",
            explanation_title: "Explanation",
            examples_title: "Examples",
            error_generic: "An error occurred. Please try again.",
            error_no_speech: "Sorry, your browser doesn't support voice search.",
            error_no_word: "Please enter a word to search.",
            error_tts_unavailable: "Sorry, text-to-speech is currently unavailable.",
        }
    };

    // --- FUNCTIONS ---

    const setLanguage = (lang) => {
        currentLang = lang;
        const isRTL = lang === 'ar';
        
        appElements.html.lang = lang;
        appElements.html.dir = isRTL ? 'rtl' : 'ltr';
        appElements.langSwitcher.textContent = isRTL ? 'English' : 'العربية';
        appElements.micBtn.classList.toggle('right-3', isRTL);
        appElements.micBtn.classList.toggle('left-3', !isRTL);
        appElements.micBtn.style.right = isRTL ? '0.75rem' : 'auto';
        appElements.micBtn.style.left = !isRTL ? '0.75rem' : 'auto';
        appElements.backArrow.classList.toggle('rtl-icon-fix', isRTL);

        document.querySelectorAll('[data-lang-key]').forEach(el => {
            const key = el.getAttribute('data-lang-key');
            el.textContent = translations[lang][key];
        });
        document.querySelectorAll('[data-lang-placeholder]').forEach(el => {
            const key = el.getAttribute('data-lang-placeholder');
            el.placeholder = translations[lang][key];
        });
        document.querySelectorAll('[data-lang-title]').forEach(el => {
            const key = el.getAttribute('data-lang-title');
            el.title = translations[lang][key];
        });

        document.body.classList.toggle('font-cairo', isRTL);
        document.body.classList.toggle('font-poppins', !isRTL);
        fetchWordOfTheDay();
    };
    
    const toggleView = (showResults) => {
        appElements.homeScreen.classList.toggle('hidden', showResults);
        appElements.resultsScreen.classList.toggle('hidden', !showResults);
    };

    const showLoading = (isLoading) => {
        appElements.loadingSpinner.classList.toggle('hidden', !isLoading);
        appElements.resultsContent.classList.toggle('hidden', isLoading);
        appElements.errorMessage.classList.add('hidden');
    };

    const showError = (message) => {
        appElements.loadingSpinner.classList.add('hidden');
        appElements.errorMessage.textContent = message;
        appElements.errorMessage.classList.remove('hidden');
    };

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    let currentAudioSource = null;

    const base64ToArrayBuffer = (base64) => {
        const binaryString = window.atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    };
    
    const playAudioFromPCM = async (pcmData) => {
        if (currentAudioSource) currentAudioSource.stop();
        try {
            const audioBuffer = await audioContext.decodeAudioData(pcmData);
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            source.start(0);
            currentAudioSource = source;
        } catch (error) {
            console.error("Error decoding audio data:", error);
            showError(translations[currentLang].error_generic);
        }
    };

    const speakText = async (text, lang, buttonEl) => {
        if (buttonEl) {
            const originalContent = buttonEl.innerHTML;
            const spinner = document.createElement('div');
            spinner.className = 'w-5 h-5 border-2 border-gray-400 border-t-gray-700 rounded-full animate-spin mx-auto';
            buttonEl.innerHTML = '';
            buttonEl.appendChild(spinner);
            buttonEl.disabled = true;
        }

        if (currentAudioSource) currentAudioSource.stop();

        try {
            const response = await fetch(`/.netlify/functions/tts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, lang })
            });

            if (!response.ok) throw new Error(`Server error: ${response.status}`);

            const { audioDataB64 } = await response.json();

            if (audioDataB64) {
                const pcmData = base64ToArrayBuffer(audioDataB64);
                const wavHeader = createWavHeader(pcmData.byteLength, 24000);
                const wavBlob = new Blob([wavHeader, pcmData], { type: 'audio/wav' });
                const arrayBuffer = await wavBlob.arrayBuffer();
                await playAudioFromPCM(arrayBuffer);
            } else {
                throw new Error("No audio data in server response");
            }

        } catch (error) {
            console.error("TTS Error:", error);
            showError(translations[currentLang].error_tts_unavailable);
        } finally {
             if (buttonEl) {
                buttonEl.innerHTML = originalContent;
                buttonEl.disabled = false;
            }
        }
    };

    function createWavHeader(dataLength, sampleRate) {
        const numChannels = 1;
        const bitsPerSample = 16;
        const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
        const blockAlign = numChannels * (bitsPerSample / 8);
        const buffer = new ArrayBuffer(44);
        const view = new DataView(buffer);
        const writeString = (view, offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };
        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + dataLength, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); 
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitsPerSample, true);
        writeString(view, 36, 'data');
        view.setUint32(40, dataLength, true);
        return buffer;
    }

    const renderResults = (data) => {
        appElements.resultWord.textContent = data.word;
        appElements.ttsWordBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
        appElements.resultMeaning.textContent = data.meaning;
        appElements.resultExplanation.textContent = data.explanation;
        appElements.resultExamples.innerHTML = '';
        
        data.examples.forEach(example => {
            const li = document.createElement('li');
            li.className = 'flex items-start gap-2 text-gray-700';
            
            const ttsBtn = document.createElement('button');
            ttsBtn.className = 'flex-shrink-0 text-[var(--accent-green)] opacity-50 hover:opacity-100 transition mt-1';
            ttsBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon></svg>`;
            
            const exampleText = document.createElement('span');
            exampleText.textContent = `- ${example}`;

            if (currentLang === 'ar') {
                const arabicExample = example.split('(')[0].trim();
                ttsBtn.onclick = (e) => speakText(arabicExample, 'ar', e.currentTarget);
            } else {
                const match = example.match(/\(([^)]+)\)/);
                if (match && match[1]) {
                    const englishText = match[1];
                    ttsBtn.onclick = (e) => speakText(englishText, 'en', e.currentTarget);
                } else {
                    ttsBtn.style.display = 'none';
                }
            }
            li.appendChild(ttsBtn);
            li.appendChild(exampleText);
            appElements.resultExamples.appendChild(li);
        });

        appElements.ttsWordBtn.onclick = (e) => speakText(data.word, 'ar', e.currentTarget);
    };

    const callGeminiAPI = async (word) => {
        const cacheKey = `${word}_${currentLang}`;
        if (cache.has(cacheKey)) return cache.get(cacheKey);

        const prompt = currentLang === 'ar'
            ? `أنت خبير باللهجة اللبنانية. لكلمة "${word}", قدم شرحاً بسيطاً, ومعنى سريعاً من كلمة أو كلمتين, وثلاثة أمثلة واقعية من الحياة اليومية في لبنان. يجب أن يكون الرد بصيغة JSON فقط بدون أي نص إضافي, بالشكل التالي: {"word": "${word}", "meaning": "...", "explanation": "...", "examples": ["...", "...", "..."]}`
            : `You are an expert in the Lebanese Arabic dialect. For the word "${word}", provide a simple explanation, a quick meaning (1-2 words), and three realistic examples from daily life in Lebanon. The examples should be in romanized Lebanese (transliteration) followed by the English translation in parentheses. Your response must be in JSON format only, with no extra text, like this: {"word": "${word}", "meaning": "...", "explanation": "...", "examples": ["...", "...", "..."]}`;

        try {
            const response = await fetch('/.netlify/functions/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });

            if (!response.ok) throw new Error(`Server error! status: ${response.status}`);
            
            const parsedData = await response.json();
            cache.set(cacheKey, parsedData);
            return parsedData;

        } catch (error) {
            console.error("API Error:", error);
            showError(translations[currentLang].error_generic);
            return null;
        }
    };

    const handleSearch = async (word) => {
        if (!word.trim()) {
            alert(translations[currentLang].error_no_word);
            return;
        }
        toggleView(true);
        showLoading(true);
        const data = await callGeminiAPI(word);
        if (data) {
            renderResults(data);
            showLoading(false);
        }
    };

    const fetchWordOfTheDay = async () => {
        appElements.wodContent.classList.add('hidden');
        appElements.wodLoader.classList.remove('hidden');
        const wod = currentLang === 'ar' ? 'كزدورة' : 'Kazdoura';
        const data = await callGeminiAPI(wod);
        if(data) {
            const wodHTML = `<p class="text-2xl font-bold text-[var(--accent-green)]">${data.word}</p><p class="mt-1 text-gray-700">${data.explanation}</p>`;
            appElements.wodContent.innerHTML = wodHTML;
        } else {
             appElements.wodContent.innerHTML = `<p>${translations[currentLang].error_generic}</p>`;
        }
        appElements.wodContent.classList.remove('hidden');
        appElements.wodLoader.classList.add('hidden');
    };

    appElements.langSwitcher.addEventListener('click', () => setLanguage(currentLang === 'ar' ? 'en' : 'ar'));
    appElements.searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleSearch(appElements.searchInput.value);
    });
    appElements.backBtn.addEventListener('click', () => {
        toggleView(false);
        appElements.searchInput.value = '';
    });

    if (recognition) {
        appElements.micBtn.addEventListener('click', () => {
            try {
                recognition.lang = currentLang === 'ar' ? 'ar-LB' : 'en-US';
                recognition.start();
            } catch(e) { console.error("Mic error:", e); alert(translations[currentLang].error_generic); }
        });
        recognition.onresult = (event) => {
            const spokenText = event.results[0][0].transcript;
            appElements.searchInput.value = spokenText;
            handleSearch(spokenText);
        };
        recognition.onerror = (event) => console.error('Speech recognition error:', event.error);
    } else {
        appElements.micBtn.disabled = true;
        appElements.micBtn.addEventListener('click', () => alert(translations[currentLang].error_no_speech));
    }
    setLanguage('ar');
});

