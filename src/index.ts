export * from './model/index';
export * from './service/index';

import { Database } from './database/db';
import { CSVCustomer } from '@model/customer';
import { ViewService } from './service/view';

import './style/style.scss';
import { Chunk, Effect, Ref } from 'effect';
import { DataLoader, createAutoCompleteStream } from './service/index';

const runApp = async () => {
    const database = Database.getInstance();
    const service = DataLoader.getInstance();
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

    await Effect.runPromise(
        Effect.scoped(
            Effect.gen(function* () {
                const autoCompleteReceiver: Ref.Ref<Chunk.Chunk<string>> = yield* Ref.make(Chunk.empty<string>());
                yield* createAutoCompleteStream(autoCompleteReceiver);
            })
        )

    );
}

runApp();
