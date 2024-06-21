import { Chunk, Context, Deferred, Effect, Fiber, Layer, Queue, Ref, Scope, Stream, pipe } from "effect";
import { Customer } from "../model/customer";
import { makeSemaphore } from "effect/Effect";
import { ViewService } from "./view";

const autoCompleteRef = Effect.runSync(
    Ref.make(new Worker(new URL('../worker/autocomplete.js', import.meta.url), { type: 'module' }))
);

const accumulateRef = Effect.runSync(
    Ref.make(new Worker(new URL('../worker/accumulate.js', import.meta.url), { type: 'module' }))
);

const dbCrudRef = Effect.runSync(
    Ref.make(new Worker(new URL('../worker/db-crud.js', import.meta.url), { type: 'module' }))
);

const mutex = Effect.runSync(makeSemaphore(1));

const terminate = Effect.runSync(Deferred.make<undefined>());

const accumulated: Chunk.Chunk<Customer> = Chunk.empty();

export class WebworkerService extends Context.Tag('WebworkerService')<
    WebworkerService,
    {
        readonly initAutocomplete: () => Effect.Effect<void, Error, Scope.Scope>;
        readonly initAccumulate: () => Effect.Effect<void, Error, Scope.Scope>;
        readonly initDbCrud: () => Effect.Effect<void, Error, Scope.Scope>;
        readonly receive: <T>(
            workerRef: Ref.Ref<Worker>,
            queue: Queue.Queue<T>,
            sigTerm: Deferred.Deferred<undefined>
        ) => Effect.Effect<void, Error, Scope.Scope>;
        readonly terminate: () => Effect.Effect<void>;
    }
>() {};

export const WebworkerServiceLive = Layer.succeed(
    WebworkerService,
    WebworkerService.of({
        initAutocomplete: () => Effect.gen(function* () {
            const search = document.getElementById('search') as HTMLInputElement;
            if (!search) {
                return Effect.fail(new Error('Input component not found'));
            }

            const handler = debounce((event: Event) => Effect.runSync(
                Effect.gen(function* () {
                    const query = (event.target as any).value;
                    if (query) {
                        const worker = yield* autoCompleteRef.get;
                        yield* mutex.withPermits(1)(Effect.succeed( worker.postMessage({ query, maxSuggestions: 100 })));
                    }
                })
            ), 300);
            search.addEventListener('input', handler);

            yield* Effect.addFinalizer(() => {
                search.removeEventListener('input', handler);
                return Effect.succeed(undefined);
            });
            yield* Deferred.await(terminate);
            yield* Effect.never;
        }),
        initAccumulate: () => Effect.gen(function* () {
            const search = document.getElementById('search') as HTMLInputElement;
            if (!search) {
                return Effect.fail(new Error('Input component not found'));
            }

            const handler = (event: Event) => Effect.runSync(
                Effect.gen(function* () {
                    const query = (event.target as any).value;
                    if (query) {
                        const worker = yield* accumulateRef.get;
                        yield* mutex.withPermits(1)(Effect.succeed(() => {
                            worker.postMessage({ query, maxSuggestions: 100 });
                        }));
                    }   
                })
            );
            search.addEventListener('keydown', handler);

            yield* Effect.addFinalizer(() => {
                search.removeEventListener('keydown', handler);
                return Effect.succeed(undefined);
            });
            yield* Deferred.await(terminate);
            yield* Effect.never;
        }),
        initDbCrud: () => Effect.gen(function* () {
            const handler = (event: Event) => Effect.runSync(
                Effect.gen(function* () {
                    const query = (event.target as any).value;
                    if (query) {
                        const worker = yield* dbCrudRef.get;
                        yield* mutex.withPermits(1)(Effect.succeed(worker.postMessage({ query, maxSuggestions: 100 })));
                    }
                })
            );
            document.addEventListener('dbQuery', handler);

            yield* Effect.addFinalizer(() => {
                document.removeEventListener('dbQuery', handler);
                return Effect.succeed(undefined);
            });
            yield* Deferred.await(terminate);
            yield* Effect.never;
        }),
        receive: <T>(
            workerRef: Ref.Ref<Worker>,
            queue: Queue.Queue<T>,
            sigTerm: Deferred.Deferred<undefined>
        ) => Effect.gen(function* () {
            const worker = yield* workerRef.get;

            const handler = (message: any) => Effect.runSync(Effect.gen(function* () {
                yield* queue.offer(message.data);
            }))

            worker.addEventListener('message', handler);

            yield* Effect.addFinalizer(() => {
                worker.removeEventListener('input', handler);
                return Effect.succeed(undefined);
            });

            yield* Deferred.await(sigTerm);
            yield* Effect.never;
        }),
        terminate: () => Effect.gen(function* () {
            yield* Deferred.complete(terminate, undefined);
        }),
    })
);

