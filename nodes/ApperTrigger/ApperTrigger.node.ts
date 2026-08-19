import {
	NodeConnectionTypes,
	type IDataObject,
	type ILoadOptionsFunctions,
	type INodeExecutionData,
	type INodeListSearchResult,
	type INodeType,
	type INodeTypeDescription,
	type IPollFunctions,
} from 'n8n-workflow';

function extractValue(param: unknown): string {
	if (typeof param === 'string') return param;
	if (param && typeof param === 'object' && 'value' in param) {
		return (param as { value: string }).value;
	}
	return '';
}

async function getApps(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const response = await this.helpers.httpRequestWithAuthentication.call(this, 'apperApi', {
		method: 'GET',
		url: 'https://api.apper.io/v1/meta/apps',
		json: true,
	});
	const apps = (response.data ?? []) as Array<{ appId: string; label: string }>;
	return {
		results: apps
			.filter((app) => !filter || app.label.toLowerCase().includes(filter.toLowerCase()))
			.map((app) => ({ name: app.label, value: app.appId })),
	};
}

async function getTables(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const appId = extractValue(this.getNodeParameter('appId', 0));
	if (!appId) return { results: [] };

	const response = await this.helpers.httpRequestWithAuthentication.call(this, 'apperApi', {
		method: 'GET',
		url: `https://api.apper.io/v1/meta/${appId}/tables`,
		json: true,
	});
	const tables = (response.data ?? []) as Array<{ name: string; label: string }>;
	return {
		results: tables
			.filter((table) => !filter || table.label.toLowerCase().includes(filter.toLowerCase()))
			.map((table) => ({ name: table.label, value: table.name })),
	};
}

export class ApperTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Apper Trigger',
		name: 'apperTrigger',
		icon: { light: 'file:../Apper/apper.svg', dark: 'file:../Apper/apper.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["event"]}}',
		description: 'Starts a workflow when a record is created or updated in Apper',
		defaults: { name: 'Apper Trigger' },
		usableAsTool: true,
		polling: true,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'apperApi', required: true }],
		properties: [
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'New Record', value: 'created' },
					{ name: 'Record Updated', value: 'updated' },
				],
				default: 'created',
			},
			{
				displayName: 'App',
				name: 'appId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				description: 'The app to watch',
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: { searchListMethod: 'getApps', searchable: true },
					},
					{
						displayName: 'ID',
						name: 'id',
						type: 'string',
						placeholder: 'e.g. 8f505ab65c50482a838f1336511f00eb',
					},
				],
			},
			{
				displayName: 'Table',
				name: 'tableName',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				description: 'The table to watch',
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: { searchListMethod: 'getTables', searchable: true },
					},
					{
						displayName: 'Name',
						name: 'id',
						type: 'string',
						placeholder: 'e.g. customer',
					},
				],
			},
		],
	};

	methods = {
		listSearch: {
			getApps,
			getTables,
		},
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const webhookData = this.getWorkflowStaticData('node');
		const appId = extractValue(this.getNodeParameter('appId'));
		const tableName = extractValue(this.getNodeParameter('tableName'));
		const event = this.getNodeParameter('event') as 'created' | 'updated';

		const dateField = event === 'created' ? 'CreatedOn' : 'ModifiedOn';
		const nowIso = new Date().toISOString();

		if (webhookData.lastTimeChecked === undefined && this.getMode() !== 'manual') {
			webhookData.lastTimeChecked = nowIso;
			return null;
		}

		const isManual = this.getMode() === 'manual';

		// Apper's "omit fields for all fields" behavior doesn't actually return
		// all fields in practice - only Id comes back unless you explicitly
		// list every column. So fetch the table's real schema first and pass
		// every field name in, guaranteeing full records instead of just Id.
		const fieldsResponse = await this.helpers.httpRequestWithAuthentication.call(
			this,
			'apperApi',
			{
				method: 'GET',
				url: `https://api.apper.io/v1/meta/${appId}/tables/${tableName}/fields`,
				json: true,
			},
		);
		const tableFields = (fieldsResponse.data ?? []) as Array<{ name: string }>;
		const fieldNames = tableFields.map((field) => field.name);
		// Id, CreatedOn, and ModifiedOn are system fields that don't show up
		// in the table's field list, but every record has them - add any
		// that are missing so the poll's date filtering and downstream
		// workflow steps always have access to them.
		for (const systemField of ['Id', 'CreatedOn', 'ModifiedOn']) {
			if (!fieldNames.includes(systemField)) {
				fieldNames.unshift(systemField);
			}
		}

		const body: IDataObject = isManual
			? {
					fields: fieldNames,
					orderBy: [{ fieldName: dateField, sortType: 'Desc' }],
					pagingInfo: { limit: 1, offset: 0 },
				}
			: {
					fields: fieldNames,
					where: [
						{
							fieldName: dateField,
							operator: 'GreaterThan',
							values: [webhookData.lastTimeChecked as string],
						},
					],
					orderBy: [{ fieldName: dateField, sortType: 'Asc' }],
					pagingInfo: { limit: 100, offset: 0 },
				};

		if (!isManual) {
			webhookData.lastTimeChecked = nowIso;
		}

		const response = await this.helpers.httpRequestWithAuthentication.call(this, 'apperApi', {
			method: 'POST',
			url: `https://api.apper.io/v1/data/${appId}/tables/${tableName}`,
			body,
			json: true,
		});

		const records = (response.data ?? []) as IDataObject[];

		if (!records.length) {
			return null;
		}

		return [this.helpers.returnJsonArray(records)];
	}
}