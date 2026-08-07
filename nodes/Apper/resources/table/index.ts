import type { INodeProperties } from 'n8n-workflow';
import { tableGetManyDescription } from './getAll';

const showOnlyForTables = {
	resource: ['table'],
};

export const tableDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForTables,
		},
		options: [
			{
				name: 'List',
				value: 'list',
				action: 'List tables',
				description: 'List all tables in an app',
				routing: {
					request: {
						method: 'GET',
						url: '=/meta/{{$parameter["appId"]}}/tables',
					},
					output: {
						postReceive: [
							{
								type: 'rootProperty',
								properties: {
									property: 'data',
								},
							},
						],
					},
				},
			},
		],
		default: 'list',
	},
	...tableGetManyDescription,
];