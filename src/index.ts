import { Database } from './database/db';
import { WebworkerServiceLive, initialize } from './service/webworker';
import { CSVCustomer } from '@model/customer';
import { ViewService } from './service/view';

import './style/style.scss';
import { Effect } from 'effect';

const runApp = async () => {
    const database = Database.getInstance();
    // const service = WebworkerService.getInstance();
    const viewService = ViewService.getInstance();

    const result = await fetch('http://192.168.1.202:3000/data.json');
    const final = await result.json();

    await database.init();
    // service.distributeTasks(final as CSVCustomer[]);
    // await service.onInitialized;

    try {
        const customers = await database.find(1);
        viewService.setDisplayedCustomers(customers);
    } catch(error) {
        console.log('error: ', error);
    }

    await Effect.runPromise(Effect.provide(initialize(), WebworkerServiceLive));
}

runApp();
