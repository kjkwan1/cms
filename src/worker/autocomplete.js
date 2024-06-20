import { openDB } from "idb";

self.onmessage = async (event) => {
    console.log('worker enter');
    const { query, maxSuggestions, queryId } = event.data;

    const db = await openDB('dashboard', 1);
    const tx = db.transaction('customers', 'readonly');
    const store = tx.objectStore('customers');
    const results = [];
    let cursor;

    try {
        cursor = await store.openCursor();
    } catch (e) {
        self.postMessage({ type: 'error', queryId });
        return;
    }

    while (results.length < maxSuggestions && cursor) {
        const { firstName, lastName } = cursor.value;
        if (firstName.toLowerCase().startsWith(query) || lastName.toLowerCase().startsWith(query)) {
            console.log(`found ${cursor.value.firstName} ${cursor.value.lastName}`);
            results.push(cursor.value);
        }

        try {
            cursor = await cursor.continue();
        } catch (e) {
            break;
        }
    }

    await tx.done;

    const first = results[0];
    if (!first) {
        return;
    }

    const isUniqueFirstName = !results.some((val) => val.firstName !== first.firstName);
    console.log('isUnique: ', isUniqueFirstName);

    if (isUniqueFirstName) {
        results.sort((a, b) => {
            a.lastName > b.lastName ? 1 : -1;
        });
    } else {
        results.sort((a, b) => {
            a.firstName > b.firstName ? 1 : -1;
        });
    }

    self.postMessage({ type: 'results', queryId, results });
};