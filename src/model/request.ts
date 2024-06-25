import { Customer } from "@model/customer";

export type CrudRequest = ReadRequest | DeleteRequest | UpdateRequest | WriteRequest;
export type DbRequestType = 'read' | 'delete' | 'update' | 'write';
export type DbResponseType = 'autocomplete' | 'accumulate' | 'read' | 'write' | 'clear' | 'done' | 'batch' | 'terminated';

export interface DbResponse {
    type: DbResponseType;
}

export interface QueryResponse extends DbResponse {
    result: string[];
}

export interface DbRequest {
    type: DbRequestType;
}

export interface ReadRequest extends DbRequest {
    type: 'read';
    payload?: {
        query: string;
        by: keyof Customer;
        where: () => boolean
    }
}

export interface DeleteRequest extends DbRequest {
    type: 'delete'
    payload: {
        id: string | string[];
    }
}

export interface UpdateRequest extends DbRequest {
    type: 'update';
    payload: {
        id: string;
        updates: Partial<Customer>;
    }
}

export interface WriteRequest extends DbRequest {
    type: 'write';
    payload: Customer;
}