import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createPublicKey } from "node:crypto";

const defaultPemPath = "apps/extension/dist.pem";
const pemPath = process.argv[2] ?? defaultPemPath;

const run = async () => {
	const absolutePemPath = resolve(process.cwd(), pemPath);
	const pem = await readFile(absolutePemPath, "utf-8");
	const publicKey = createPublicKey(pem);
	const der = publicKey.export({ type: "spki", format: "der" });
	const manifestKey = der.toString("base64");
	console.log(manifestKey);
};

await run();
