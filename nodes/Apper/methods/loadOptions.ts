import type { ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';

function extractValue(param: unknown): string {
	if (typeof param === 'string') return param;
	if (param && typeof param === 'object' && 'value' in param) {
		return (param as { value: string }).value;
	}
	return '';
}

// Powers the "Search Field" dropdown on the Search operation — same
// meta/.../fields endpoint used by resourceMapping.ts's getTableFields,
// just returned as simple { name, value } options instead of a
// ResourceMapperFields schema.
export async function getSearchableFields(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const appId = extractValue(this.getNodeParameter('appId', 0));
	const tableName = extractValue(this.getNodeParameter('tableName', 0));

	if (!appId || !tableName) {
		return [];
	}

	const response = await this.helpers.httpRequestWithAuthentication.call(this, 'apperApi', {
		method: 'GET',
		url: `https://api.apper.io/v1/meta/${appId}/tables/${tableName}/fields`,
		json: true,
	});

	const apperFields = (response.data ?? []) as Array<{ name: string; label: string }>;

	return apperFields.map((field) => ({
		name: field.label,
		value: field.name,
	}));
}