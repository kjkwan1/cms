globalThis.indexedDB = globalThis.indexedDB
    || globalThis.webkitIndexedDB
    || globalThis.mozIndexedDB;

self.onmessage = (event) => {
    if (event.data.cmd === 'process') {
        const processed = event.data.data.map(convertToCustomer);
        const openRequest = globalThis.indexedDB.open('dashboard', 1);
        openRequest.onsuccess = function() {
            const db = openRequest.result;
            const tx = db.transaction('customers', 'readwrite');
            const store = tx.objectStore('customers');

            Promise.all(processed.map(customer => store.add(customer)))
                .then(() => {
                    tx.commit();
                    self.postMessage({ status: 'success', message: 'All data processed and stored' });
                })
                .catch(e => {
                    self.postMessage({ status: 'error', message: 'Failed to write to database', error: e.message });
                });
        };     
    }
}

const convertToCustomer = (item) => ({
    id: item["Customer Id"] || item['Index'],
    firstName: item["First Name"],
    lastName: item["Last Name"],
    company: item["Company"],
    city: item["City"],
    country: item["Country"],
    phone: item["Phone 1"],
    secondaryPhone: item["Phone 2"],
    email: item["Email"],
    subscriptionDate: item["Subscription Date"],
    website: item["Website"],
});