// default open-next.config.ts file created by @opennextjs/cloudflare
import type { OpenNextConfig } from "@opennextjs/cloudflare/config";
import { defineCloudflareConfig } from "@opennextjs/cloudflare/config";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

const config: OpenNextConfig = {
	...defineCloudflareConfig({
		incrementalCache: r2IncrementalCache,
	}),
	buildCommand: "npm run build-local",
};

export default config;
