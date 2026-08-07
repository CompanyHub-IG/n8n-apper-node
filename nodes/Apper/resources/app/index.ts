import type { INodeProperties } from 'n8n-workflow';

const showOnlyForApps = {
	resource: ['app'],
};

export const appDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForApps,
		},
		options: [
			{
				name: 'List',
				value: 'list',
				action: 'List apps',
				description: 'List all apps accessible to the authenticated user',
				routing: {
					request: {
						method: 'GET',
						url: '/meta/apps',
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
];