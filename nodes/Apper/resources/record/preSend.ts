import type {
	IExecuteSingleFunctions,
	IHttpRequestOptions,
	IN8nHttpFullResponse,
	INodeExecutionData,
	IDataObject,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

interface ResourceMapperValue {
	value: Record<string, unknown> | null;
	schema: Array<{ id: string; type?: string; apperType?: string }>;
}

interface ApperFieldMeta {
	name: string;
	type: string;
}

function extractValue(param: unknown): string {
	if (typeof param === 'string') return param;
	if (param && typeof param === 'object' && 'value' in param) {
		return (param as { value: string }).value;
	}
	return '';
}

async function fetchTableFields(
	this: IExecuteSingleFunctions,
	appId: string,
	tableName: string,
): Promise<ApperFieldMeta[]> {
	const response = (await this.helpers.httpRequestWithAuthentication.call(this, 'apperApi', {
		method: 'GET',
		url: `https://api.apper.io/v1/meta/${appId}/tables/${tableName}/fields`,
		json: true,
	})) as IDataObject;

	return (response?.data as ApperFieldMeta[] | undefined) ?? [];
}

function castFields(
	rawValues: Record<string, unknown>,
	schema: Array<{ id: string; type?: string; apperType?: string }>,
): Record<string, unknown> {
	const casted: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(rawValues)) {
		if (value === '' || value === null || value === undefined) {
			continue;
		}

		const fieldDef = schema.find((f) => f.id === key);

		if (fieldDef?.apperType === 'People') {   
			casted[key] = [{ "User": String(value) }];
		} else if (fieldDef?.type === 'number') {
			casted[key] = Number(value);
		} else if (fieldDef?.type === 'boolean' && typeof value === 'string') {
			casted[key] = value.toLowerCase() === 'true';
		} else {
			casted[key] = value;
		}   
	}

	return casted;
}

export async function castRecordFieldTypes(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const columns = this.getNodeParameter('columns') as ResourceMapperValue;
	const rawValues = columns?.value ?? {};
	const schema = columns?.schema ?? [];

	requestOptions.body = { records: [castFields(rawValues, schema)] };

	return requestOptions;
}

export async function castUpdateRecordFieldTypes(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const recordId = extractValue(this.getNodeParameter('recordId'));
	const columns = this.getNodeParameter('columns') as ResourceMapperValue;
	const rawValues = columns?.value ?? {};
	const schema = columns?.schema ?? [];

	requestOptions.body = {
		records: [{ Id: recordId, ...castFields(rawValues, schema) }],
	};

	return requestOptions;
}

export async function buildDeleteRecordBody(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const recordId = extractValue(this.getNodeParameter('recordId'));

	requestOptions.body = { recordIds: [recordId] };

	return requestOptions;
}       

interface RecordLineItem {
	columns?: ResourceMapperValue;
}

interface UpdateLineItem {
	recordId?: string;
	columns?: ResourceMapperValue;
}

export async function buildCreateManyBody(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const collection = this.getNodeParameter('recordsToCreate') as {
		record?: RecordLineItem[];
	};
	const items = collection?.record ?? [];

	if (items.length === 0) {
		throw new NodeOperationError(this.getNode(), 'Add at least one record to create.');
	}

	const records = items.map((item) => {
		const rawValues = item.columns?.value ?? {};
		const schema = item.columns?.schema ?? [];
		return castFields(rawValues, schema);
	});

	requestOptions.body = { records };

	return requestOptions;
}

export async function buildUpdateManyBody(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const collection = this.getNodeParameter('recordsToUpdate') as {
		record?: UpdateLineItem[];
	};
	const items = collection?.record ?? [];

	if (items.length === 0) {
		throw new NodeOperationError(this.getNode(), 'Add at least one record to update.');
	}

	const records = items.map((item) => {
		if (!item.recordId) {
			throw new NodeOperationError(this.getNode(), 'Each record must have a Record ID.');
		}
		const rawValues = item.columns?.value ?? {};
		const schema = item.columns?.schema ?? [];
		return { Id: item.recordId, ...castFields(rawValues, schema) };
	});

	requestOptions.body = { records };

	return requestOptions;
}

export async function buildDeleteManyBody(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const raw = this.getNodeParameter('recordIdsList') as string;
	const recordIds = raw
		.split(',')
		.map((id) => id.trim())
		.filter((id) => id.length > 0);

	if (recordIds.length === 0) {
		throw new NodeOperationError(this.getNode(), 'At least one record ID is required.');
	}

	requestOptions.body = { recordIds };

	return requestOptions;
}

export async function buildGetRecordBody(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const appId = extractValue(this.getNodeParameter('appId'));
	const tableName = extractValue(this.getNodeParameter('tableName'));

	const fields = await fetchTableFields.call(this, appId, tableName);
	const fieldNames = fields.map((f) => f.name);
	fieldNames.push('createdOn', 'modifiedOn');

	requestOptions.body = { fields: fieldNames };

	return requestOptions;
}

