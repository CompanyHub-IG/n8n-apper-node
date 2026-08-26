import type { FieldType, ILoadOptionsFunctions, ResourceMapperField, ResourceMapperFields } from 'n8n-workflow';

// Mirrors Apper's field type list (same convention used in the Zapier
// integration), mapped onto n8n's supported FieldType values. n8n only
// understands 'string' | 'number' | 'dateTime' | 'boolean' | 'options' (plus
// a few others not relevant here), so several distinct Apper types collapse
// onto the same n8n type - e.g. Text/Email/Tag/Lookup/People/Uuid all become
// plain string inputs. "People" is still a plain string input on the UI
// side (the user types/pastes a user ID) - it's transformed into Apper's
// [{ "Id": <value> }] array shape later, in preSend.ts's castFields, using
// the apperType carried alongside each field below.
const apperToN8nFieldType: Record<string, FieldType> = {
	Text: 'string',
	MultilineText: 'string',
	Number: 'number',
	Integer: 'number',
	Decimal: 'number',
	Date: 'dateTime',
	DateTime: 'dateTime',
	Boolean: 'boolean',
	Bool: 'boolean',
	Email: 'string',
	// Picklist/Select/Dropdown get real dropdown behavior via the `options`
	// array built below from the field's `choices`/`options` metadata.
	Picklist: 'options',
	Select: 'options',
	Dropdown: 'options',
	// Apper expects a comma-separated string for these, not a JSON array -
	// keep them as plain string inputs.
	MultiSelect: 'string',
	MultiPicklist: 'string',
	Tag: 'string',
	// Lookup/MasterDetail: Apper's docs list these as string references
	// (not integers).
	Lookup: 'string',
	MasterDetail: 'string',
	// People: string input on the UI, converted to [{ Id: value }] on send.
	People: 'string',
	Uuid: 'string',
};

function mapApperTypeToFieldType(apperType: string): FieldType {
	return apperToN8nFieldType[apperType] ?? 'string';
}

function extractValue(param: unknown): string {
	if (typeof param === 'string') return param;
	if (param && typeof param === 'object' && 'value' in param) {
		return (param as { value: string }).value;
	}
	return '';
}

// n8n's ResourceMapperField type doesn't have a slot for "the original API
// type this came from" - we need that in preSend.ts to know a "string"
// field is actually Apper's People type and needs array-wrapping. n8n
// serializes whatever we return here into the node's stored parameter
// value as-is, so this extra property survives and comes back out through
// getNodeParameter('columns').schema in preSend.ts.
type ApperResourceMapperField = ResourceMapperField & { apperType: string };

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

	const fields: ApperResourceMapperField[] = apperFields
		.filter((field) => field.name.toLowerCase() !== 'id')
		.map((field) => ({
			id: field.name,
			displayName: field.label,
			type: mapApperTypeToFieldType(field.type),
			required: field.isRequired,
			defaultMatch: false,
			display: true,
			apperType: field.type,
			options:
				(field.type === 'Picklist' || field.type === 'Select' || field.type === 'Dropdown') &&
				field.options
					? field.options.map((opt) => ({ name: opt, value: opt }))
					: undefined,
		}));

	return { fields: fields as unknown as ResourceMapperFields['fields'] };
}