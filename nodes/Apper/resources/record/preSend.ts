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

// Shared by Get Record By ID and Search Record — both need the table's
// field metadata before they can build their actual request body, mirroring
// the two-call pattern from the Zapier integration.
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

// Update: PUT .../records, body { records: [{ Id, ...fields }] }.
// Apper requires "Id" capitalized. Apper's records endpoints accept it as
// a string, not an integer.
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
// Delete: POST .../records/delete, body { recordIds: [...] }.
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

// Create Many: one fixedCollection row per record, each using the same
// "Columns" resourceMapper UI as single Create.
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

// Update Many: one fixedCollection row per record, each with its own
// Record ID plus the same "Columns" resourceMapper UI as single Update.
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

// Delete Many: same endpoint/shape as single Delete, just a longer
// recordIds array built from a comma-separated string field.
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

// Get Record By ID: mirrors the Zapier action exactly — fetch the table's
// field metadata first, then request the record with an explicit "fields"
// list (Apper's get-by-id endpoint requires this rather than returning
// everything by default).
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

// Search Record: mirrors the Zapier action — fetch field metadata to find
// the selected search field's real type, cast the search value to match
// (number/boolean/string), then build the where-clause search body.
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
		OrderBy: [{ FieldName: 'Id', SortType: 'Desc' }],
		PagingInfo: { Limit: 100 },
	};

	return requestOptions;
}

// Apper's bulk-style endpoints (single Update/Delete) can return HTTP 200
// even when the individual record operation failed — success/failure lives
// in results[0].success, with details in results[0].errors. This mirrors
// the handleResponse/buildResultErrorMessage logic from the Zapier
// integration so n8n surfaces the same field-level error messages instead
// of a silently failed record under a "200 OK".
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

// Create / Create Many / Update Many / Delete Many: response has a
// "results" array with one entry per record, each carrying its own success
// flag — a batch of 5 can have 4 succeed and 1 fail with a DB-level error
// like Apper's "lastval is not yet defined in this session". The
// declarative rootProperty postReceive doesn't inspect success at all, so a
// failed record would silently come back as normal-looking output. This
// checks every item and throws if any failed, returning each record's
// "data" as a separate output item on success.
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

	const failed = results.filter((r) => r.success === false);

	if (failed.length > 0) {
		const message = failed
			.map((r) => (r.message as string) || 'Failed to create the record.')
			.join('; ');
		throw new NodeApiError(this.getNode(), body as JsonObject, { message });
	}

	return results.map((r) => ({ json: (r.data as IDataObject) ?? r }));
}

// Get Record By ID: response is a single object under "data".
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

// Search Record: response is an array under "data" — return no items
// rather than an error when nothing matches, matching the Zapier action.
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