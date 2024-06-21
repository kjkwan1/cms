import { Chunk, Context, Effect, Layer, PubSub, Ref, Scope } from "effect";
import { CSVCustomer, Customer } from "../model/customer";
import { makeSemaphore } from "effect/Effect";
import { EventService } from "./event";

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

const terminate = Effect.runSync(PubSub.unbounded());

const accumulated: Chunk.Chunk<Customer> = Chunk.empty();

export class WebworkerService extends Context.Tag('WebworkerService')<
    WebworkerService,
    {
        readonly initAutocomplete: () => Effect.Effect<void, Error, Scope.Scope>;
        readonly initAccumulate: () => Effect.Effect<void, Error, Scope.Scope>;
        readonly initDbCrud: () => Effect.Effect<void, Error, Scope.Scope>;
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
                        const task = mutex.withPermits(1)(autoCompleteRef.get);

                    }
                })
            ), 300)
            search.addEventListener('input', handler);

            yield* Effect.addFinalizer((exit) => {
                search.removeEventListener('input', handler);
                return Effect.succeed(undefined);
            });
            yield* terminate.subscribe;
            yield* Effect.never;
        }),
        initAccumulate: () => Effect.gen(function* () {
            const search = document.getElementById('search') as HTMLInputElement;
            if (!search) {
                return Effect.fail(new Error('Input component not found'));
            }

            const handler = () => {};
            search.addEventListener('keydown', handler);
            yield* terminate.subscribe;
            yield* Effect.never;
        }),
        initDbCrud: () => Effect.gen(function* () {
            yield* terminate.subscribe;
            yield* Effect.never;
        }),
        terminate: () => Effect.gen(function* () {
            yield* Effect.never;
        }),
    })
)

function debounce(func: any, wait: number) {
    let timeout: any;
    return function(...args: any[]) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// export class WebworkerService {
//     private static instance: WebworkerService;
//     private workerCount = navigator.hardwareConcurrency || 4;
//     private chunkSize = 500;
//     private workers: Worker[] = [];
//     private queue: CSVCustomer[][] = [];

//     private _onInitialized: Promise<void>;
//     private resolve: (val: unknown) => void;
//     private reported = 0;

//     constructor() {
//         this.initWorkers();
//         this._onInitialized = new Promise((resolve) => {
//             this.resolve = resolve;
//         });
//     }

//     get onInitialized() {
//         return this._onInitialized;
//     }

//     public static getInstance(): WebworkerService {
//         if (!this.instance) {
//             this.instance = new WebworkerService();
//         }
//         return this.instance;
//     }

//     public distributeTasks(customers: CSVCustomer[]) {
//         for (let i = 0; i < customers.length; i += this.chunkSize) {
//             this.queue.push(customers.slice(i, i + this.chunkSize));
//         }
//         this.assignTasks();
//     }

//     public terminateWorkers() {
//         this.workers.forEach(worker => worker.terminate());
//         this.workers = [];
//     }

//     private initWorkers() {
//         for (let i = 0; i < this.workerCount; i++) {
//             const worker = new Worker(new URL('../worker/init.js', import.meta.url), { type: 'module' });
//             worker.onmessage = this.handleMessage.bind(this, worker);
//             worker.onerror = this.handleError.bind(this);
//             this.workers.push(worker);
//         }
//     }

//     private assignTasks() {
//         this.workers.forEach(worker => {
//             if (this.queue.length > 0) {
//                 const task = this.queue.shift();
//                 worker.postMessage({ cmd: 'process', data: task });     
//             }
//         });
//     }

//     private handleMessage(worker: Worker, event: MessageEvent) {
//         if (this.queue.length > 0) {
//             const nextTask = this.queue.shift();
//             worker.postMessage({ cmd: 'process', data: nextTask });
//         } else {
//             this.reported++;
//             if (this.reported === this.workerCount) {
//                 this.terminateWorkers();
//                 this.resolve(null);
//             }
//         }
//     }

//     private handleError(e: ErrorEvent) {
//         console.error('Worker error:', e.message);
//     }
// }
