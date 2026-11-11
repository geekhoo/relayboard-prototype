import { useCallback, useRef, useState } from "react";
import type { AddResourceForm, CreateBoardForm } from "#/domain/forms";
import {
	addResourceForm,
	BOARD_NAME_MAX,
	createBoardForm,
	createThreadForm,
	DESCRIPTION_MAX,
	firstProblem,
	RESOURCE_DESCRIPTION_MAX,
	RESOURCE_NAME_MAX,
	RESOURCE_TYPES,
	THREAD_TITLE_MAX,
} from "#/domain/forms";
import "./CreateDialog.css";

/**
 * The three create dialogs: a board, a thread in the open board, and a resource on it.
 *
 * ## What comes from the prototype, and where this departs from it
 *
 * The fields, their placeholder text, their character limits and the wording of the confirm button are
 * the prototype's (`app.js` L164-167). The **departures** are the two the ticket calls for and one the
 * prototype could not have:
 *
 * 1. **The limits are enforced at the boundary, not by `maxlength`.** A `maxlength` is an attribute a
 *    request can ignore, and this app has a server. The browser keeps the attribute for a reader's
 *    sake; the same numbers are stated in `src/domain/forms` and checked on arrival.
 * 2. **The resource type is a closed set with a select, not a free-text field.** The prototype passes
 *    no type at all and its mock defaults to `Link`; the ticket closes the set, so the dialog offers
 *    exactly the four and the schema refuses anything else.
 * 3. **A failed create keeps the dialog open with the reason.** The prototype closes on success and
 *    shows a toast on failure, which loses the reader's typing if the toast is missed — 09:20 asks for
 *    the opposite, and it is the better behaviour.
 *
 * ## Why a native <dialog>
 *
 * `showModal()` gives focus containment, Escape-to-close and a backdrop without a hand-written focus
 * trap — three things that are easy to get wrong and that 13b will re-check. It also makes the
 * disabled reason below reachable: the trigger stays in the document when a control is disabled.
 */
export type CreateKind = "board" | "thread" | "resource";

export interface CreateActionsProps {
	readonly kind: CreateKind;
	/** Whether the reader holds the grant for this kind. Drives the disabled state and its reason. */
	readonly allowed: boolean;
	/** The permission that is missing when `allowed` is false, named as the vocabulary names it. */
	readonly required: string;
	readonly onSubmit: (input: CreateInput) => Promise<void>;
	/** The open board's name, for the thread dialog's subtitle. */
	readonly boardName?: string;
}

export type CreateInput =
	| { readonly kind: "board"; readonly form: CreateBoardForm }
	| {
			readonly kind: "thread";
			readonly form: { title: string; description?: string };
	  }
	| { readonly kind: "resource"; readonly form: AddResourceForm };

/**
 * One create control and its dialog.
 *
 * The control is **always rendered and disabled with the reason** when the grant is missing (09:21,
 * DESIGN.md §221): a reader without `create:thread` should know the action exists and what it needs.
 * That is the affordance 07a declared and could not exercise; this is where it becomes real.
 */
