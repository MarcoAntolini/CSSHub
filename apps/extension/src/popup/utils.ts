import { THRESHOLD_MAX, THRESHOLD_MIN } from "./constants";

export const relativeTime = (iso: string): string | null => {
	const t = Date.parse(iso);
	if (!Number.isFinite(t)) {
		return null;
	}
	const diff = Date.now() - t;
	const sec = Math.max(0, Math.round(diff / 1000));
	if (sec < 5) return "just now";
	if (sec < 60) return `${sec}s ago`;
	const min = Math.round(sec / 60);
	if (min < 60) return `${min}m ago`;
	const hr = Math.round(min / 60);
	if (hr < 24) return `${hr}h ago`;
	const day = Math.round(hr / 24);
	return `${day}d ago`;
};

export const clampThreshold = (value: number): number =>
	Math.min(THRESHOLD_MAX, Math.max(THRESHOLD_MIN, Math.round(value)));
