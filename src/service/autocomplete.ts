import { Chunk, Deferred, Effect, Ref } from "effect";
import { QueryResponse } from "..";
import { makeSemaphore } from "effect/Effect";

export const createAutoCompleteStream = (
    receiverChunkRef: Ref.Ref<Chunk.Chunk<string>>,
    shutdown: Deferred.Deferred<undefined>,
) => Effect.gen(function* () {
    const semaphore = yield* makeSemaphore(1);
    const withPermit = semaphore.withPermits(1);
    const worker = yield* autoCompleteRef.get;
    const search = document.getElementById('search') as HTMLInputElement;

    const searchCallback = debounce((event: Event) => Effect.runCallback(
        Effect.gen(function* () {
            const query = (event.target as any).value;
            if (!query) {
                return;
            }
            yield* withPermit(
                postMessage(worker, receiverChunkRef, query)
            );
        })
    ), 300);

    search.addEventListener('input', searchCallback);

    yield* Effect.addFinalizer(() => Effect.gen(function* () {
        search.removeEventListener('input', searchCallback);
    }));

    yield* Deferred.await(shutdown);
    yield* Effect.succeed(true);
});

const autoCompleteRef = Effect.runSync(
    Ref.make(new Worker(new URL('../worker/autocomplete.js', import.meta.url), { type: 'module' }))
);

const postMessage = (worker: Worker, chunkRef: Ref.Ref<Chunk.Chunk<string>>, query: string) => Effect.gen(function* () {
    const done = yield* Deferred.make<boolean>();
    const callback = (event: MessageEvent<QueryResponse>) => Effect.runCallback(
        Effect.gen(function* () {
            const { type, result } = event.data;
            switch (type) {
                case 'done':
                    yield* Deferred.complete<boolean, never>(Effect.succeed(true))(done);
                    break;
                case 'batch':
                    yield* Ref.update(chunkRef, (state) => {
                        if (!result || !result.length) {
                            return state;
                        }
                        const appendage = Chunk.fromIterable(result);
                        const appended = Chunk.appendAll(appendage)(state);
                        console.log('appended: ', appended);
                        return appended;
                    });
                    break;
                case 'clear':
                    yield* Ref.update(chunkRef, () => Chunk.empty());
                    break;
            }
        }
    ));
    worker.addEventListener('message', callback);
    worker.postMessage({ query, maxSuggestions: 100 });

    yield* Deferred.await(done);

    worker.removeEventListener('message', callback);

    yield* Effect.succeed(true);
});

const debounce = (func: any, wait: number) => {
    let timeout: NodeJS.Timeout;
    return function(...args: any[]) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}
