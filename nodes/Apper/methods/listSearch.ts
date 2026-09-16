import type { IDataObject, ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';

function extractValue(param: unknown): string {
	if (typeof param === 'string') return param;
	if (param && typeof param === 'object' && 'value' in param) {
		return (param as { value: string }).value;
	}
	return '';
}

export async function getApps(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const response = await this.helpers.httpRequestWithAuthentication.call(this, 'apperApi', {
		method: 'GET',
		url: 'https://api.apper.io/v1/meta/apps?limit=200',
		json: true,
	});

	const apps = (response.data ?? []) as Array<{ appId: string; label: string }>;

	const results = apps
		.filter((app) => !filter || app.label.toLowerCase().includes(filter.toLowerCase()))
		.map((app) => ({
			name: app.label,
			value: app.appId,
		}));

	return { results };
}

export async function getTables(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const appId = extractValue(this.getNodeParameter('appId', 0));

	if (!appId) {
		return { results: [] };
	}

	const response = await this.helpers.httpRequestWithAuthentication.call(this, 'apperApi', {
		method: 'GET',
		url: `https://api.apper.io/v1/meta/${appId}/tables`,
		json: true,
	});

	const tables = (response.data ?? []) as Array<{ name: string; label: string }>;

	const results = tables
		.filter((table) => !filter || table.label.toLowerCase().includes(filter.toLowerCase()))
		.map((table) => ({
			// Show the friendly label, but the VALUE must be the "name" field -
			// Apper's docs are explicit that "name" (not "label") is what's used in URLs.
			name: table.label,
			value: table.name,
		}));

	return { results };
}

// Powers the "Record ID" resourceLocator dropdown on Get/Update/Delete —
// searches by "Name" (per Apper's convention seen in the sample record
// data) so the picker shows a human-readable label instead of a raw Id.
export async function getRecords(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const appId = extractValue(this.getNodeParameter('appId', 0));
	const tableName = extractValue(this.getNodeParameter('tableName', 0));

	if (!appId || !tableName) {
		return { results: [] };
	}

	const body: IDataObject = {
		fields: ['Id', 'Name'],
		OrderBy: [{ FieldName: 'Id', SortType: 'Desc' }],
		PagingInfo: { Limit: 50 },
	};

	if (filter) {
		body.where = [{ fieldName: 'Name', operator: 'Contains', values: [filter] }];
	}

	const response = await this.helpers.httpRequestWithAuthentication.call(this, 'apperApi', {
		method: 'POST',
		url: `https://api.apper.io/v1/data/${appId}/tables/${tableName}`,
		body,
		json: true,
	});

	const records = (response.data ?? []) as Array<{ Id: string; Name?: string }>;

	return {
		results: records.map((record) => ({
			name: record.Name || record.Id,
			value: record.Id,
		})),
	};
}

interface ApperUser {
	id: string;
	name: string;
}


export async function getSearchValueOptions(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const appId = extractValue(this.getNodeParameter('appId', 0));
	const tableName = extractValue(this.getNodeParameter('tableName', 0));
	const searchField = this.getNodeParameter('searchField', 0) as string;

	if (!appId || !tableName || !searchField) {
		return { results: [] };
	}

	const fieldsResponse = await this.helpers.httpRequestWithAuthentication.call(this, 'apperApi', {
		method: 'GET',
		url: `https://api.apper.io/v1/meta/${appId}/tables/${tableName}/fields`,
		json: true,
	});

	const fields = (fieldsResponse?.data ?? []) as Array<{
		name: string;
		type: string;
		options?: string[] | null;
		foreignKeyTableName?: string | null;
	}>;

	const field = fields.find((f) => f.name === searchField);
	if (!field) {
		return { results: [] };
	}

	if (['Picklist', 'Select', 'Dropdown', 'MultiSelect', 'MultiPicklist'].includes(field.type)) {
		const options = field.options ?? [];
		const filtered = filter
			? options.filter((opt) => opt.toLowerCase().includes(filter.toLowerCase()))
			: options;
		return { results: filtered.map((opt) => ({ name: opt, value: opt })) };
	}

	if (field.type === 'People') {
		const usersResponse = await this.helpers.httpRequestWithAuthentication.call(this, 'apperApi', {
			method: 'POST',
			url: `https://api.apper.io/v1/data/${appId}/users`,
			body: {},
			json: true,
		});

		const users = (usersResponse?.data ?? []) as ApperUser[];
		const filtered = filter
			? users.filter((u) => (u.name ?? '').toLowerCase().includes(filter.toLowerCase()))
			: users;
		return {
			results: filtered.map((u) => ({ name: (u.name ?? u.id).trim(), value: u.id })),
		};
	}

	if (field.type === 'Lookup' && field.foreignKeyTableName) {
		const recordsResponse = await this.helpers.httpRequestWithAuthentication.call(
			this,
			'apperApi',
			{
				method: 'POST',
				url: `https://api.apper.io/v1/data/${appId}/tables/${field.foreignKeyTableName}`,
				body: {
					fields: ['Id', 'Name'],
					OrderBy: [{ FieldName: 'Id', SortType: 'Desc' }],
					PagingInfo: { Limit: 100 },
				},
				json: true,
			},
		);

		const records = (recordsResponse?.data ?? []) as Array<{ Id: string; Name?: string }>;
		const filtered = filter
			? records.filter((r) => (r.Name ?? '').toLowerCase().includes(filter.toLowerCase()))
			: records;

		return {
			results: filtered.map((r) => ({ name: r.Name || r.Id, value: r.Id })),
		};
	}

	// Number, Text, Boolean, Date, etc. - no dropdown applies; the user
	// should use the "ID"/free-text mode of this field instead.
	return { results: [] };
}