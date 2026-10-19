import { useEffect, useRef, useState } from 'react';

/**
 * State of an on/off switch that shows the user's choice at once, before storage confirms it.
 * Without it, two quick clicks during the storage round trip would both send the same value.
 *
 * Storage updates are followed only while no write of this switch is in flight, so a
 * change notification for an older click can't flip the switch back. A failed write
 * restores the stored value.
 *
 * @param stored - Value currently in the config.
 * @param save - Writes a new value.
 * @param onError - Called when a write fails.
 * @returns The value to show and the change handler for the switch.
 */
export function useOptimisticToggle(
	stored: boolean,
	save: (value: boolean) => Promise<void>,
	onError: () => void
): [boolean, (value: boolean) => void] {
	const [value, setValue] = useState(stored);
	const pending = useRef(0);
	const storedRef = useRef(stored);
	storedRef.current = stored;

	useEffect(() => {
		if (pending.current === 0) {
			setValue(stored);
		}
	}, [stored]);

	const change = (next: boolean): void => {
		setValue(next);
		pending.current++;
		save(next)
			.catch(() => {
				setValue(storedRef.current);
				onError();
			})
			.finally(() => {
				pending.current--;
			});
	};

	return [value, change];
}
