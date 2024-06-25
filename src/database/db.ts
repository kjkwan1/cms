import { openDB, IDBPDatabase } from 'idb';
import { CustomerDB } from './schema/customer-db';
import { Customer } from '../model/customer';

export class Database {
    private readonly name = 'dashboard';
    private readonly ver = 1;

    private static db: Database;
    private idb!: IDBPDatabase<CustomerDB>;

    public async init() {
        this.idb = await openDB<CustomerDB>(this.name, this.ver, {
            upgrade(db: IDBPDatabase<CustomerDB>) {
                const store = db.createObjectStore('customers', {
                    keyPath: 'id',
                });
                store.createIndex('by-first-name', 'firstName');
                store.createIndex('by-last-name', 'lastName');
                store.createIndex('by-subscription-date', 'subscriptionDate');
            }
        });
    }

    public static getInstance() {
        if (!this.db) {
            this.db = new Database();
        }
        return this.db;
    }

    public async find(page: number = 1, limit: number = 100): Promise<Customer[]> {
        const tx = this.idb.transaction('customers', 'readonly');
        const store = tx.objectStore('customers');
        const offset = (page - 1) * limit;

        const customers: Customer[] = [];
        let cursor = await store.openCursor();

        if (offset > 0) {
            cursor = await cursor.advance(offset);
        }

        while (cursor && customers.length < limit) {
            customers.push(cursor.value);
            cursor = await cursor.continue();
        }

        await tx.done;
        return customers;
    }

    public async findByName(query: string, page: number = 1, limit: number = 100) {
        const tx = this.idb.transaction('customers', 'readonly');
        const store = tx.objectStore('customers');
        const fnindex = store.index('by-first-name');
        const lnindex = store.index('by-last-name');
        const offset = (page - 1) * limit;
        const result = [];

        let total = 0;

        let fnCursor = await fnindex.openCursor();
        while (fnCursor && total < limit) {
            const firstName = fnCursor.value.firstName;
            if (firstName.toLowerCase().startsWith(query.toLowerCase())) {
                result.push(fnCursor.value);
            }
            fnCursor = await fnCursor.continue();
        }

        let lnCursor = await lnindex.openCursor();
        while (lnCursor && total < limit) {
            const lastName = lnCursor.value.lastName;
            if (lastName.toLowerCase().startsWith(query.toLowerCase())) {
                result.push(lnCursor.value);
            }
            lnCursor = await lnCursor.continue();
        }
        
        await tx.done;

        return result;
    }

    public update(id: string, update: Customer) {
        return this.idb.put('customers', update, id);
    }

    public delete(id: string) {
        return this.idb.delete('customers', id);
    }

    public save(customer: Customer) {
        return this.idb.add('customers', customer);
    }

    public isAlreadyOpen() {
        return this.idb.objectStoreNames.contains('customers');
    }
}