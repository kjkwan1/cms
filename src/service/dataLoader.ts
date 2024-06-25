import { Chunk as C, Deferred, Effect, Ref } from "effect";
import { Chunk } from "effect/Chunk";
import { CSVCustomer, Customer } from "../model";

export const loadData = (receiver: Deferred.Deferred<Chunk<Customer>>, data: CSVCustomer[]) => Effect.gen(function* () {
    const workers = yield* initializeWorkers;
    const sections: Ref.Ref<Chunk<CSVCustomer>[]> = yield* Ref.make([
        C.empty<CSVCustomer>(),
        C.empty<CSVCustomer>(),
        C.empty<CSVCustomer>(),
        C.empty<CSVCustomer>(),
    ]);

    const chunked = C.fromIterable(data);
    const alphabet = 'abcdefghijklmnopqrstuvwxyz';

    C.forEach(chunked, (customer: CSVCustomer) => Effect.runCallback(Effect.gen(function* () {
        const firstLetter = customer['First Name'][0].toLowerCase();
        const index = Math.floor(alphabet.indexOf(firstLetter) / 7);
        yield* Ref.update(sections, (state) => {
            const toUpdate = state[index];
            const newChunk = C.make(customer);
            state[index] = C.appendAll(newChunk)(toUpdate);
            return state;
        })
    })));

    let finished: Chunk<Chunk<Customer>> = C.empty();
    const sectionsValue = yield* sections.get;
    for (let i = 0; i < workers.length; i++) {
        const result = yield* processCommand(workers[i], { cmd: 'process', data: sectionsValue[i]});
        finished = C.append(finished, result);
    }

    const merged = C.flatten(finished);
    yield* Deferred.complete(Effect.succeed(merged))(receiver);
})

const initializeWorkers: Effect.Effect<Worker[]> = Effect.succeed([
    new Worker(new URL('../worker/init.js', import.meta.url), { type: 'module' }),
    new Worker(new URL('../worker/init.js', import.meta.url), { type: 'module' }),
    new Worker(new URL('../worker/init.js', import.meta.url), { type: 'module' }),
    new Worker(new URL('../worker/init.js', import.meta.url), { type: 'module' }),
]);

const processCommand = (worker: Worker, message: { cmd: string, data: Chunk<CSVCustomer> }) => Effect.gen(function* () {
    const done = yield* Deferred.make<undefined>();
    let result: Customer[] = [];
    const handleResult = (event: MessageEvent<Customer[]>) => Effect.runCallback(
        Effect.gen(function* () {
            result = [...result, ...event.data];
            yield* Deferred.complete(Effect.succeed(undefined))(done);
        })
    )

    const processedMessage = {
        cmd: message.cmd,
        data: (message.data.toJSON() as any).value
    }

    worker.addEventListener('message', handleResult);
    worker.postMessage(processedMessage);

    yield* Effect.addFinalizer(() => Effect.gen(function* () {
        worker.removeEventListener('message', handleResult);
    }));

    yield* Deferred.await(done);
    return C.fromIterable(result);
})