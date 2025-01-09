import { encodeHex } from "@std/encoding";

/**
 * Fingerprint data for the given request.
 */
export type FingerprintData = {
	/**
	 * Request fingerprint.
	 */
	fingerprint: string;

	/**
	 * Hash with the request properties.
	 */
	propertiesHash: Record<string, string | number>;

	/**
	 * Hash with the header hash.
	 */
	headerHash: Record<string, string>;
};

/**
 * Cookie related options.
 */
type CookieOptions = {
	/**
	 * A cookie with the HttpOnly attribute can't be accessed by JavaScript.
	 */
	httpOnly?: boolean;

	/**
	 * A cookie with the Secure attribute is only sent to the server with an encrypted request over the HTTPS protocol.
	 */
	secure?: boolean;

	/**
	 * The Path attribute indicates a URL path that must exist in the requested URL in order to send the Cookie header.
	 */
	path?: string;

	/**
	 * Expiration time period after which the cookie should be deleted and no longer sent.
	 */
	expires?: number;
};

type Options = {
	/**
	 * Name of the cookie to be used to store the fingerprint.
	 */
	cookieKey: string;

	/**
	 * Allow to disable the cookie setting.
	 */
	toSetCookie: boolean;

	/**
	 * Cookie settings.
	 */
	settings?: CookieOptions;
};

/**
 * Default cookie key for the fingerprint information.
 */
export const DEFAULT_COOKIE_KEY = "__http_fingerprint";

const parseCookies = (req: Request): Record<string, string> => {
	const cookies: Record<string, string> = {};

	const listRawCookies = req.headers.get("cookie")?.split(";") ?? [];
	for (const cookie of listRawCookies) {
		const parts = cookie.split("=");
		cookies[parts[0].trim()] = (parts[1] ?? "").trim();
	}

	return cookies;
};

const sortAndStringObject = (obj: Record<string, string | number>): Record<string, string> => {
	const sorted: Record<string, string> = {};

	// extract the object keys and sort them
	const keys = Object.keys(obj);
	const sortedKeys = keys.sort();

	// reassemble the object with the keys sorted and stringify the values
	for (const key of sortedKeys) {
		sorted[key] = String(obj[key]);
	}

	return sorted;
};

const calculateHash = async (elements: Record<string, string>) => {
	const messageToHash = Object.values(elements).join("");
	const messageBuffer = new TextEncoder().encode(messageToHash);
	const hashBuffer = await crypto.subtle.digest("SHA-256", messageBuffer);
	return encodeHex(hashBuffer);
};

export class HttpFingerprint {
	options: Options;

	constructor(options: Partial<Options> = {}) {
		this.options = {
			cookieKey: options.cookieKey ?? DEFAULT_COOKIE_KEY,
			toSetCookie: options.toSetCookie ?? true,
			settings: options.settings
				? {
						httpOnly: options.settings?.httpOnly ?? false,
						path: options.settings?.path ?? "/",
						secure: options.settings?.secure ?? false,
					}
				: undefined,
		};
	}

	async fingerprint(request: Request): Promise<FingerprintData> {
		let fingerprint = "";
		const headerHash: Record<string, string> = {};

		const cookies = parseCookies(request);

		// if the request cookie already have the fingerprint, return
		if (cookies[this.options.cookieKey]) {
			fingerprint = cookies[this.options.cookieKey];
			return { fingerprint, headerHash, propertiesHash: {} };
		}

		// if the request header already have the fingerprint, return
		if (request.headers.has(this.options.cookieKey)) {
			fingerprint = request.headers.get(this.options.cookieKey)!;
			return { fingerprint, headerHash, propertiesHash: {} };
		}

		const propertiesHash = sortAndStringObject({
			clientCookie: fingerprint,
			rand: Math.random(),
			time: new Date().getTime(),
		});
		fingerprint = await calculateHash(propertiesHash);

		if (this.options.toSetCookie) {
			if (this.options.settings) {
				let settingsParams = "";

				for (const key in this.options.settings) {
					let value = this.options.settings[key as keyof CookieOptions];

					if (key === "expire" && this.options.settings.expires) {
						value = new Date(new Date().getTime() + this.options.settings.expires).toUTCString();
					}

					settingsParams = `${settingsParams}${key}${value ? `=${value}` : ""};`;
				}

				headerHash["Set-Cookie"] = `${this.options.cookieKey}=${fingerprint};${settingsParams}`;
			} else {
				headerHash["Set-Cookie"] = `${this.options.cookieKey}=${fingerprint}`;
			}
		}

		return { fingerprint, headerHash, propertiesHash };
	}
}
