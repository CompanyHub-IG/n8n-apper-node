import type { FieldType, ILoadOptionsFunctions, ResourceMapperFields } from 'n8n-workflow';

function mapApperTypeToFieldType(apperType: string): FieldType {
	switch (apperType) {
		case 'Number':
		case 'Integer':
		case 'Decimal':
			return 'number';

		case 'Boolean':
		case 'Bool':
			return 'boolean';

		case 'Date':
		case 'DateTime':
			return 'dateTime';

		case 'Picklist':
		case 'Select':
		case 'Dropdown':
			return 'options';

		// Apper's docs specify these as "Record ID (integer)", unlike Zapier's
		// looser string mapping - Apper's own API is strict about JSON types
		// (confirmed by the Decimal/price_c case), so treat these as numbers too.
		case 'Lookup':
		case 'MasterDetail':
			return 'number';

		// Text, MultilineText, Email, Tag come through as plain text inputs.
		// MultiSelect/MultiPicklist also stay as string - Apper expects a
		// comma-separated string for these (per docs), not a JSON array.
		// People also stays as string - Apper expects [{"User": <id>}] for
		// this type, which doesn't fit a simple input; use the field's
		// "Expression" toggle to enter that raw JSON manually when needed.
		default:
			return 'string';
	}
}

function extractValue(param: unknown): string {
	if (typeof param === 'string') return param;
	if (param && typeof param === 'object' && 'value' in param) {
		return (param as { value: string }).value;
	}
	return '';
}

export async function getTableFields(this: ILoadOptionsFunctions): Promise<ResourceMapperFields> {
	const appId = extractValue(this.getNodeParameter('appId', 0));
	const tableName = extractValue(this.getNodeParameter('tableName', 0));

	if (!appId || !tableName) {
		return { fields: [] };
	}

	const response = await this.helpers.httpRequestWithAuthentication.call(this, 'apperApi', {
		method: 'GET',
		url: `https://api.apper.io/v1/meta/${appId}/tables/${tableName}/fields`,
		json: true,
	});

	const apperFields = (response.data ?? []) as Array<{
		name: string;
		label: string;
		type: string;
		isRequired: boolean;
		options?: string[] | null;
	}>;

	return {
		fields: apperFields
			.filter((field) => field.name.toLowerCase() !== 'id')
			.map((field) => ({
				id: field.name,
				displayName: field.label,
				type: mapApperTypeToFieldType(field.type),
				required: field.isRequired,
				defaultMatch: false,
				display: true,
				options:
					(field.type === 'Picklist' || field.type === 'Select' || field.type === 'Dropdown') &&
					field.options
						? field.options.map((opt) => ({ name: opt, value: opt }))
						: undefined,
			})),
	};
}