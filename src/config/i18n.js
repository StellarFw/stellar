export default {
	i18n() {
		return {
			// ---------------------------------------------------------------------
			// Active locales
			// ---------------------------------------------------------------------
			locales: ["en"],

			// ---------------------------------------------------------------------
			// Fallbacks
			// ---------------------------------------------------------------------
			fallbacks: {
				// 'PT_pt': 'en'
			},

			// ---------------------------------------------------------------------
			// Update files
			// ---------------------------------------------------------------------
			updateFiles: true,

			// ---------------------------------------------------------------------
			// Configure logging and error messages in the log(s)
			// ---------------------------------------------------------------------
			defaultLocale: "en",

			// ---------------------------------------------------------------------
			// Method used to determine the connection's locale.
			//
			// By default, every request will be in the 'en' locale
			// ---------------------------------------------------------------------
			determineConnectionLocale: "api.i18n.determineConnectionLocale",
		};
	},
};
