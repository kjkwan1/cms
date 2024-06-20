import { CSVCustomer } from "../model/customer";

export class WebworkerService {
    private static instance: WebworkerService;
    private workerCount = navigator.hardwareConcurrency || 4;
    private chunkSize = 500;
    private workers: Worker[] = [];
    private queue: CSVCustomer[][] = [];

    private _onInitialized: Promise<void>;
    private resolve: (val: unknown) => void;
    private reported = 0;

    constructor() {
        this.initWorkers();
        this._onInitialized = new Promise((resolve) => {
            this.resolve = resolve;
        });
    }

    get onInitialized() {
        return this._onInitialized;
    }

    public static getInstance(): WebworkerService {
        if (!this.instance) {
            this.instance = new WebworkerService();
        }
        return this.instance;
    }

    public distributeTasks(customers: CSVCustomer[]) {
        for (let i = 0; i < customers.length; i += this.chunkSize) {
            this.queue.push(customers.slice(i, i + this.chunkSize));
        }
        this.assignTasks();
    }

    public terminateWorkers() {
        this.workers.forEach(worker => worker.terminate());
        this.workers = [];
    }

    private initWorkers() {
        for (let i = 0; i < this.workerCount; i++) {
            const worker = new Worker(new URL('../worker/init.js', import.meta.url), { type: 'module' });
            worker.onmessage = this.handleMessage.bind(this, worker);
            worker.onerror = this.handleError.bind(this);
            this.workers.push(worker);
        }
    }

    private assignTasks() {
        this.workers.forEach(worker => {
            if (this.queue.length > 0) {
                const task = this.queue.shift();
                worker.postMessage({ cmd: 'process', data: task });     
            }
        });
    }

    private handleMessage(worker: Worker, event: MessageEvent) {
        if (this.queue.length > 0) {
            const nextTask = this.queue.shift();
            worker.postMessage({ cmd: 'process', data: nextTask });
        } else {
            this.reported++;
            if (this.reported === this.workerCount) {
                this.terminateWorkers();
                this.resolve(null);
            }
        }
    }

    private handleError(e: ErrorEvent) {
        console.error('Worker error:', e.message);
    }
}