export async function buildSearchRecordBody(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const appId = extractValue(this.getNodeParameter('appId'));
	const tableName = extractValue(this.getNodeParameter('tableName'));
	const searchField = this.getNodeParameter('searchField') as string;
	const rawValue = this.getNodeParameter('searchValue');

	if (!searchField || rawValue === undefined || rawValue === '') {
		throw new NodeOperationError(
			this.getNode(),
			'Both "Search Field" and "Value" are required.',
		);
	}

	const fields = await fetchTableFields.call(this, appId, tableName);
	const fieldNames = fields.map((f) => f.name);
	fieldNames.push('createdOn', 'modifiedOn');

	const selectedField = fields.find((f) => f.name === searchField);
	if (!selectedField) {
		throw new NodeOperationError(
			this.getNode(),
			`"${searchField}" is not a valid field name for this table. Available fields: ${fields
				.map((f) => f.name)
				.join(', ')}`,
		);
	}

	let castValue: unknown;
	switch (selectedField.type) {
		case 'Number':
		case 'Integer':
		case 'Decimal':
			castValue = Number(rawValue);
			if (Number.isNaN(castValue)) {
				throw new NodeOperationError(
					this.getNode(),
					`Value "${rawValue}" is not a valid number for field "${searchField}".`,
				);
			}
			break;
		case 'Boolean':
		case 'Bool':
			castValue = rawValue === true || rawValue === 'true' || rawValue === '1' || rawValue === 1;
			break;
		default:
			castValue = rawValue;
	}

	requestOptions.body = {
		fields: fieldNames,
		where: [{ fieldName: searchField, operator: 'ExactMatch', values: [castValue] }],
		OrderBy: [{ FieldName: 'CreatedOn', SortType: 'Desc' }],
		PagingInfo: { Limit: 100 },
	};

	return requestOptions;
}

export async function checkRecordOperationResult(
	this: IExecuteSingleFunctions,
	data: INodeExecutionData[],
	response: IN8nHttpFullResponse,
): Promise<INodeExecutionData[]> {
	const body = response.body as IDataObject;
	const results = body?.results as IDataObject[] | undefined;

	if (!results || !Array.isArray(results) || results.length === 0) {
		throw new NodeApiError(this.getNode(), body as JsonObject, {
			message: 'Apper API did not return a valid result for the operation.',
		});
	}

	const result = results[0];

	if (result.success === false) {
		const errors = result.errors as
			| Array<{ message?: string; fieldLabel?: string; fieldName?: string }>
			| undefined;
		const message =
			(result.message as string) ||
			(errors && errors.length > 0
				? errors.map((e) => e.message || `${e.fieldLabel || e.fieldName}: Invalid value`).join('; ')
				: 'Failed to perform the operation on the record.');

		throw new NodeApiError(this.getNode(), body as JsonObject, { message });
	}

	return [{ json: result }];
}

export async function checkCreateRecordsResult(
	this: IExecuteSingleFunctions,
	data: INodeExecutionData[],
	response: IN8nHttpFullResponse,
): Promise<INodeExecutionData[]> {
	const body = response.body as IDataObject;
	const results = body?.results as IDataObject[] | undefined;

	if (!results || !Array.isArray(results) || results.length === 0) {
		throw new NodeApiError(this.getNode(), body as JsonObject, {
			message: 'Apper API did not return a valid result for the operation.',
		});
	}

	return results.map((result) => {
		const success = result.success !== false;

		if (success) {
			return { json: { success: true, ...(result.data as IDataObject) } };
		}

		const errors = result.errors as
			| Array<{ message?: string; fieldLabel?: string; fieldName?: string }>
			| undefined;
		const errorMessage =
			(result.message as string) ||
			(errors && errors.length > 0
				? errors.map((e) => e.message || `${e.fieldLabel || e.fieldName}: Invalid value`).join('; ')
				: 'Failed to perform the operation on the record.');

		return {
			json: {
				success: false,
				error: errorMessage,
				...(result.data as IDataObject),
			},
		};
	});
}

export async function checkGetRecordResult(
	this: IExecuteSingleFunctions,
	data: INodeExecutionData[],
	response: IN8nHttpFullResponse,
): Promise<INodeExecutionData[]> {
	const body = response.body as IDataObject;
	const record = body?.data as IDataObject | undefined;

	if (!record) {
		throw new NodeApiError(this.getNode(), body as JsonObject, {
			message: 'Apper API did not return a valid record.',
		});
	}

	return [{ json: record }];
}

export async function checkSearchRecordResult(
	this: IExecuteSingleFunctions,
	data: INodeExecutionData[],
	response: IN8nHttpFullResponse,
): Promise<INodeExecutionData[]> {
	const body = response.body as IDataObject;
	const records = body?.data;

	if (!records) {
		throw new NodeApiError(this.getNode(), body as JsonObject, {
			message: 'Apper API did not return a valid search result.',
		});
	}

	if (!Array.isArray(records)) {
		return [];
	}

	return (records as IDataObject[]).map((record) => ({ json: record }));
}