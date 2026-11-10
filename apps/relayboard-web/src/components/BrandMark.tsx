import "./BrandMark.css";

/**
 * The brand mark: three rotated bars. DESIGN.md §Shapes calls it the only form in the
 * system that is neither a rectangle nor a circle.
 *
 * Placement, size and the 3px gap are utilities, because a utility expresses them
 * cleanly. Only the mark's own anatomy — three bars of three heights — lives in the
 * co-located sheet. The bars paint in `currentColor`, so the caller supplies the token.
 */
export function BrandMark({ className }: { className?: string }) {
	return (
		<span
			aria-hidden="true"
			className={`brand-mark flex h-[29px] w-[29px] rotate-[-11deg] items-end gap-hair ${className ?? ""}`}
		>
			<span className="brand-mark__bar" />
			<span className="brand-mark__bar" />
			<span className="brand-mark__bar" />
		</span>
	);
}
