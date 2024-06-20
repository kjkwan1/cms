export interface Customer {
    id: string;
    firstName: string;
    lastName: string;
    company: string;
    city: string;
    country: string;
    phone: string;
    secondaryPhone: string;
    email: string;
    subscriptionDate: string;
    website: string;
}

export interface CSVCustomer {
    "Index": number,
    "Customer Id": string,
    "First Name": string,
    "Last Name": string,
    "Company": string,
    "City": string,
    "Country": string,
    "Phone 1": string,
    "Phone 2": string,
    "Email": string,
    "Subscription Date": string,
    "Website": string
}