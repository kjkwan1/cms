import { Database } from './database/db';
import { WebworkerService } from './service/webworker';
import { CSVCustomer } from '@model/customer';
import { ViewService } from './service/view';

import './style/style.scss';

const runApp = async () => {
    const database = Database.getInstance();
    const service = WebworkerService.getInstance();
    const viewService = ViewService.getInstance();

    const result = await fetch('http://192.168.1.202:3000/data.json');
    const final = await result.json();

    await database.init();
    service.distributeTasks(final as CSVCustomer[]);
    await service.onInitialized;

    try {
        const customers = await database.find(1);
        viewService.setDisplayedCustomers(customers);
    } catch(error) {
        console.log('error: ', error);
    }

    viewService.page.subscribe(async (data) => {
        const customers = await database.find(data);
        viewService.setDisplayedCustomers(customers);
    });

}

runApp();