function debounce(func: any, wait: number) {
    let timeout: any;
    return function(...args: any[]) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

export const initialize = () => Effect.scoped(
    Effect.gen(function* () {
        const service = yield* WebworkerService;
        
        const autoCompleteEventFiber: Fiber.RuntimeFiber<void, Error> = yield* Effect.fork(service.initAutocomplete());
        const accumulateEventFiber: Fiber.RuntimeFiber<void, Error> = yield* Effect.fork(service.initAccumulate());
        const crudEventFiber: Fiber.RuntimeFiber<void, Error> = yield* Effect.fork(service.initDbCrud());

        const autoCompleteReceiver: Queue.Queue<AutoCompleteResponse> = yield* Queue.bounded<AutoCompleteResponse>(100);
        const autoCompleteTerminate = yield* Deferred.make<undefined>();

        const accumulateReceiver: Queue.Queue<Customer[]> = yield* Queue.bounded<Customer[]>(1000);
        const accumulateTerminate = yield* Deferred.make<undefined>();

        const autoCompleteFiber: Fiber.RuntimeFiber<void, Error> = yield* Effect.fork(
            service.receive(autoCompleteRef, autoCompleteReceiver, autoCompleteTerminate)
        );
        const accumulateFiber: Fiber.RuntimeFiber<void, Error> = yield* Effect.fork(
            service.receive(accumulateRef, accumulateReceiver, accumulateTerminate)
        )

        const autoCompleteUiFiber: Fiber.RuntimeFiber<void, Error> = yield* Effect.fork(autoCompleteTest(autoCompleteReceiver));

        yield* Fiber.joinAll([
            autoCompleteEventFiber,
            accumulateEventFiber,
            crudEventFiber,
            autoCompleteFiber,
            accumulateFiber,
            autoCompleteUiFiber
        ]);
        yield* Effect.never;
    })
)

const autoCompleteTest = (queue: Queue.Queue<AutoCompleteResponse>) => pipe(
    Stream.fromQueue(queue),
    Stream.map((data) => {
        const viewService = ViewService.getInstance();
        viewService.setDisplayedCustomers(data.result);
    }),
    Stream.runDrain
)

type CrudRequest = ReadRequest | DeleteRequest | UpdateRequest | WriteRequest;
type DbRequestType = 'read' | 'delete' | 'update' | 'write';
type DbResponseType = 'autocomplete' | 'accumulate' | 'read' | 'write';

interface DbResponse {
    type: DbResponseType;
}

interface AutoCompleteResponse extends DbResponse {
    type: 'autocomplete'
    result: Customer[];
}

interface DbRequest {
    type: DbRequestType;
}

interface ReadRequest extends DbRequest {
    type: 'read';
    payload?: {
        query: string;
        by: keyof Customer;
        where: () => boolean
    }
}

interface DeleteRequest extends DbRequest {
    type: 'delete'
    payload: {
        id: string | string[];
    }
}

interface UpdateRequest extends DbRequest {
    type: 'update';
    payload: {
        id: string;
        updates: Partial<Customer>;
    }
}

interface WriteRequest extends DbRequest {
    type: 'write';
    payload: Customer;
}