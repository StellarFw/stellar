export type RunCommandArgs = {
	prod?: boolean;
	port?: number;
	clean?: boolean;
	update?: boolean;
	cluster?: boolean;
	id?: string;
	silent?: boolean;
	workers?: number;
	workerPrefix?: string;
};
