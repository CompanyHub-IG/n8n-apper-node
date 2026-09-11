import type { FieldType, ILoadOptionsFunctions, ResourceMapperField, ResourceMapperFields } from 'n8n-workflow';

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
	Picklist: 'options',
	Select: 'options',
	Dropdown: 'options',
	MultiSelect: 'options',
	MultiPicklist: 'options',
	Tag: 'string',
	Lookup: 'options',
	MasterDetail: 'string',
	People: 'options',
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

interface ApperUser {
	id: string;
	name: string;
}

async function fetchAppUsers(this: ILoadOptionsFunctions, appId: string): Promise<ApperUser[]> {
	const response = await this.helpers.httpRequestWithAuthentication.call(this, 'apperApi', {
		method: 'POST',
		url: `https://api.apper.io/v1/data/${appId}/users`,
		body: {},
		json: true,
	});

	const users = (response?.data as ApperUser[] | undefined) ?? [];
	return users.map((u) => ({ id: u.id, name: (u.name ?? u.id).trim() }));
}

interface ApperTableMeta {
	id: number;
	name: string;
	label: string;
}

async function fetchAppTables(this: ILoadOptionsFunctions, appId: string): Promise<ApperTableMeta[]> {
	const response = await this.helpers.httpRequestWithAuthentication.call(this, 'apperApi', {
		method: 'GET',
		url: `https://api.apper.io/v1/meta/${appId}/tables`,
		json: true,
	});

	return (response?.data as ApperTableMeta[] | undefined) ?? [];
}

interface ApperLookupRecord {
	Id: string;
	Name?: string;
}

// Lookup fields reference another table via parentTableId. Resolve that id
// to the target table's name, then list a page of its records so the user
// can pick one by name rather than typing a raw record Id.
async function fetchLookupRecords(
	this: ILoadOptionsFunctions,
	appId: string,
	targetTableName: string,
): Promise<ApperLookupRecord[]> {
	const response = await this.helpers.httpRequestWithAuthentication.call(this, 'apperApi', {
		method: 'POST',
		url: `https://api.apper.io/v1/data/${appId}/tables/${targetTableName}`,
		body: {
			fields: ['Id', 'Name'],
			OrderBy: [{ FieldName: 'Id', SortType: 'Desc' }],
			PagingInfo: { Limit: 100 },
		},
		json: true,
	});

	return (response?.data as ApperLookupRecord[] | undefined) ?? [];
}

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
		parentTableId?: number;
	}>;

	const hasPeopleField = apperFields.some((f) => f.type === 'People');
	const lookupFields = apperFields.filter((f) => f.type === 'Lookup' && f.parentTableId);

	const [users, allTables] = await Promise.all([
		hasPeopleField ? fetchAppUsers.call(this, appId) : Promise.resolve<ApperUser[]>([]),
		lookupFields.length > 0 ? fetchAppTables.call(this, appId) : Promise.resolve<ApperTableMeta[]>([]),
	]);

	// For each distinct target table referenced by a Lookup field, resolve
	// its name and fetch its records once - avoids refetching the same
	// target table's records if multiple Lookup fields point to it.
	const lookupOptionsByFieldName = new Map<string, Array<{ name: string; value: string }>>();

	for (const field of lookupFields) {
		const targetTable = allTables.find((t) => t.id === field.parentTableId);
		if (!targetTable) continue;

		const records = await fetchLookupRecords.call(this, appId, targetTable.name);
		lookupOptionsByFieldName.set(
			field.name,
			records.map((r) => ({ name: r.Name || r.Id, value: r.Id })),
		);
	}

	const fields: ApperResourceMapperField[] = apperFields
		.filter((field) => field.name.toLowerCase() !== 'id')
		.map((field) => {
			let options: Array<{ name: string; value: string }> | undefined;

			if (field.type === 'People') {
				options = users.map((u) => ({ name: u.name, value: u.id }));
			} else if (field.type === 'Lookup') {
				options = lookupOptionsByFieldName.get(field.name) ?? [];
			} else if (
				(field.type === 'Picklist' || field.type === 'Select' || field.type === 'Dropdown' || field.type === 'MultiPicklist' || field.type === 'MultiSelect') &&
				field.options
			) {
				options = field.options.map((opt) => ({ name: opt, value: opt }));
			}

			return {
				id: field.name,
				displayName: field.label,
				type: mapApperTypeToFieldType(field.type),
				required: field.isRequired,
				defaultMatch: false,
				display: true,
				apperType: field.type,
				options,
			};
		});

	return { fields: fields as unknown as ResourceMapperFields['fields'] };
}