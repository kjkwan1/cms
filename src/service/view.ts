import { Customer } from "../model/customer";
import { EventServiceLive, initializeListeners } from './event';
import { Observer } from "effect-util";
import { Chunk, Effect, SubscriptionRef } from "effect";

export class ViewService {
    private static instance: ViewService;
    private container: HTMLElement;
    private autoCompleteRef: SubscriptionRef.SubscriptionRef<Customer[]>;
    private worker = new Worker(new URL('../worker/autocomplete.js', import.meta.url), { type: 'module' });

    private _page: Observer<number> = new Observer(1);
    private unsubscribe!: () => void;

    constructor() {
        const container = document.getElementById('customersDisplay');
        if (container) {
            this.container = container;
        }
        this.autoCompleteRef = Effect.runSync(SubscriptionRef.make([]));
        const init = Effect.provide(initializeListeners(this.autoCompleteRef), EventServiceLive);
        Effect.runPromise(init);
    }

    get page() {
        return this._page;
    }
    
    public static getInstance(): ViewService {
        if (!this.instance) {
            this.instance = new ViewService();
        }

        return this.instance;
    }

    public setDisplayedCustomers(customers: Customer[]) {
        this.container.innerHTML = '';
    
        const header = document.createElement('thead');
        const headerRow = document.createElement('tr');
        const headers = ['Name', 'Email', 'Company', 'City', 'Country', 'Phone', 'Date Subscribed'];
    
        headers.forEach(text => {
            const th = document.createElement('th');
            th.innerText = text;
            headerRow.appendChild(th);
        });
        header.appendChild(headerRow);
    
        const bodyFragment = document.createDocumentFragment();
        const body = document.createElement('tbody');
    
        for (const customer of customers) {
            const tr = document.createElement('tr');
            tr.classList.add('customers__display--item');
            
            const createCell = (text: string) => {
                const td = document.createElement('td');
                td.innerText = text;
                return td;
            };
    
            tr.appendChild(createCell(`${customer.firstName} ${customer.lastName}`));
            tr.appendChild(createCell(customer.email));
            tr.appendChild(createCell(customer.company));
            tr.appendChild(createCell(customer.city));
            tr.appendChild(createCell(customer.country));
            tr.appendChild(createCell(customer.phone));
            tr.appendChild(createCell(customer.subscriptionDate));
    
            bodyFragment.appendChild(tr);
        }
    
        body.appendChild(bodyFragment);
    
        const fragment = document.createDocumentFragment();
        fragment.appendChild(header);
        fragment.appendChild(body);
    
        this.container.appendChild(fragment);
    }

    public destroy() {
        this.unsubscribe();
        this._page.shutdown();
        const buttons = document.querySelectorAll('.page-link');
        buttons.forEach((button) => {
            button.removeEventListener('click', () => {});
        });
    }
}