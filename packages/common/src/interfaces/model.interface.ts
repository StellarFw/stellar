export default interface ModelInterface {
	/**
	 * Unique identifier for the model.
	 */
	identity?: string;

	/**
	 * By default, if not present, this will be set by the
	 * code to the default datastore.
	 */
	datastore?: string;

	/**
	 * Model primary key.
	 */
	primaryKey?: string;

	/**
	 * Informs if the models corresponds with a schema.
	 */
	schema?: boolean;

	/**
	 * Dictionary with all model attributes.
	 */
	attributes: any;
}
