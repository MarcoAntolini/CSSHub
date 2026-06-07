/** Pure preview rasterization helpers (content script + injected frame scripts). */

export const isLikelyPreviewFrameDocument = (doc: Document): boolean => {
	if (doc.querySelector(".cm-editor, .cm-content, .cm-line")) {
		return false;
	}

	const root = doc.documentElement;
	const width = root.clientWidth || root.scrollWidth || 0;
	const height = root.clientHeight || root.scrollHeight || 0;
	if (width > 640 || height > 520) {
		return false;
	}

	const body = doc.body;
	if (!body) {
		return false;
	}

	if (body.children.length === 0 && (body.textContent?.trim().length ?? 0) === 0) {
		return false;
	}

	return width >= 40 || height >= 40 || body.children.length > 0;
};

const drawHtmlImageToDataUrl = (img: HTMLImageElement): string | null => {
	if (!img.complete || img.naturalWidth <= 0 || img.naturalHeight <= 0) {
		return null;
	}
	const canvas = document.createElement("canvas");
	canvas.width = img.naturalWidth;
	canvas.height = img.naturalHeight;
	const context = canvas.getContext("2d");
	if (!context) {
		return null;
	}
	context.drawImage(img, 0, 0);
	return canvas.toDataURL("image/png");
};

const rasterizeDataUrl = (dataUrl: string, width: number, height: number): Promise<string | null> =>
	new Promise((resolve) => {
		const image = new Image();
		image.onload = () => {
			const canvas = document.createElement("canvas");
			canvas.width = Math.max(1, Math.round(width));
			canvas.height = Math.max(1, Math.round(height));
			const context = canvas.getContext("2d");
			if (!context) {
				resolve(null);
				return;
			}
			context.drawImage(image, 0, 0, canvas.width, canvas.height);
			resolve(canvas.toDataURL("image/png"));
		};
		image.onerror = () => resolve(null);
		image.src = dataUrl;
	});

export const drawSvgElementToDataUrl = async (
	svg: SVGSVGElement
): Promise<string | null> => {
	try {
		const rect = svg.getBoundingClientRect();
		const width =
			rect.width ||
			Number.parseFloat(svg.getAttribute("width") ?? "0") ||
			svg.viewBox?.baseVal.width ||
			0;
		const height =
			rect.height ||
			Number.parseFloat(svg.getAttribute("height") ?? "0") ||
			svg.viewBox?.baseVal.height ||
			0;
		if (width <= 0 || height <= 0) {
			return null;
		}

		const clone = svg.cloneNode(true) as SVGSVGElement;
		clone.setAttribute("width", String(width));
		clone.setAttribute("height", String(height));
		const xml = new XMLSerializer().serializeToString(clone);
		const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
		return rasterizeDataUrl(dataUrl, width, height);
	} catch (_error) {
		return null;
	}
};

export const capturePreviewFromDocument = (doc: Document): string | null => {
	for (const canvas of Array.from(doc.querySelectorAll("canvas"))) {
		if (!(canvas instanceof HTMLCanvasElement)) {
			continue;
		}
		if (canvas.width <= 0 || canvas.height <= 0) {
			continue;
		}
		try {
			return canvas.toDataURL("image/png");
		} catch (_error) {
			continue;
		}
	}

	for (const img of Array.from(doc.querySelectorAll("img"))) {
		if (!(img instanceof HTMLImageElement)) {
			continue;
		}
		const dataUrl = drawHtmlImageToDataUrl(img);
		if (dataUrl) {
			return dataUrl;
		}
	}

	return null;
};

export const capturePreviewFromDocumentAsync = async (
	doc: Document
): Promise<string | null> => {
	const immediate = capturePreviewFromDocument(doc);
	if (immediate) {
		return immediate;
	}

	const svg = doc.querySelector("svg");
	if (svg instanceof SVGSVGElement) {
		const fromSvg = await drawSvgElementToDataUrl(svg);
		if (fromSvg) {
			return fromSvg;
		}
	}

	return null;
};
