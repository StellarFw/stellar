import { Action, ActionMetadata } from "@stellarfw/common";

@ActionMetadata({
	name: "cacheTest",
	description: "I will test the internal cache function of the API",

	inputs: {
		key: {
			description: "Key to store",
			required: true,
		},
		value: {
			description: "Value to store",
			required: true,
		},
	},
})
export class CacheTestAction extends Action {
	public async run() {
		const cacheTestResults: any = {};
		const key = `cache_test_${this.params.key}`;

		// Create a new cache entry
		cacheTestResults.saveResp = await this.api.cache.save(key, this.params.value, 5000);

		// Get the cache size
		cacheTestResults.sizeResp = await this.api.cache.size();

		// Load the cache entry
		const { value, expireTimestamp, createdAt, readAt } = await this.api.cache.load(key);

		cacheTestResults.loadResp = {
			key,
			value,
			expireTimestamp,
			createdAt,
			readAt,
		};

		// Try destroy the cache entry
		cacheTestResults.deleteResp = await this.api.cache.destroy(key);

		return {
			cacheTestResults,
		};
	}
}
