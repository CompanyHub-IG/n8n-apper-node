import type { INodeProperties } from 'n8n-workflow';

const showOnlyForTableList = {
	operation: ['list'],
	resource: ['table'],
};

export const tableGetManyDescription: INodeProperties[] = [
	{
		displayName: 'App',
		name: 'appId',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		displayOptions: {
			show: showOnlyForTableList,
		},
		description: 'The app to list tables for',
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: {
					searchListMethod: 'getApps',
					searchable: true,
				},
			},
			{
				displayName: 'ID',
				name: 'id',
				type: 'string',
				placeholder: 'e.g. 8f505ab65c50482a838f1336511f00eb',
			},
		],
	},
];