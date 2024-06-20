import { DBSchema } from "idb";
import { Customer } from "../../model/customer";

export interface CustomerDB extends DBSchema {
    customers: {
        key: string,
        value: Customer,
        indexes: {
            'by-first-name': string
            'by-last-name': string
            'by-subscription-date': string
        }
    },
}