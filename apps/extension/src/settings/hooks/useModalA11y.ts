import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from "react";
import { useCallback, useEffect, useRef } from "react";
import { MODAL_FOCUSABLE_SELECTOR } from "@/settings/constants";

type UseModalA11yOptions = {
	createOpen: boolean;
	pickOpen: boolean;
	createNameInputRef: RefObject<HTMLInputElement | null>;
	pickSearchInputRef: RefObject<HTMLInputElement | null>;
};

export const useModalA11y = ({
	createOpen,
	pickOpen,
	createNameInputRef,
	pickSearchInputRef,
}: UseModalA11yOptions) => {
	const appMainRef = useRef<HTMLElement | null>(null);
	const modalRestoreFocusRef = useRef<HTMLElement | null>(null);
	const createModalRef = useRef<HTMLDivElement | null>(null);
	const pickModalRef = useRef<HTMLDivElement | null>(null);
	const wasCreateOpenRef = useRef(false);
	const wasPickOpenRef = useRef(false);

	const storeModalTriggerFocus = useCallback((): void => {
		const active = document.activeElement;
		if (active instanceof HTMLElement) {
			modalRestoreFocusRef.current = active;
		}
	}, []);

	const restoreModalTriggerFocus = useCallback((): void => {
		const target = modalRestoreFocusRef.current;
		modalRestoreFocusRef.current = null;
		if (target && document.contains(target)) {
			target.focus();
		}
	}, []);

	const trapModalFocus = useCallback(
		(
			event: ReactKeyboardEvent<HTMLDivElement>,
			container: HTMLDivElement | null
		): void => {
			if (event.key !== "Tab" || !container) {
				return;
			}
			const focusable = Array.from(
				container.querySelectorAll<HTMLElement>(MODAL_FOCUSABLE_SELECTOR)
			).filter((element) => !element.hasAttribute("aria-hidden"));
			if (focusable.length === 0) {
				event.preventDefault();
				container.focus();
				return;
			}
			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			const active = document.activeElement;
			if (event.shiftKey && active === first) {
				event.preventDefault();
				last.focus();
				return;
			}
			if (!event.shiftKey && active === last) {
				event.preventDefault();
				first.focus();
			}
		},
		[]
	);

	const onModalKeyDown = useCallback(
		(
			event: ReactKeyboardEvent<HTMLDivElement>,
			container: HTMLDivElement | null,
			closeModal: () => void
		): void => {
			if (event.key === "Escape") {
				event.preventDefault();
				closeModal();
				return;
			}
			trapModalFocus(event, container);
		},
		[trapModalFocus]
	);

	useEffect(() => {
		const modalOpen = createOpen || pickOpen;
		const main = appMainRef.current;
		if (main) {
			if (modalOpen) {
				main.setAttribute("aria-hidden", "true");
				main.setAttribute("inert", "");
			} else {
				main.removeAttribute("aria-hidden");
				main.removeAttribute("inert");
			}
		}
		document.body.style.overflow = modalOpen ? "hidden" : "";
		return () => {
			document.body.style.overflow = "";
		};
	}, [createOpen, pickOpen]);

	useEffect(() => {
		if (createOpen && !wasCreateOpenRef.current) {
			window.requestAnimationFrame(() => {
				createNameInputRef.current?.focus();
			});
		}
		if (!createOpen && wasCreateOpenRef.current && !pickOpen) {
			restoreModalTriggerFocus();
		}
		wasCreateOpenRef.current = createOpen;
	}, [createOpen, pickOpen, restoreModalTriggerFocus, createNameInputRef]);

	useEffect(() => {
		if (pickOpen && !wasPickOpenRef.current) {
			window.requestAnimationFrame(() => {
				pickSearchInputRef.current?.focus();
			});
		}
		if (!pickOpen && wasPickOpenRef.current && !createOpen) {
			restoreModalTriggerFocus();
		}
		wasPickOpenRef.current = pickOpen;
	}, [createOpen, pickOpen, restoreModalTriggerFocus, pickSearchInputRef]);

	return {
		appMainRef,
		createModalRef,
		pickModalRef,
		storeModalTriggerFocus,
		trapModalFocus,
		onModalKeyDown,
	};
};
