import { openDB } from "idb";

const BATCH_SIZE = 10;
let lastQuery = "";
let seenCombinations = new Set();

self.onmessage = async (event) => {
    const { query, maxSuggestions } = event.data;

    if (query !== lastQuery) {
        seenCombinations.clear();
        self.postMessage({ type: 'clear' });
    }

    lastQuery = query;

    const db = await openDB('dashboard', 1);
    const tx = db.transaction('customers', 'readonly');
    const store = tx.objectStore('customers');
    let results = [];
    let cursor;

    try {
        cursor = await store.openCursor();
    } catch (e) {
        return;
    }

    while (results.length < maxSuggestions && cursor) {
        const { firstName, lastName, email } = cursor.value;
        const combinationKey = `${firstName} ${lastName} ${email}`;

        if ((firstName.toLowerCase().startsWith(query) || lastName.toLowerCase().startsWith(query)) && !seenCombinations.has(combinationKey)) {
            seenCombinations.add(combinationKey);
            results.push(`${firstName} ${lastName}`);
        }

        if (results.length === BATCH_SIZE) {
            self.postMessage({ type: 'batch', result: results });
            results = [];
        }

        try {
            cursor = await cursor.continue();
        } catch (e) {
            break;
        }
    }

    await tx.done;

    const first = results[0];
    if (!first || !results.length) {
        self.postMessage({ type: 'done' })
        return;
    }

    if (results.length) {
        self.postMessage({ type: 'batch', result: results });
    }

    const isUniqueFirstName = !results.some((val) => val.firstName !== first.firstName);

    if (isUniqueFirstName) {
        results.sort((a, b) => (a.lastName > b.lastName ? 1 : -1));
    } else {
        results.sort((a, b) => (a.firstName > b.firstName ? 1 : -1));
    }

    self.postMessage({ type: 'done' });
};
