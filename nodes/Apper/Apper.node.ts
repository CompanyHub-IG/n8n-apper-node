import { NodeConnectionTypes, type INodeType, type INodeTypeDescription } from 'n8n-workflow';
import { recordDescription } from './resources/record';
import { getApps, getTables } from './methods/listSearch';
import { getTableFields } from './methods/resourceMapping';
import { getSearchableFields } from './methods/loadOptions';

export class Apper implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Apper',
		name: 'apper',
		icon: { light: 'file:apper.svg', dark: 'file:apper.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with the Apper API',
		defaults: {
			name: 'Apper',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'apperApi', required: true }],
		requestDefaults: {
			baseURL: 'https://api.apper.io/v1',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Record',
						value: 'record',
					},
				],
				default: 'record',
			},
			...recordDescription,
		],
	};

	methods = {
		listSearch: {
			getApps,
			getTables,
		},
		resourceMapping: {
			getTableFields,
		},
		loadOptions: {
			getSearchableFields,
		},
	};
}