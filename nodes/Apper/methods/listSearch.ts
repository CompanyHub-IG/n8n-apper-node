import type { ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';

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