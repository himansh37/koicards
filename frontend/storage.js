/**
 * DeckManager handles all data persistence and state management for the application.
 * It abstracts away localStorage and ensures data consistency between decks and their order.
 */
class DeckManager {
    constructor() {
        this.STORAGE_KEYS = {
            DECKS: 'flashcardDecks',
            DECK_ORDER: 'deckOrder',
            PROGRESS_ORDER: 'progressOrder',
            TEST_HISTORY: 'testHistory',
            STREAK: 'studyStreak',
            THEME: 'koicards_theme'
        };
    }

    // --- Helper for LocalStorage ---
    _get(key, defaultValue) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (e) {
            console.error(`Error reading ${key} from localStorage`, e);
            return defaultValue;
        }
    }

    _set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error(`Error writing ${key} to localStorage`, e);
        }
    }

    // --- Decks ---
    getDecks() {
        return this._get(this.STORAGE_KEYS.DECKS, {});
    }

    getDeck(name) {
        const decks = this.getDecks();
        return decks[name] || null;
    }

    saveDeck(name, cards) {
        if (!name || !cards) return false;
        const decks = this.getDecks();
        const isNew = !decks[name];

        decks[name] = cards;
        this._set(this.STORAGE_KEYS.DECKS, decks);

        if (isNew) {
            this._addToOrder(name);
        }
        return true;
    }

    deleteDeck(name) {
        const decks = this.getDecks();
        if (decks[name]) {
            delete decks[name];
            this._set(this.STORAGE_KEYS.DECKS, decks);
            this._removeFromOrder(name);
            this._cleanHistory(name);
            return true;
        }
        return false;
    }

    renameDeck(oldName, newName) {
        if (oldName === newName) return true;

        const decks = this.getDecks();
        if (!decks[oldName]) return false;

        // Prevent overwriting existing deck (unless specifically handled, but for safety return false)
        if (decks[newName]) {
            throw new Error(`Deck "${newName}" already exists.`);
        }

        // Move data
        decks[newName] = decks[oldName];
        delete decks[oldName];
        this._set(this.STORAGE_KEYS.DECKS, decks);

        // Update Orders
        this._renameInOrder(oldName, newName);

        // Update History
        this._renameInHistory(oldName, newName);

        return true;
    }

    // --- Ordering ---
    getDeckOrder() {
        const decks = this.getDecks();
        let order = this._get(this.STORAGE_KEYS.DECK_ORDER, []);
        const deckNames = Object.keys(decks);

        // Sync: Ensure all existing decks are in the order list, and remove ghosts
        let newOrder = order.filter(name => deckNames.includes(name));
        deckNames.forEach(name => {
            if (!newOrder.includes(name)) newOrder.push(name);
        });

        if (JSON.stringify(order) !== JSON.stringify(newOrder)) {
            this.saveDeckOrder(newOrder);
        }
        return newOrder;
    }

    saveDeckOrder(order) {
        this._set(this.STORAGE_KEYS.DECK_ORDER, order);
    }

    getProgressOrder() {
        const decks = this.getDecks();
        let order = this._get(this.STORAGE_KEYS.PROGRESS_ORDER, []);
        const deckNames = Object.keys(decks);

        // Sync
        let newOrder = order.filter(name => deckNames.includes(name));
        deckNames.forEach(name => {
            if (!newOrder.includes(name)) newOrder.push(name);
        });

        if (JSON.stringify(order) !== JSON.stringify(newOrder)) {
            this.saveProgressOrder(newOrder);
        }
        return newOrder;
    }

    saveProgressOrder(order) {
        this._set(this.STORAGE_KEYS.PROGRESS_ORDER, order);
    }

    _addToOrder(name) {
        const deckOrder = this.getDeckOrder(); // this function already syncs
        // Assuming sync handles adding, but if we want explicit append:
        // (getDeckOrder logic actually adds missing items at the end, so we might just need to call it)
        // Explicitly ensuring it is saved:
        if (!deckOrder.includes(name)) {
            deckOrder.push(name);
            this.saveDeckOrder(deckOrder);
        }

        const progressOrder = this.getProgressOrder();
        if (!progressOrder.includes(name)) {
            progressOrder.push(name);
            this.saveProgressOrder(progressOrder);
        }
    }

    _removeFromOrder(name) {
        const deckOrder = this.getDeckOrder().filter(n => n !== name);
        this.saveDeckOrder(deckOrder);

        const progressOrder = this.getProgressOrder().filter(n => n !== name);
        this.saveProgressOrder(progressOrder);
    }

    _renameInOrder(oldName, newName) {
        const deckOrder = this.getDeckOrder().map(n => n === oldName ? newName : n);
        this.saveDeckOrder(deckOrder);

        const progressOrder = this.getProgressOrder().map(n => n === oldName ? newName : n);
        this.saveProgressOrder(progressOrder);
    }

    // --- History ---
    getTestHistory() {
        return this._get(this.STORAGE_KEYS.TEST_HISTORY, []);
    }

    saveTestResult(result) {
        const history = this.getTestHistory();
        history.push(result);
        this._set(this.STORAGE_KEYS.TEST_HISTORY, history);
    }

    _cleanHistory(deckName) {
        const history = this.getTestHistory().filter(item => item.deckName !== deckName);
        this._set(this.STORAGE_KEYS.TEST_HISTORY, history);
    }

    _renameInHistory(oldName, newName) {
        const history = this.getTestHistory();
        let changed = false;
        history.forEach(item => {
            if (item.deckName === oldName) {
                item.deckName = newName;
                changed = true;
            }
        });
        if (changed) this._set(this.STORAGE_KEYS.TEST_HISTORY, history);
    }

    // --- Theme ---
    getTheme() {
        return this._get(this.STORAGE_KEYS.THEME, 'dark');
    }

    setTheme(theme) {
        this._set(this.STORAGE_KEYS.THEME, theme);
    }

    // --- Streak ---
    getStreak() {
        return this._get(this.STORAGE_KEYS.STREAK, { count: 0, lastDate: null });
    }

    updateStreak() {
        const today = new Date();
        const todayDateString = today.toISOString().split('T')[0];
        let streakData = this.getStreak();

        if (streakData.lastDate === todayDateString) {
            return streakData.count; // Already updated today
        }

        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        const yesterdayDateString = yesterday.toISOString().split('T')[0];

        if (streakData.lastDate === yesterdayDateString) {
            streakData.count++;
        } else {
            streakData.count = 1; // Reset or Start
        }

        streakData.lastDate = todayDateString;
        this._set(this.STORAGE_KEYS.STREAK, streakData);
        return streakData.count;
    }

    setStreak(count) {
        const today = new Date();
        const todayDateString = today.toISOString().split('T')[0];
        const streakData = {
            count: count,
            lastDate: todayDateString
        };
        this._set(this.STORAGE_KEYS.STREAK, streakData);
        return streakData.count;
    }

    checkAndResetStreak() {
        const today = new Date();
        const todayDateString = today.toISOString().split('T')[0];
        let streakData = this.getStreak();

        if (!streakData.lastDate) return;

        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        const yesterdayDateString = yesterday.toISOString().split('T')[0];

        // If last update was neither today nor yesterday, the streak is broken.
        if (streakData.lastDate !== todayDateString && streakData.lastDate !== yesterdayDateString) {
            if (streakData.count > 0) {
                streakData.count = 0;
                this._set(this.STORAGE_KEYS.STREAK, streakData);
            }
        }
    }
}

// Fisher-Yates Shuffle Algorithm (Global Utility)
function shuffleArray(array) {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
}