export function CreateAction({
	kind,
	allowed,
	required,
	onSubmit,
	boardName,
}: CreateActionsProps) {
	const dialog = useRef<HTMLDialogElement | null>(null);
	const [problem, setProblem] = useState<string | null>(null);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [url, setUrl] = useState("");
	const [type, setType] = useState<(typeof RESOURCE_TYPES)[number]>("Link");
	/**
	 * **One submission per click, guarded synchronously.** The same defect 06c found in the composer and
	 * 08b guarded in the decide controls: React state is asynchronous, so two activations in one tick both
	 * read the old flag. Third place, same shape, and the test for it is a deliberate double-activation.
	 */
	const inFlight = useRef(false);

	const label =
		kind === "board"
			? "New board"
			: kind === "thread"
				? "New thread"
				: "Add resource";

	const open = () => {
		setProblem(null);
		dialog.current?.showModal();
	};

	const submit = useCallback(async () => {
		if (inFlight.current) return;
		inFlight.current = true;
		setProblem(null);
		try {
			if (kind === "board") {
				const parsed = createBoardForm.safeParse({ name, description });
				if (!parsed.success) {
					setProblem(firstProblem(parsed.error));
					return;
				}
				await onSubmit({ kind: "board", form: parsed.data });
			} else if (kind === "thread") {
				const parsed = createThreadForm.safeParse({
					boardId: "placeholder",
					title: name,
					description,
				});
				if (!parsed.success) {
					setProblem(firstProblem(parsed.error));
					return;
				}
				await onSubmit({
					kind: "thread",
					form: {
						title: parsed.data.title,
						description: parsed.data.description,
					},
				});
			} else {
				const parsed = addResourceForm.safeParse({
					boardId: "placeholder",
					name,
					url,
					type,
					description,
				});
				if (!parsed.success) {
					setProblem(firstProblem(parsed.error));
					return;
				}
				await onSubmit({ kind: "resource", form: parsed.data });
			}
			// Only on success: closing the dialog is what discards the reader's input.
			dialog.current?.close();
			setName("");
			setDescription("");
			setUrl("");
		} catch (error) {
			// **The dialog stays open with the reason** (09:20). Closing on failure would lose what the
			// reader typed and tell them nothing.
			setProblem(error instanceof Error ? error.message : String(error));
		} finally {
			inFlight.current = false;
		}
	}, [kind, name, description, url, type, onSubmit]);

	return (
		<>
			<button
				type="button"
				className="create-actions__button"
				data-create={kind}
				aria-disabled={!allowed}
				onClick={() => {
					if (allowed) open();
				}}
			>
				{label}
			</button>
			{allowed ? null : (
				<p className="create-actions__reason" data-create-reason={kind}>
					{label} needs the {required} permission on this board
				</p>
			)}
			<dialog className="create-dialog" ref={dialog} aria-label={label}>
				<form
					method="dialog"
					onSubmit={(event) => {
						event.preventDefault();
						void submit();
					}}
				>
					<div className="create-dialog__head">
						<h2 className="create-dialog__title">{label}</h2>
						<p className="create-dialog__subtitle">
							{subtitleFor(kind, boardName)}
						</p>
					</div>
					<div className="create-dialog__fields">
						<label className="create-dialog__field">
							{nameLabelFor(kind)}
							<input
								className="create-dialog__input"
								data-field="name"
								maxLength={nameMaxFor(kind)}
								value={name}
								onChange={(event) => setName(event.currentTarget.value)}
								aria-invalid={problem !== null}
							/>
						</label>
						{kind === "resource" ? (
							<>
								<label className="create-dialog__field">
									URL
									<input
										className="create-dialog__input"
										data-field="url"
										type="url"
										value={url}
										onChange={(event) => setUrl(event.currentTarget.value)}
										aria-invalid={problem !== null}
									/>
								</label>
								<label className="create-dialog__field">
									Type
									<select
										className="create-dialog__select"
										data-field="type"
										value={type}
										onChange={(event) =>
											setType(
												event.currentTarget
													.value as (typeof RESOURCE_TYPES)[number],
											)
										}
									>
										{RESOURCE_TYPES.map((candidate) => (
											<option key={candidate} value={candidate}>
												{candidate}
											</option>
										))}
									</select>
								</label>
							</>
						) : null}
						<label className="create-dialog__field">
							{kind === "resource" ? "Description" : "Description (optional)"}
							<textarea
								className="create-dialog__textarea"
								data-field="description"
								maxLength={
									kind === "resource"
										? RESOURCE_DESCRIPTION_MAX
										: DESCRIPTION_MAX
								}
								value={description}
								onChange={(event) => setDescription(event.currentTarget.value)}
							/>
						</label>
						{problem === null ? null : (
							<p
								className="create-dialog__problem"
								role="alert"
								data-create-problem
							>
								{problem}
							</p>
						)}
					</div>
					<div className="create-dialog__actions">
						<button
							type="button"
							className="create-dialog__cancel"
							onClick={() => dialog.current?.close()}
						>
							Cancel
						</button>
						<button
							type="submit"
							className="create-dialog__confirm"
							data-create-confirm
						>
							{label}
						</button>
					</div>
				</form>
			</dialog>
		</>
	);
}

const subtitleFor = (kind: CreateKind, boardName?: string): string => {
	if (kind === "thread") {
		return `Start a flat conversation in ${boardName ?? "this board"}.`;
	}
	if (kind === "board") {
		return "Give this project or workspace its own collection of threads.";
	}
	return "Share a reference without copying or managing its contents.";
};

const nameLabelFor = (kind: CreateKind): string =>
	kind === "board"
		? "Board name"
		: kind === "thread"
			? "Thread title"
			: "Resource name";

const nameMaxFor = (kind: CreateKind): number =>
	kind === "board"
		? BOARD_NAME_MAX
		: kind === "thread"
			? THREAD_TITLE_MAX
			: RESOURCE_NAME_MAX;
