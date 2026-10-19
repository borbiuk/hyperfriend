interface KeyChipsProps {
	/** One label per key, e.g. from formatShortcutParts. */
	parts: string[];
	/** Dims the keys (e.g. while the shortcut is disabled). */
	muted?: boolean;
}

/**
 * Keys of a shortcut as GitHub-style `<kbd>` chips. Decorative: the parent provides the
 * accessible name.
 */
export function KeyChips({ parts, muted = false }: KeyChipsProps) {
	return (
		<span
			aria-hidden="true"
			style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}
		>
			{parts.map((part, index) => (
				<kbd
					key={index}
					style={{
						boxSizing: 'border-box',
						minWidth: 20,
						padding: '1px 5px',
						fontFamily: 'var(--fontStack-sansSerif)',
						fontSize: 11,
						lineHeight: '14px',
						textAlign: 'center',
						color: muted
							? 'var(--fgColor-muted)'
							: 'var(--fgColor-default)',
						backgroundColor: 'var(--bgColor-muted)',
						border: '1px solid var(--borderColor-default)',
						borderBottomWidth: 2,
						borderRadius: 5,
					}}
				>
					{part}
				</kbd>
			))}
		</span>
	);
}
