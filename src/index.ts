export * from './model/index';
export * from './service/index';

import { Database } from './database/db';
import { Customer } from '@model/customer';
import { ViewService } from './service/view';

import './style/style.scss';
import { Chunk, Deferred, Effect, Ref } from 'effect';
import { createAutoCompleteStream, loadData } from './service/index';

const runApp = async () => {
    const database = Database.getInstance();
    const viewService = ViewService.getInstance();

    const result = await fetch('http://192.168.1.202:3000/data.json');
    const final = await result.json();
    await database.init();

    if (!database.isAlreadyOpen()) {
        const dataset = await Effect.runPromise(
            Effect.scoped(
                Effect.gen(function* () {
                    const receiver = yield* Deferred.make<Chunk.Chunk<Customer>>();
                    yield* loadData(receiver, final);
                    const result: Chunk.Chunk<Customer> = yield* Deferred.await(receiver);
                    return result;
                })
            )
        )
    
        for (const customer of dataset) {
            await database.save(customer);
        }
    }

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
                const shutdown = yield* Deferred.make<undefined>()
                yield* createAutoCompleteStream(autoCompleteReceiver, shutdown);
            })
        )
    );
}

runApp();
