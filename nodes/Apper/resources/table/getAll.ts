import type { INodeProperties } from 'n8n-workflow';

const showOnlyForTableList = {
	operation: ['list'],
	resource: ['table'],
};

export const tableGetManyDescription: INodeProperties[] = [
	{
		displayName: 'App ID',
		name: 'appId',
		type: 'string',
		displayOptions: {
			show: showOnlyForTableList,
		},
		default: '',
		required: true,
		description: 'The app to list tables for. Use the App > List operation to find this.',
	},
];