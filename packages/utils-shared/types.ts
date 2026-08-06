export type FirstArgOf<T> = T extends (first: infer FirstArg, ...args: never[]) => unknown
	? FirstArg
	: never;
