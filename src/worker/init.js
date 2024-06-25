self.onmessage = (event) => {
    if (event.data.cmd === 'process') {
        const processed = event.data.data.map(convertToCustomer).sort((a, b) => a.firstName.localeCompare(b.firstName));
        self.postMessage(processed);
    }
};

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
