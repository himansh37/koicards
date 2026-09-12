
document.addEventListener('DOMContentLoaded', () => {
    // --- Element Selectors ---
    const imageUpload = document.getElementById('imageUpload');
    const generateBtn = document.getElementById('generateBtn');
    const mnemonicLangSelect = document.getElementById('mnemonicLangSelect');

    // --- MNEMONIC LANGUAGE PREFERENCE ---
    const MNEMONIC_LANG_PHRASES = {
        hinglish: 'mnemonic in Hinglish (Hindi + English mix)',
        english: 'mnemonic in simple English only',
        chinese: 'mnemonic using Mandarin Chinese words or sounds',
        korean: 'mnemonic using Korean words or sounds',
        indonesian: 'mnemonic using Bahasa Indonesia words',
        portuguese: 'mnemonic using Brazilian Portuguese words',
        german: 'mnemonic using German words or sounds',
        spanish: 'mnemonic using Mexican Spanish words',
        taiwanese: 'mnemonic using Taiwanese Mandarin',
        vietnamese: 'mnemonic using Vietnamese words or sounds'
    };

    if (mnemonicLangSelect) {
        const savedMnemonicLang = localStorage.getItem('mnemonicLang');
        if (savedMnemonicLang && MNEMONIC_LANG_PHRASES[savedMnemonicLang]) {
            mnemonicLangSelect.value = savedMnemonicLang;
        }
        mnemonicLangSelect.addEventListener('change', () => {
            localStorage.setItem('mnemonicLang', mnemonicLangSelect.value);
        });
    }
    const flashcardDisplay = document.getElementById('flashcard-display');
    const currentFlashcard = document.getElementById('current-flashcard');
    const loadingSpinner = document.getElementById('loading');
    const statusMessage = document.getElementById('statusMessage');
    const repetitionButtons = document.getElementById('repetition-buttons');
    const dontRepeatBtn = document.getElementById('dont-repeat-btn');
    const repeatBtn = document.getElementById('repeat-btn');
    const repeatFrequentlyBtn = document.getElementById('repeat-frequently-btn');
    const saveDeckBtn = document.getElementById('saveDeckBtn');
    const exportJsonBtn = document.getElementById('exportJsonBtn');
    const deckList = document.getElementById('deck-list');
    const progressList = document.getElementById('progress-list');
    const deckModal = document.getElementById('deck-modal');
    const modalTitle = document.getElementById('modal-title');
    const deckNameInput = document.getElementById('deck-name-input');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const modalSaveBtn = document.getElementById('modal-save-btn');
    const toastNotification = document.getElementById('toast-notification');
    const installBtn = document.getElementById('install-app-btn');
    const mainContent = document.getElementById('main-content');
    const testView = document.getElementById('test-view');
    const testQuestion = document.getElementById('test-question');
    const testOptions = document.getElementById('test-options');
    const testProgress = document.getElementById('test-progress');
    const exitTestBtn = document.getElementById('exit-test-btn');
    const testTypeModal = document.getElementById('test-type-modal');
    const jaToEnBtn = document.getElementById('ja-to-en-btn');
    const enToJaBtn = document.getElementById('en-to-ja-btn');
    const testTypeCancelBtn = document.getElementById('test-type-cancel-btn');
    const testResultsModal = document.getElementById('test-results-modal');
    const finalScore = document.getElementById('final-score');
    const timeTaken = document.getElementById('time-taken');
    const resultsBreakdown = document.getElementById('results-breakdown');
    const closeResultsBtn = document.getElementById('close-results-btn');
    const streakCount = document.getElementById('streak-count');
    const selectTestDecksBtn = document.getElementById('selectTestDecksBtn');
    const selectStudyDecksBtn = document.getElementById('selectStudyDecksBtn');
    const selectDecksModal = document.getElementById('select-decks-modal');
    const selectModalTitle = document.getElementById('select-modal-title');
    const deckSelectionList = document.getElementById('deck-selection-list');
    const selectModalCancelBtn = document.getElementById('select-modal-cancel-btn');
    const selectModalPrimaryBtn = document.getElementById('select-modal-primary-btn');
    const motivationalMessageDisplay = document.getElementById('motivational-message-display');
    const motivationalText = document.getElementById('motivational-text');
    const motivationalAuthor = document.getElementById('motivational-author');
    const continueStudyBtn = document.getElementById('continue-study-btn');
    const progressChartContainer = document.getElementById('progress-chart-container');
    const chartTitle = document.getElementById('chart-title');
    const progressChartCanvas = document.getElementById('progress-chart');

    // --- DeckManager Constants ---
    const deckManager = new DeckManager();

    // --- State Variables ---
    const state = {
        uploadedFile: null,
        lastMotivationalQuoteIndex: -1,
        flashcardsData: [],
        currentCardIndex: 0,
        modalMode: 'save',
        deckToRename: '',
        testQuestions: [],
        currentTestQuestionIndex: 0,
        score: 0,
        deckForTest: '',
        japaneseVoice: null,
        voicePromise: null,
        currentSelectionMode: '', // 'test' or 'study'
        cardsStudiedCount: 0,
        testStartTime: null,
        testResults: [],
        progressChart: null,
        draggingElement: null,
        deferredPrompt: null,
        currentPage: 1, // Pagination
        itemsPerPage: 6 // Pagination limit
    };

    const motivationalQuotes = [
        { text: "Success is not final, failure is not fatal: It is the courage to continue that counts.", author: "Winston Churchill" },
        { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
        { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
        { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
        { text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
        { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
        { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
        { text: "Small progress is still progress.", author: "Unknown" },
        { text: "Focus on the step in front of you, not the whole staircase.", author: "Unknown" },
        { text: "Mistakes are proof that you are trying.", author: "Unknown" }
    ];



    // --- AUDIO GENERATION AND PLAYBACK ---
    function getJapaneseVoice() {
        if (state.voicePromise) return state.voicePromise;

        state.voicePromise = new Promise((resolve, reject) => {
            const getVoices = () => {
                const voices = window.speechSynthesis.getVoices();
                if (voices.length > 0) {
                    state.japaneseVoice = voices.find(voice => voice.lang === 'ja-JP');
                    if (state.japaneseVoice) {
                        resolve(state.japaneseVoice);
                    } else {
                        reject(new Error("Japanese voice not found in browser."));
                    }
                }
            };

            if (window.speechSynthesis.getVoices().length > 0) {
                getVoices();
            } else {
                window.speechSynthesis.onvoiceschanged = getVoices;
            }
        });
        return state.voicePromise;
    }

    async function playJapaneseAudio(text, buttonElement) {
        if (!text || text.trim() === '') {
            showToast("No valid text to read.");
            return;
        }

        buttonElement.classList.add('loading');
        try {
            const voice = await getJapaneseVoice();
            window.speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.voice = voice;
            utterance.lang = 'ja-JP';
            utterance.rate = 0.9;

            utterance.onend = () => buttonElement.classList.remove('loading');
            utterance.onerror = (event) => {
                console.error('Speech synthesis error:', event.error);
                buttonElement.classList.remove('loading');
            };

            window.speechSynthesis.speak(utterance);
        } catch (error) {
            console.error(error.message);
            showToast(error.message);
            buttonElement.classList.remove('loading');
        }
    }


    // --- DATA MANAGEMENT & PROGRESS LOGIC ---
    // All data management is now handled by the DeckManager class (deckManager instance).

    function showToast(message) {
        toastNotification.textContent = message;
        toastNotification.classList.add('show');
        setTimeout(() => { toastNotification.classList.remove('show'); }, 3000);
    }

    function getSunProgressIcon(averageScore) {
        if (averageScore > 80) return '☀️';
        if (averageScore > 60) return '🌤️';
        if (averageScore > 40) return '🌥️';
        if (averageScore > 20) return '☁️';
        return '🌑';
    }

    // --- STREAK LOGIC ---
    function renderStreak() {
        const streakData = deckManager.getStreak();
        streakCount.textContent = streakData.count;
    }

    // Initial check on load
    deckManager.checkAndResetStreak();

    // --- UI RENDERING ---
    function renderAll() {
        renderDeckList();
        renderProgressView();
        renderStreak();
    }

    function renderDeckList() {
        if (!deckList) {
            console.error('deckList element not found');
            return;
        }
        deckList.innerHTML = '';
        const decks = deckManager.getDecks();
        const deckOrder = deckManager.getDeckOrder();

        if (deckOrder.length === 0) {
            deckList.innerHTML = '<p style="color: var(--text-secondary-color);">No decks yet. Generate one from an image!</p>';
            return;
        }

        // --- PAGINATION LOGIC ---
        const startIndex = (state.currentPage - 1) * state.itemsPerPage;
        const endIndex = startIndex + state.itemsPerPage;
        const paginatedDecks = deckOrder.slice(startIndex, endIndex);

        const deckKanjiPool = ['語', '学', '字', '本', '日', '新', '力', '心', '美', '和', '花', '空', '音', '夢'];
        const kanjiForDeck = (name) => {
            let hash = 0;
            for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
            return deckKanjiPool[hash % deckKanjiPool.length];
        };

        paginatedDecks.forEach(deckName => {
            const deck = decks[deckName];
            if (!deck) return;

            const deckItem = document.createElement('div');
            deckItem.className = 'deck-list-item';
            deckItem.setAttribute('draggable', 'true');
            deckItem.dataset.deckName = deckName;

            const titleWrap = document.createElement('span');
            titleWrap.className = 'flex items-center gap-3';

            const glyph = document.createElement('span');
            glyph.className = 'deck-glyph';
            glyph.setAttribute('aria-hidden', 'true');
            glyph.textContent = kanjiForDeck(deckName);
            titleWrap.appendChild(glyph);

            const textWrap = document.createElement('span');
            textWrap.className = 'flex flex-col items-start';
            textWrap.style.minWidth = '0';

            const titleSpan = document.createElement('span');
            titleSpan.className = 'font-semibold';
            titleSpan.style.color = 'var(--text-primary-color)';
            titleSpan.textContent = deckName;
            textWrap.appendChild(titleSpan);

            const metaSpan = document.createElement('span');
            metaSpan.style.color = 'var(--text-secondary-color)';
            metaSpan.style.fontSize = '0.8rem';
            metaSpan.textContent = `${deck.length} card${deck.length === 1 ? '' : 's'}`;
            textWrap.appendChild(metaSpan);

            titleWrap.appendChild(textWrap);

            deckItem.appendChild(titleWrap);

            const btnContainer = document.createElement('div');
            // Responsive: Flex row on desktop, Grid on mobile
            // Mobile: one compact row (Test/Load/Rename + icon-only Delete via CSS).
            // Desktop (md:flex) is unaffected — grid-template-columns has no
            // effect once display switches to flex.
            btnContainer.className = 'grid grid-cols-[1.3fr_1fr_1fr_0.6fr] gap-2 w-full md:w-auto md:flex md:space-x-2 mt-4 md:mt-0';

            const createBtn = (text, classes, label) => {
                const btn = document.createElement('button');
                btn.textContent = text;
                btn.className = classes;
                btn.dataset.deckName = deckName;
                if (label) btn.setAttribute('aria-label', label);
                return btn;
            };

            btnContainer.appendChild(createBtn('Test', 'test-deck-btn px-3 py-1.5 bg-white/5 hover:bg-blue-500/20 text-gray-300 hover:text-blue-200 border border-white/10 hover:border-blue-500/30 rounded-lg text-sm backdrop-blur-sm transition-all hover:scale-105 font-medium', `Test deck ${deckName}`));
            btnContainer.appendChild(createBtn('Load', 'load-deck-btn px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 rounded-lg text-sm backdrop-blur-sm transition-all hover:scale-105 font-medium', `Load deck ${deckName}`));
            btnContainer.appendChild(createBtn('Rename', 'rename-deck-btn px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 rounded-lg text-sm backdrop-blur-sm transition-all hover:scale-105 font-medium', `Rename deck ${deckName}`));
            btnContainer.appendChild(createBtn('Delete', 'delete-deck-btn px-3 py-1.5 bg-white/5 hover:bg-red-500/20 text-gray-300 hover:text-red-200 border border-white/10 hover:border-red-500/30 rounded-lg text-sm backdrop-blur-sm transition-all hover:scale-105 font-medium', `Delete deck ${deckName}`));

            deckItem.appendChild(btnContainer);
            deckList.appendChild(deckItem);
        });

        renderPaginationControls(deckOrder.length, deckList);
    }


    function renderPaginationControls(totalItems, container) {
        const totalPages = Math.ceil(totalItems / state.itemsPerPage);
        if (totalPages <= 1) return;

        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'pagination-controls flex justify-center space-x-4 mt-6';
        if (container === progressList) {
            // progressList is a CSS grid; without this the controls become a
            // grid cell and stretch to the row height instead of a normal row.
            controlsContainer.style.gridColumn = '1 / -1';
            controlsContainer.style.alignSelf = 'start';
        }

        const createBtn = (text, disabled, callback) => {
            const btn = document.createElement('button');
            btn.textContent = text;
            btn.className = `px-4 py-2 rounded-lg backdrop-blur-sm transition-all font-medium ${disabled
                ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                : 'bg-white/10 hover:bg-white/20 text-white border border-white/10 hover:border-white/20 hover:scale-105'
                }`;
            if (disabled) btn.disabled = true;
            btn.onclick = callback;
            return btn;
        };

        controlsContainer.appendChild(createBtn('Previous', state.currentPage === 1, () => {
            state.currentPage--;
            renderAll();
        }));

        const pageInfo = document.createElement('span');
        pageInfo.className = 'flex items-center text-gray-400 font-medium';
        pageInfo.textContent = `Page ${state.currentPage} of ${totalPages}`;
        controlsContainer.appendChild(pageInfo);

        controlsContainer.appendChild(createBtn('Next', state.currentPage === totalPages, () => {
            state.currentPage++;
            renderAll();
        }));

        container.appendChild(controlsContainer);
    }

    function renderProgressView() {
        if (!progressList || !progressChartContainer) {
            console.error('Progress elements not found');
            return;
        }
        const decks = deckManager.getDecks();
        const history = deckManager.getTestHistory();
        const rawProgressOrder = deckManager.getProgressOrder();

        // Filter out decks that no longer exist
        const progressOrder = rawProgressOrder.filter(name => decks[name]);

        progressList.textContent = '';
        progressChartContainer.style.display = 'none';

        if (progressOrder.length === 0) {
            const p = document.createElement('p');
            p.style.color = 'var(--text-secondary-color)';
            p.style.gridColumn = '1 / -1';
            p.style.textAlign = 'center';
            p.textContent = 'Complete a test to see your progress dashboard.';
            progressList.appendChild(p);
            return;
        }

        // --- PAGINATION LOGIC (using same page state as deck list for simplicity, or could have separate) ---
        // For shared state, switching tabs might feel weird if page numbers don't reset. 
        // Let's use the same state variable for now, assuming users treat "Deck" and "Progress" views similarly.
        const startIndex = (state.currentPage - 1) * state.itemsPerPage;
        const endIndex = startIndex + state.itemsPerPage;
        const paginatedProgress = progressOrder.slice(startIndex, endIndex);

        paginatedProgress.forEach(deckName => {
            // Already filtered above, so decks[deckName] is guaranteed to exist

            const deckHistory = history.filter(item => item.deckName === deckName);
            let averageScore = 0;
            let bestScore = 0;
            if (deckHistory.length > 0) {
                const totalScore = deckHistory.reduce((sum, item) => sum + (item.score / item.total), 0);
                averageScore = Math.round((totalScore / deckHistory.length) * 100);
                bestScore = Math.round(Math.max(...deckHistory.map(item => (item.score / item.total) * 100)));
            }

            // --- Determine Color & Icon ---
            let color = '#ef4444'; // Red (Low)
            // if (averageScore > 40) color = '#f97316'; // Orange (Medium)
            if (averageScore >= 50) color = '#f59e0b'; // Amber
            if (averageScore >= 80) color = '#10b981'; // Green (High)

            // --- SVG Circle Logic ---
            const radius = 52;
            const circumference = 2 * Math.PI * radius;
            const offset = circumference - (averageScore / 100) * circumference;

            // --- Create Card HTML ---
            const card = document.createElement('div');
            card.className = 'progress-card';
            card.setAttribute('draggable', 'true');
            card.dataset.deckName = deckName;

            card.innerHTML = `
                <div class="progress-ring">
                    <svg class="progress-ring__svg" width="120" height="120" viewBox="0 0 120 120">
                        <circle class="progress-ring__background" stroke="rgba(255,255,255,0.1)" stroke-width="8" fill="transparent" r="${radius}" cx="60" cy="60"/>
                        <circle class="progress-ring__circle" stroke="${color}" stroke-width="8" fill="transparent" r="${radius}" cx="60" cy="60"
                                style="stroke-dasharray: ${circumference} ${circumference}; stroke-dashoffset: ${offset};"/>
                    </svg>
                    <span class="progress-score">${averageScore}</span>
                </div>
                <div class="progress-card-info">
                    <h3>${deckName}</h3>
                    <div class="progress-stats">
                        <span>Tests: ${deckHistory.length}</span>
                        <span style="color: ${color}">Best: ${bestScore}%</span>
                    </div>
                </div>
            `;

            progressList.appendChild(card);
        });

        renderPaginationControls(progressOrder.length, progressList);
    }

    progressList.addEventListener('click', (e) => {
        const progressItem = e.target.closest('.progress-card');
        if (progressItem && !e.target.closest('.dragging')) {
            const deckName = progressItem.dataset.deckName;
            showProgressChart(deckName);
        }
    });

    // Updated: Renamed to match renderProgressView call and added Dark Mode styles
    function showProgressChart(deckName) {
        const history = deckManager.getTestHistory().filter(item => item.deckName === deckName);

        if (history.length < 2) {
            progressChartContainer.style.display = 'none';
            showToast(`Not enough test data for "${deckName}" to show a chart.`);
            return;
        }

        chartTitle.textContent = `Progress for "${deckName}"`;
        chartTitle.style.color = 'var(--text-primary-color)';
        progressChartContainer.style.display = 'block';

        const labels = history.map(item => new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
        const data = history.map(item => Math.round((item.score / item.total) * 100));

        if (state.progressChart) {
            state.progressChart.destroy();
        }

        state.progressChart = new Chart(progressChartCanvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Score %',
                    data: data,
                    fill: true,
                    backgroundColor: 'rgba(168, 85, 247, 0.1)', // Purple tint
                    borderColor: '#a855f7', // Neon Purple
                    borderWidth: 3,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#a855f7',
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    tension: 0.4 // Smooth curves
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        labels: { color: '#e5e7eb' }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#9ca3af' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#9ca3af' }
                    }
                },
                animation: {
                    y: { duration: 2000, easing: 'easeOutQuart' }
                }
            }
        });
    }

    // --- DECK SELECTION MODAL LOGIC ---
    function openDeckSelectionModal(mode) {
        state.currentSelectionMode = mode;
        const deckNames = deckManager.getDeckOrder();

        if (deckNames.length === 0) {
            showToast("You need to create at least one deck first.");
            return;
        }

        selectModalTitle.textContent = `Select Decks for ${mode === 'test' ? 'Test' : 'Study'}`;
        selectModalPrimaryBtn.textContent = `Start ${mode === 'test' ? 'Test' : 'Study'}`;

        deckSelectionList.textContent = '';
        deckNames.forEach(name => {
            const deckItem = document.createElement('div');
            deckItem.className = 'deck-select-item';

            const label = document.createElement('label');
            label.className = 'font-semibold text-lg';
            label.style.color = 'var(--text-primary-color)';
            label.textContent = name;
            deckItem.appendChild(label);

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.name = 'selectedDecks';
            input.value = name;
            input.className = 'w-5 h-5 accent-purple-500';
            deckItem.appendChild(input);

            deckSelectionList.appendChild(deckItem);
        });
        selectDecksModal.style.display = 'flex';
    }

    selectTestDecksBtn.addEventListener('click', () => openDeckSelectionModal('test'));
    selectStudyDecksBtn.addEventListener('click', () => openDeckSelectionModal('study'));

    selectModalCancelBtn.addEventListener('click', () => {
        selectDecksModal.style.display = 'none';
    });

    selectModalPrimaryBtn.addEventListener('click', () => {
        const selectedCheckboxes = document.querySelectorAll('#deck-selection-list input[type="checkbox"]:checked');
        const selectedDeckNames = Array.from(selectedCheckboxes).map(cb => cb.value);

        if (selectedDeckNames.length === 0) {
            showToast("Please select at least one deck.");
            return;
        }

        const decks = deckManager.getDecks();
        const combinedDeck = selectedDeckNames.flatMap(name => decks[name] || []);

        if (combinedDeck.length < 4 && state.currentSelectionMode === 'test') {
            showToast("The selected decks must contain at least 4 cards combined to take a test.");
            return;
        }

        if (state.currentSelectionMode === 'test') {
            state.deckForTest = selectedDeckNames.join(', ');
            selectDecksModal.style.display = 'none';
            testTypeModal.style.display = 'flex';
            jaToEnBtn.onclick = () => { testTypeModal.style.display = 'none'; startTest(combinedDeck, 'ja-en'); };
            enToJaBtn.onclick = () => { testTypeModal.style.display = 'none'; startTest(combinedDeck, 'en-ja'); };
        } else if (state.currentSelectionMode === 'study') {
            startStudySession(combinedDeck);
        }
    });


    deckList.addEventListener('click', (e) => {
        if (e.target.closest('.dragging')) return;

        const deckName = e.target.dataset.deckName;
        if (!deckName) return;

        if (e.target.classList.contains('load-deck-btn')) {
            const decks = deckManager.getDecks();

            // USER REQUEST: Reset streak to 1 when loading a deck
            deckManager.setStreak(1);
            renderStreak();

            startStudySession(decks[deckName]);
        }

        if (e.target.classList.contains('rename-deck-btn')) {
            state.modalMode = 'rename';
            state.deckToRename = deckName;
            modalTitle.textContent = 'Rename Deck';
            deckNameInput.value = deckName;
            deckModal.style.display = 'flex';
        }

        if (e.target.classList.contains('delete-deck-btn')) {
            const userConfirmed = confirm(`Are you sure you want to delete the deck "${deckName}"? This will also delete its test history.`);
            if (userConfirmed) {
                deckManager.deleteDeck(deckName);

                renderAll();
                showToast(`Deck "${deckName}" deleted.`);
            }
        }

        if (e.target.classList.contains('test-deck-btn')) {
            const decks = deckManager.getDecks();
            const deck = decks[deckName];
            if (deck.length < 4) {
                showToast("A test requires at least 4 cards in the deck.");
                return;
            }
            state.deckForTest = deckName;
            testTypeModal.style.display = 'flex';
            jaToEnBtn.onclick = () => { testTypeModal.style.display = 'none'; startTest(deck, 'ja-en'); };
            enToJaBtn.onclick = () => { testTypeModal.style.display = 'none'; startTest(deck, 'en-ja'); };
        }
    });

    function closeModal() {
        deckModal.style.display = 'none';
        deckNameInput.value = '';
    }

    saveDeckBtn.addEventListener('click', () => {
        if (state.flashcardsData.length === 0) {
            showToast("There are no cards to save.");
            return;
        }
        state.modalMode = 'save';
        modalTitle.textContent = 'Save Deck';
        deckModal.style.display = 'flex';
    });

    // Export JSON Button Logic
    exportJsonBtn.addEventListener('click', () => {
        if (!state.flashcardsData || state.flashcardsData.length === 0) {
            showToast("No flashcards to export.");
            return;
        }

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.flashcardsData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        downloadAnchorNode.setAttribute("download", `koicards_export_${timestamp}.json`);
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        showToast("JSON exported successfully!");
    });

    modalCancelBtn.addEventListener('click', closeModal);

    modalSaveBtn.addEventListener('click', () => {
        const newDeckName = deckNameInput.value.trim();
        if (!newDeckName) {
            showToast("Please enter a deck name.", true);
            return;
        }

        if (state.modalMode === 'save') {
            const decks = deckManager.getDecks();
            if (decks[newDeckName]) {
                const overwrite = confirm(`A deck named "${newDeckName}" already exists. Overwrite it?`);
                if (!overwrite) return;
            }
            deckManager.saveDeck(newDeckName, state.flashcardsData);
        } else if (state.modalMode === 'rename' && newDeckName !== state.deckToRename) {
            try {
                deckManager.renameDeck(state.deckToRename, newDeckName);
            } catch (error) {
                showToast(error.message);
                return;
            }
        }
        showToast(state.modalMode === 'save' ? `Deck "${newDeckName}" saved!` : `Deck renamed to "${newDeckName}"!`);
        renderAll();
        closeModal();
    });

    // --- Drag and Drop Deck Reordering ---


    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('[draggable="true"]:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    deckList.addEventListener('dragstart', e => {
        if (e.target.classList.contains('deck-list-item')) {
            state.draggingElement = e.target;
            setTimeout(() => { state.draggingElement.classList.add('dragging'); }, 0);
        }
    });
    deckList.addEventListener('dragend', () => {
        if (state.draggingElement) {
            state.draggingElement.classList.remove('dragging');
            state.draggingElement = null;
        }
    });
    deckList.addEventListener('dragover', e => {
        e.preventDefault();
        if (!state.draggingElement) return;
        const afterElement = getDragAfterElement(deckList, e.clientY);
        if (afterElement == null) { deckList.appendChild(state.draggingElement); }
        else { deckList.insertBefore(state.draggingElement, afterElement); }
    });
    deckList.addEventListener('drop', e => {
        e.preventDefault();
        if (state.draggingElement) {
            const newOrder = [...deckList.querySelectorAll('.deck-list-item')].map(item => item.dataset.deckName);
            deckManager.saveDeckOrder(newOrder);
        }
    });

    progressList.addEventListener('dragstart', e => {
        if (e.target.classList.contains('progress-card')) {
            state.draggingElement = e.target;
            setTimeout(() => { state.draggingElement.classList.add('dragging'); }, 0);
        }
    });
    progressList.addEventListener('dragend', () => {
        if (state.draggingElement) {
            state.draggingElement.classList.remove('dragging');
            state.draggingElement = null;
        }
    });
    progressList.addEventListener('dragover', e => {
        e.preventDefault();
        if (!state.draggingElement) return;
        const afterElement = getDragAfterElement(progressList, e.clientY);
        if (afterElement == null) { progressList.appendChild(state.draggingElement); }
        else { progressList.insertBefore(state.draggingElement, afterElement); }
    });
    progressList.addEventListener('drop', e => {
        e.preventDefault();
        if (state.draggingElement) {
            const newOrder = [...progressList.querySelectorAll('.progress-card')].map(item => item.dataset.deckName);
            deckManager.saveProgressOrder(newOrder);
        }
    });


    // --- TEST FEATURE LOGIC ---

    function startTest(deck, testType) {
        const shuffledDeck = shuffleArray(deck);
        state.testStartTime = new Date();
        state.testResults = [];

        state.testQuestions = shuffledDeck.map(card => {
            let question, correctAnswer, options;
            if (testType === 'ja-en') {
                question = { japanese: card.japanese, reading: card.reading, english: card.english };
                correctAnswer = card.english;
                const otherAnswers = deck.map(c => c.english).filter(answer => answer !== correctAnswer);
                const distractors = shuffleArray(otherAnswers).slice(0, 3);
                options = shuffleArray([correctAnswer, ...distractors]);
            } else { // en-ja
                question = { japanese: card.japanese, reading: card.reading, english: card.english };
                correctAnswer = { japanese: card.japanese, reading: card.reading };
                const otherAnswers = deck.filter(c => c.japanese !== card.japanese).map(c => ({ japanese: c.japanese, reading: c.reading }));
                const distractors = shuffleArray(otherAnswers).slice(0, 3);
                options = shuffleArray([correctAnswer, ...distractors]);
            }
            return { question, correctAnswer, options, testType };
        });

        state.currentTestQuestionIndex = 0;
        state.score = 0;
        mainContent.style.display = 'none';
        testView.style.display = 'block';
        displayNextQuestion();
    }

    function displayNextQuestion() {
        if (state.currentTestQuestionIndex >= state.testQuestions.length) {
            showTestResults();
            return;
        }

        const q = state.testQuestions[state.currentTestQuestionIndex];
        testQuestion.innerHTML = '';

        if (q.testType === 'ja-en') {
            const jpDiv = document.createElement('div');
            jpDiv.className = 'text-5xl font-bold';
            jpDiv.textContent = q.question.japanese;
            testQuestion.appendChild(jpDiv);

            const readDiv = document.createElement('div');
            readDiv.className = 'text-2xl mt-2';
            readDiv.style.color = 'var(--text-secondary-color)';
            readDiv.textContent = q.question.reading || '';
            testQuestion.appendChild(readDiv);
        } else {
            const enDiv = document.createElement('div');
            enDiv.className = 'text-4xl font-bold';
            enDiv.textContent = q.question.english;
            testQuestion.appendChild(enDiv);
        }

        testOptions.innerHTML = '';
        for (const option of q.options) {
            const button = document.createElement('button');
            button.className = 'test-option-btn';

            if (typeof option === 'object' && option !== null) {
                const jpDiv = document.createElement('div');
                jpDiv.className = 'font-bold text-2xl';
                jpDiv.textContent = option.japanese;
                button.appendChild(jpDiv);

                const readDiv = document.createElement('div');
                readDiv.className = 'text-base mt-1';
                readDiv.style.color = 'var(--text-secondary-color)';
                readDiv.textContent = option.reading || '';
                button.appendChild(readDiv);

                button.dataset.answer = option.japanese;
            } else {
                button.textContent = option;
                button.dataset.answer = option;
            }

            button.addEventListener('click', () => handleAnswer(button, q));
            testOptions.appendChild(button);
        }
        testProgress.textContent = `Question ${state.currentTestQuestionIndex + 1} of ${state.testQuestions.length} | Score: ${state.score}`;
    }

    function handleAnswer(selectedButton, questionData) {
        const buttons = testOptions.querySelectorAll('.test-option-btn');
        buttons.forEach(btn => btn.disabled = true);

        const correctAnswerValue = (typeof questionData.correctAnswer === 'object' && questionData.correctAnswer !== null) ? questionData.correctAnswer.japanese : questionData.correctAnswer;

        const isCorrect = selectedButton.dataset.answer === correctAnswerValue;

        state.testResults.push({
            question: questionData.question,
            userAnswer: selectedButton.dataset.answer,
            correctAnswer: questionData.correctAnswer,
            isCorrect: isCorrect,
            testType: questionData.testType
        });

        if (isCorrect) {
            selectedButton.classList.add('correct');
            state.score++;
        } else {
            selectedButton.classList.add('incorrect');
            buttons.forEach(btn => {
                if (btn.dataset.answer === correctAnswerValue) {
                    btn.classList.add('correct');
                }
            });
        }

        state.currentTestQuestionIndex++;
        setTimeout(displayNextQuestion, 1500);
    }

    function showTestResults() {
        const endTime = new Date();
        const duration = Math.round((endTime - state.testStartTime) / 1000); // in seconds

        finalScore.textContent = `${state.score} / ${state.testQuestions.length}`;
        timeTaken.textContent = `${duration}s`;

        resultsBreakdown.innerHTML = ''; // Clear previous results
        const heading = document.createElement('h4');
        heading.className = 'text-xl font-bold mb-2';
        heading.textContent = '📝 Review:';
        resultsBreakdown.appendChild(heading);

        state.testResults.forEach(result => {
            const resultEl = document.createElement('div');
            // Use Tailwind colors directly instead of custom .correct/.incorrect classes
            const colorClass = result.isCorrect ? 'text-green-500' : 'text-red-500';
            resultEl.className = `result-item p-2 rounded ${colorClass}`;

            let questionText, answerText;
            if (result.testType === 'ja-en') {
                questionText = result.question.japanese;
                answerText = `Your answer: ${result.userAnswer}. Correct: ${result.correctAnswer}.`;
                // result.correctAnswer is string here
            } else {
                questionText = result.question.english;
                const correctAnswerText = `${result.correctAnswer.japanese} (${result.correctAnswer.reading})`;
                answerText = `Your answer: ${result.userAnswer}. Correct: ${correctAnswerText}.`;
            }

            const iconSpan = document.createElement('strong');
            iconSpan.textContent = (result.isCorrect ? '✔️ ' : '❌ ') + questionText + ': ';
            resultEl.appendChild(iconSpan);

            const textNode = document.createTextNode(answerText);
            resultEl.appendChild(textNode);

            resultsBreakdown.appendChild(resultEl);
        });

        testResultsModal.style.display = 'flex';

        deckManager.saveTestResult({
            deckName: state.deckForTest,
            score: state.score,
            total: state.testQuestions.length,
            date: new Date().toISOString(),
            timeTaken: duration,
            results: state.testResults
        });
        deckManager.updateStreak();
        renderAll();
    }

    function exitTest() {
        testView.style.display = 'none';
        mainContent.style.display = 'block';
    }

    testTypeCancelBtn.addEventListener('click', () => { testTypeModal.style.display = 'none'; });
    closeResultsBtn.addEventListener('click', () => { testResultsModal.style.display = 'none'; exitTest(); });
    exitTestBtn.addEventListener('click', exitTest);

    // --- FLASHCARD GENERATION AND DISPLAY LOGIC ---
    imageUpload.addEventListener('change', (event) => {
        state.uploadedFile = event.target.files[0];
        if (state.uploadedFile) {
            statusMessage.textContent = `Image "${state.uploadedFile.name}" selected.`;
            statusMessage.classList.add('text-green-500');
        }
    });

    const emptyStarSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M11.99 4.316l1.373 4.144h4.358l-3.53 2.564 1.373 4.144L12 13.992l-3.564 2.176 1.373-4.144L6.27 8.46h4.358zM12 2l-3.09 9.29L2 12l5.91 3.71L4.69 22L12 17l7.31 5l-3.22-6.29L22 12l-6.91-2.71z" /></svg>`;
    const filledStarSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M12 17.27l-4.114 2.219l.786-4.721L4.032 10.1l4.771-.692L12 5.09l3.197 4.318l4.771.692l-3.639 3.668l.786 4.721z" /></svg>`;

    function showFlashcard(wordData) {
        currentFlashcard.innerHTML = '';
        currentFlashcard.style.display = 'block';
        flashcardDisplay.style.display = 'flex';
        repetitionButtons.style.display = 'flex';
        saveDeckBtn.style.display = 'block';
        exportJsonBtn.style.display = 'block'; // Make sure export button is shown

        const speakerIcon = `<button class="speaker-btn" aria-label="Play audio"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg></button>`;

        const flashcard = document.createElement('div');
        flashcard.className = 'flashcard';
        flashcard.setAttribute('role', 'button');
        flashcard.setAttribute('tabindex', '0');
        flashcard.setAttribute('aria-label', `Flashcard for ${wordData.japanese}. Click to flip.`);

        const front = document.createElement('div');
        front.className = 'front';

        const jpSpan = document.createElement('span');
        jpSpan.className = 'font-bold text-4xl mb-2';
        jpSpan.textContent = wordData.japanese;
        front.appendChild(jpSpan);

        const readSpan = document.createElement('span');
        readSpan.className = 'text-lg font-normal';
        readSpan.textContent = wordData.reading || '';
        front.appendChild(readSpan);

        // Append speaker icon safely (it contains HTML but is static)
        const speakerBtnFront = document.createElement('div'); // Wrapper to insert HTML
        speakerBtnFront.style.display = 'inline-block';
        speakerBtnFront.innerHTML = speakerIcon;
        // Actually speakerIcon is a button string.
        // Better: extract the inner SVG from string or just insert adjacent HTML?
        // Let's just insert adjacentHTML for the icon.
        front.insertAdjacentHTML('beforeend', speakerIcon);


        const back = document.createElement('div');
        back.className = 'back';

        const enSpan = document.createElement('span');
        enSpan.className = 'font-semibold text-2xl mb-4';
        enSpan.textContent = wordData.english || 'N/A';
        back.appendChild(enSpan);

        const memSpan = document.createElement('span');
        memSpan.className = 'text-sm font-normal italic px-4';
        memSpan.textContent = wordData.mnemonic || '';
        back.appendChild(memSpan);

        back.insertAdjacentHTML('beforeend', speakerIcon);

        const starBtn = document.createElement('button');
        starBtn.className = 'star-btn';
        starBtn.setAttribute('aria-label', 'Toggle star');

        const hardWordsDeck = deckManager.getDecks()['Hard Words'] || [];
        const isAlreadyStarred = hardWordsDeck.some(card =>
            card.japanese === wordData.japanese &&
            card.reading === wordData.reading &&
            card.english === wordData.english
        );

        if (isAlreadyStarred) {
            starBtn.innerHTML = filledStarSVG;
            starBtn.classList.add('starred');
        } else {
            starBtn.innerHTML = emptyStarSVG;
        }

        back.appendChild(starBtn);
        flashcard.appendChild(front);
        flashcard.appendChild(back);
        currentFlashcard.appendChild(flashcard);

        starBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            let decks = deckManager.getDecks();
            let hardWordsDeck = decks['Hard Words'] || [];

            const isCurrentlyStarred = hardWordsDeck.some(card =>
                card.japanese === wordData.japanese &&
                card.reading === wordData.reading &&
                card.english === wordData.english
            );

            if (!isCurrentlyStarred) {
                hardWordsDeck.push(wordData);
                // No need to set decks['Hard Words'] manually if we save explicitly
                starBtn.classList.add('starred');
                starBtn.innerHTML = filledStarSVG;
                showToast(`"${wordData.japanese}" added to Hard Words deck!`);
            } else {
                hardWordsDeck = hardWordsDeck.filter(card =>
                    !(card.japanese === wordData.japanese &&
                        card.reading === wordData.reading &&
                        card.english === wordData.english)
                );
                starBtn.classList.remove('starred');
                starBtn.innerHTML = emptyStarSVG;
                showToast(`"${wordData.japanese}" removed from Hard Words deck.`);
            }
            deckManager.saveDeck('Hard Words', hardWordsDeck);
            renderAll();
        });

        flashcard.querySelectorAll('.speaker-btn').forEach(btn => {
            btn.addEventListener('click', (e) => { e.stopPropagation(); playJapaneseAudio(wordData.reading || wordData.japanese, btn); });
        });
        flashcard.addEventListener('click', (e) => { if (!e.target.closest('.speaker-btn') && !e.target.closest('.star-btn')) { flashcard.classList.toggle('flipped'); } });

        // Keyboard accessibility
        flashcard.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (!e.target.closest('.speaker-btn') && !e.target.closest('.star-btn')) {
                    flashcard.classList.toggle('flipped');
                }
            }
        });
    }

    function showNextCard() {
        if (state.currentCardIndex < state.flashcardsData.length) {
            showFlashcard(state.flashcardsData[state.currentCardIndex]);
            statusMessage.textContent = `Card ${state.currentCardIndex + 1} of ${state.flashcardsData.length}`;
        }
    }

    // --- CORRECTED CODE ---

    function displayMotivationalMessage() {
        let randomIndex;
        // Keep picking a random index until it's different from the last one
        do {
            randomIndex = Math.floor(Math.random() * motivationalQuotes.length);
        } while (motivationalQuotes.length > 1 && randomIndex === state.lastMotivationalQuoteIndex);

        state.lastMotivationalQuoteIndex = randomIndex; // Remember the new index for next time
        const quote = motivationalQuotes[randomIndex];

        motivationalText.textContent = `"${quote.text}"`;
        motivationalAuthor.textContent = `- ${quote.author}`;
        // ... rest of the function (the part that shows/hides the container)
        // Kept visible behind overlay per user request
        // flashcardDisplay.style.display = 'none';
        // repetitionButtons.style.display = 'none';
        // saveDeckBtn.style.display = 'none';
        // flashcardDisplay.style.display = 'none';
        // repetitionButtons.style.display = 'none';
        // saveDeckBtn.style.display = 'none';
        // exportJsonBtn.style.display = 'none'; 
        // statusMessage.textContent = ''; // Kept visible per user request
        // Use GSAP for smooth overlay transition
        motivationalMessageDisplay.style.display = 'flex';

        // Animate Overlay Background
        gsap.fromTo(motivationalMessageDisplay,
            { opacity: 0 },
            { opacity: 1, duration: 0.5, ease: "power2.out" }
        );

        // Animate Content (Scale Up + Fade In)
        gsap.fromTo(".motivational-content",
            { scale: 0.8, opacity: 0, y: 20 },
            { scale: 1, opacity: 1, y: 0, duration: 0.6, delay: 0.1, ease: "back.out(1.7)" }
        );
    }

    continueStudyBtn.addEventListener('click', () => {
        // Animate Out
        gsap.to(".motivational-content", {
            scale: 0.9,
            opacity: 0,
            y: -20,
            duration: 0.4,
            ease: "power2.in"
        });

        gsap.to(motivationalMessageDisplay, {
            opacity: 0,
            duration: 0.4,
            delay: 0.1,
            onComplete: () => {
                motivationalMessageDisplay.style.display = 'none';
                if (state.currentCardIndex >= state.flashcardsData.length) {
                }
            }
        });
    });

    function startStudySession(deck) {
        state.flashcardsData = [...deck]; // Shuffle the cards
        state.currentCardIndex = 0;
        state.cardsStudiedCount = 0;
        selectDecksModal.style.display = 'none';
        mainContent.style.display = 'block';
        testView.style.display = 'none';
        flashcardDisplay.style.display = 'flex';
        showNextCard();
        deckManager.updateStreak();
    }

    function handleRepetition(repetitionType) {
        state.cardsStudiedCount++;

        if (repetitionType === 'repeat') {
            state.flashcardsData.splice(Math.min(state.flashcardsData.length, state.currentCardIndex + Math.floor(Math.random() * 3) + 10), 0, state.flashcardsData[state.currentCardIndex]);
        } else if (repetitionType === 'frequently') {
            state.flashcardsData.splice(Math.min(state.flashcardsData.length, state.currentCardIndex + Math.floor(Math.random() * 3) + 4), 0, state.flashcardsData[state.currentCardIndex]);
        }

        state.currentCardIndex++;

        if (state.currentCardIndex >= state.flashcardsData.length || (state.cardsStudiedCount % 10 === 0 && state.cardsStudiedCount > 0)) {
            displayMotivationalMessage();
        } else {
            showNextCard();
        }
    }

    dontRepeatBtn.addEventListener('click', () => handleRepetition('dont-repeat'));
    repeatBtn.addEventListener('click', () => handleRepetition('repeat'));
    repeatFrequentlyBtn.addEventListener('click', () => handleRepetition('frequently'));

    generateBtn.addEventListener('click', async () => {
        if (!state.uploadedFile) {
            statusMessage.textContent = 'Please select an image first.';
            statusMessage.classList.add('text-red-500');
            return;
        }
        if (generateBtn.disabled) return; // guard against double-submit while a request is already in flight

        statusMessage.textContent = 'Analyzing image...';
        statusMessage.classList.remove('text-red-500');
        loadingSpinner.style.display = 'block';
        flashcardDisplay.style.display = 'none';
        generateBtn.disabled = true;
        generateBtn.classList.add('opacity-50', 'cursor-not-allowed');

        try {
            const base64Data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = () => reject(new Error('Error reading file.'));
                reader.readAsDataURL(state.uploadedFile);
            });

            const mnemonicPhrase = MNEMONIC_LANG_PHRASES[mnemonicLangSelect?.value] || MNEMONIC_LANG_PHRASES.english;
            const prompt = `Act as an expert Japanese OCR, translator, and a creative memory coach. Analyze the text in the image. For each word or phrase, provide: 1. The original Japanese writing (including Kanji). 2. Its reading in Hiragana (furigana). 3. Its English translation. 4. A short, creative, and memorable ${mnemonicPhrase}, connecting the Japanese sound to a memorable concept. Return the result as a JSON array of objects. Each object must have "japanese", "reading", "english", and "mnemonic" properties.`;
            const payload = { contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType: state.uploadedFile.type, data: base64Data } }] }], generationConfig: { responseMimeType: "application/json", responseSchema: { type: "ARRAY", items: { type: "OBJECT", properties: { "japanese": { "type": "STRING" }, "reading": { "type": "STRING" }, "english": { "type": "STRING" }, "mnemonic": { "type": "STRING" } }, required: ["japanese", "reading", "english", "mnemonic"] } } } };
            const localServerUrl = 'https://koicards-api.onrender.com/api/generate';

            // 2. Send the payload to your server (Your server will add the key)
            const response = await fetch(localServerUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                if (response.status === 429) {
                    const errorBody = await response.json().catch(() => null);
                    statusMessage.textContent = errorBody?.error || "You've used today's free limit. Please try again tomorrow.";
                    statusMessage.classList.add('text-red-500');
                    return; // finally block below still runs and resets the loading state
                }
                throw new Error(`API error: ${response.statusText}`);
            }
            const result = await response.json();
            if (result.candidates?.[0]?.content?.parts?.[0]) {
                const parsedJson = JSON.parse(result.candidates[0].content.parts[0].text);
                if (parsedJson?.length > 0) {
                    state.flashcardsData = parsedJson;
                    state.currentCardIndex = 0;

                    // USER REQUEST: Reset streak to 1 when generating flashcards from a new image
                    deckManager.setStreak(1);
                    renderStreak();

                    showNextCard();
                    flashcardDisplay.style.display = 'flex';
                    statusMessage.textContent = 'Flashcards generated!';
                    statusMessage.classList.remove('text-red-500');
                } else { statusMessage.textContent = 'No words found in the image.'; }
            } else { statusMessage.textContent = 'API response issue.'; }
        } catch (error) {
            console.error('Error generating flashcards:', error);
            statusMessage.textContent = 'Something went wrong generating flashcards. Please try again.';
            statusMessage.classList.add('text-red-500');
        } finally {
            loadingSpinner.style.display = 'none';
            generateBtn.disabled = false;
            generateBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    });



    // --- PWA Installation & Service Worker ---

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        state.deferredPrompt = e;
        installBtn.style.display = 'flex';
    });

    installBtn.addEventListener('click', async () => {
        if (state.deferredPrompt) {
            installBtn.style.display = 'none';
            state.deferredPrompt.prompt();
            const { outcome } = await state.deferredPrompt.userChoice;
            console.log(`User response to the install prompt: ${outcome}`);
            state.deferredPrompt = null;
        }
    });

    window.addEventListener('appinstalled', () => {
        state.deferredPrompt = null;
        console.log('PWA was installed');
        showToast('App installed successfully!');
    });

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js')
                .catch((err) => console.error('Service worker registration failed:', err));
        });
    }


    // --- Demo Deck for First-Time Visitors ---
    function seedDemoDeckForFirstTimeVisitors() {
        // v2: bumped so anyone who already got the old Hinglish demo cards
        // (before mnemonics were switched to English-only) gets reseeded once
        // with the corrected deck, instead of keeping the stale text forever.
        const seededKey = 'koicards_demo_seeded_v2';
        if (localStorage.getItem(seededKey)) return; // never re-seed once a visitor has been here before

        const hadOldSeed = !!localStorage.getItem('koicards_demo_seeded');
        localStorage.setItem(seededKey, 'true');

        const decks = deckManager.getDecks();
        // If the old (Hinglish) auto-seeded deck is still sitting there, we
        // overwrite just that one deck below — even if the visitor has since
        // added other real decks — rather than skipping the fix entirely.
        const hasStaleDemoDeck = hadOldSeed && !!decks['Japanese Greetings'];
        if (Object.keys(decks).length > 0 && !hasStaleDemoDeck) return; // don't clobber an existing user's decks

        const demoCards = [
            { japanese: 'こんにちは', reading: 'こんにちは', english: 'Hello / Good afternoon', mnemonic: "Sounds like 'cone-ee-chee-wah' — imagine handing someone an ice cream cone as a friendly hello." },
            { japanese: 'ありがとう', reading: 'ありがとう', english: 'Thank you', mnemonic: "Sounds like 'ah-ree-gah-toh' — picture a gator tipping its hat to say thanks." },
            { japanese: 'すみません', reading: 'すみません', english: 'Excuse me / Sorry', mnemonic: "Sounds like 'soo-mee-mah-sen' — a submarine bumps into you and quietly apologizes." },
            { japanese: 'おはよう', reading: 'おはよう', english: 'Good morning', mnemonic: "Sounds like 'oh-hi-yoh' — like blurting out 'Oh, hi yo!' the second you wake up." },
            { japanese: 'さようなら', reading: 'さようなら', english: 'Goodbye', mnemonic: "Sounds like 'sigh-oh-nah-rah' — you let out a sigh as you wave goodbye." }
        ];
        deckManager.saveDeck('Japanese Greetings', demoCards);
    }

    // --- Initial Render ---
    seedDemoDeckForFirstTimeVisitors();
    deckManager.checkAndResetStreak();
    renderAll();
    getJapaneseVoice(); // Pre-load the voice
});