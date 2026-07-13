export const createInterruptible = () => {
	type ResolveArgs = { interrupted: boolean };
	type Resolve = (args: ResolveArgs) => void;

	let resolveList: Resolve[] = [];

	const add = (targetToWait: () => Promise<unknown>) =>
		new Promise<ResolveArgs>((resolve, reject) => {
			resolveList.push(resolve);
			targetToWait().then(
				() => resolve({ interrupted: false }),
				(error) => reject(error),
			);
		});

	const clear = () => (resolveList = []);
	const getLength = () => resolveList.length;
	const interrupt = () => resolveList.forEach((resolve) => resolve({ interrupted: true }));

	return {
		add,
		clear,
		getLength,
		interrupt,
	};
};
