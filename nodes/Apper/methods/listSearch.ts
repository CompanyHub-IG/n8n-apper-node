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