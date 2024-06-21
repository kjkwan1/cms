import { Context, Data, Effect, Fiber, Layer, PubSub, Scope, SubscriptionRef, SynchronizedRef } from "effect";
import { Ref } from "effect";

import { Customer } from "../model/customer";
import { Database } from "../database/db";
import { ViewService } from "./view";

const worker = new Worker(new URL('../worker/autocomplete.js', import.meta.url), { type: 'module' });

const queryId = Effect.runSync(SynchronizedRef.make(1));
const terminate = Effect.runSync(PubSub.unbounded());

export const workerRef = Ref.make(worker);

function debounce(func: any, wait: any) {
    let timeout: any;
    return function(...args: any[]) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

export class EventService extends Context.Tag('EventService')<
    EventService,
    {
        readonly createInputListener: (
            ref: SubscriptionRef.SubscriptionRef<Customer[]>,
            workerRef: Ref.Ref<Worker>
        ) => Effect.Effect<void, never, Scope.Scope>;
        readonly createEnterListener: () => Effect.Effect<void, never, Scope.Scope>;
        readonly createPageChangeListener: () => Effect.Effect<void, never, Scope.Scope>,
        readonly receiveMessage: (workerRef: Ref.Ref<Worker>, handler: (...args: any) => void) => Effect.Effect<void, never, Scope.Scope>;
        readonly terminate: () => Effect.Effect<void>;
    }
>() {};

export const EventServiceLive = Layer.succeed(
    EventService,
    EventService.of({
        createInputListener: (ref, workerRef) => Effect.gen(function* () {
            const search = document.getElementById('search') as HTMLInputElement;

            const handler = debounce((event: Event) => Effect.runSync(
                Effect.gen(function* () {
                    const query = (event.target as any).value;
                    if (!query) {
                        yield* SubscriptionRef.updateEffect(ref, () => Effect.succeed([]));
                        return;
                    }

                    yield* SynchronizedRef.update(queryId, (val) => val + 1);

                    const currentId = yield* SynchronizedRef.get(queryId);
                    const worker = yield* workerRef.get;
                    worker.postMessage({ query, queryId: currentId, maxSuggestions: 100 });
                })
            ), 300);

            search.addEventListener('input', handler);

            yield* Effect.addFinalizer((exit) => {
                search.removeEventListener('input', handler);
                return Effect.succeed(void 0);
            });

            yield* terminate.subscribe;
            yield* Effect.never;
        }),
        createEnterListener: () => Effect.gen(function* () {
            const search = document.getElementById('search') as HTMLInputElement;

            const enterHandler = async (event: KeyboardEvent) => {
                if (event.key !== 'Enter') {
                    return;
                }
                const databaseService = Database.getInstance();
                const val = (event.target as any).value;
                const customers = await databaseService.findByName(val);
                if (!val.length) {
                    const customers = await databaseService.find(1);
                    ViewService.getInstance().setDisplayedCustomers(customers);
                    return;
                }

                ViewService.getInstance().setDisplayedCustomers(customers);
            };

            search.addEventListener('keydown', enterHandler);

            yield* Effect.addFinalizer(() => {
                search.removeEventListener('keydown', (e) => enterHandler(e));
                return Effect.succeed(void 0);
            });

            yield* terminate.subscribe;
            yield* Effect.never;
        }),
        createPageChangeListener: () => Effect.gen(function* () {
            const pageTransitions = document.querySelectorAll('.page-link');
            const databaseService = Database.getInstance();
            const viewService = ViewService.getInstance();
            const handler = async (event: Event) => {
                const value = (event.target as any).dataset.pagenum || 1; 
                const result = await databaseService.find(value);
                viewService.setDisplayedCustomers(result);
            }
            pageTransitions.forEach((button) => {
                button.addEventListener('click', handler);
            });

            yield* Effect.addFinalizer(() => {
                pageTransitions.forEach((button) => {
                    button.removeEventListener('click', handler);
                })
                return Effect.succeed(undefined);
            })

            yield* terminate.subscribe;
            yield* Effect.never;
            
        }),
        receiveMessage: (workerRef: Ref.Ref<Worker>, handler: (...args: any) => void) => Effect.gen(function* () {
            const worker = yield* workerRef.get;
            worker.addEventListener('message', handler);

            yield* Effect.addFinalizer(() => {
                worker.removeEventListener('message', handler);
                return Effect.succeed(void 0);
            });

            yield* terminate.subscribe;
            yield* Effect.never;
        }),
        terminate: () => Effect.gen(function* () {
            yield* PubSub.publish(terminate, void 0);
        }),
    })
)

export const initializeListeners = (
    autoCompleteRef: SubscriptionRef.SubscriptionRef<Customer[]>
) => Effect.scoped(
    Effect.gen(function* () {
        const eventService = yield* EventService;
        const workerRefInstance = yield* workerRef;
    
        const inputFiber: Fiber.RuntimeFiber<void, never> = yield* Effect.fork(eventService.createInputListener(autoCompleteRef, workerRefInstance));
        const enterFiber: Fiber.RuntimeFiber<void, never> = yield* Effect.fork(eventService.createEnterListener());
        const pageTransitionFiber: Fiber.RuntimeFiber<void, never> = yield* Effect.fork(eventService.createPageChangeListener());
    
        const workerMessageFiber: Fiber.RuntimeFiber<void, never> = yield* Effect.fork(
            Effect.gen(function* () {
                const handleMessage = (event: any) => {
                    const { type, results } = event.data;
                    if (type === 'results') {
                        Effect.runSync(SubscriptionRef.update(autoCompleteRef, () => results));
                    }
                }
                yield* eventService.receiveMessage(workerRefInstance, handleMessage);
                yield* Effect.never;
            })
        )
    
        yield* Fiber.joinAll([inputFiber, enterFiber, workerMessageFiber, pageTransitionFiber]);
        yield* Effect.never;
    })
)
