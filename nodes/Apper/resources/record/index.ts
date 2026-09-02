import type { INodeProperties } from 'n8n-workflow';
import {
	castRecordFieldTypes,
	castUpdateRecordFieldTypes,
	buildDeleteRecordBody,
	buildCreateManyBody,
	buildUpdateManyBody,
	buildDeleteManyBody,
	buildGetRecordBody,
	buildSearchRecordBody,
	checkRecordOperationResult,
	checkCreateRecordsResult,
	checkGetRecordResult,
	checkSearchRecordResult,
} from './preSend';

const showOnlyForRecords = {
	resource: ['record'],
};

const showOnlyForRecordCreate = {
	resource: ['record'],
	operation: ['create'],
};
    
const showOnlyForRecordUpdate = {
	resource: ['record'],
	operation: ['update'],
};

const showOnlyForRecordId = {
	resource: ['record'],
	operation: ['update', 'delete', 'get'],
};

const showOnlyForRecordSearch = {
	resource: ['record'],
	operation: ['search'],
};

const showOnlyForRecordCreateMany = {
	resource: ['record'],
	operation: ['createMany'],
};

const showOnlyForRecordUpdateMany = {
	resource: ['record'],
	operation: ['updateMany'],
};

const showOnlyForRecordDeleteMany = {
	resource: ['record'],
	operation: ['deleteMany'],
};

export const recordDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForRecords,
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create a record',
				description: 'Create a record in a table',
				routing: {
					send: {
						preSend: [castRecordFieldTypes],
					},
					request: {
						method: 'POST',
						url: '=/data/{{$parameter["appId"]}}/tables/{{$parameter["tableName"]}}/records',
					},
					output: {
						postReceive: [checkRecordOperationResult],
					},
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a record',
				description: 'Retrieve a single record by ID',
				routing: {
					send: {
						preSend: [buildGetRecordBody],
					},
					request: {
						method: 'POST',
						url: '=/data/{{$parameter["appId"]}}/tables/{{$parameter["tableName"]}}/{{$parameter["recordId"]}}',
					},
					output: {
						postReceive: [checkGetRecordResult],
					},
				},
			},
			{
				name: 'Search',
				value: 'search',
				action: 'Search for a record',
				description: 'Search a table for records matching a field value',
				routing: {
					send: {
						preSend: [buildSearchRecordBody],
					},
					request: {
						method: 'POST',
						url: '=/data/{{$parameter["appId"]}}/tables/{{$parameter["tableName"]}}',
					},
					output: {
						postReceive: [checkSearchRecordResult],
					},
				},
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a record',
				description: 'Update a record in a table',
				routing: {
					send: {
						preSend: [castUpdateRecordFieldTypes],
					},
					request: {
						method: 'PUT',
						url: '=/data/{{$parameter["appId"]}}/tables/{{$parameter["tableName"]}}/records',
					},
					output: {
						postReceive: [checkRecordOperationResult],
					},
				},
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a record',
				description: 'Delete a record from a table',
				routing: {
					send: {
						preSend: [buildDeleteRecordBody],
					},
					request: {
						method: 'POST',
						url: '=/data/{{$parameter["appId"]}}/tables/{{$parameter["tableName"]}}/records/delete',
					},
					output: {
						postReceive: [checkRecordOperationResult],
					},
				},
			},
			{
				name: 'Create Multiple Records',
				value: 'createMany',
				action: 'Create multiple records',
				description: 'Create multiple records in a table in one call',
				routing: {
					send: {
						preSend: [buildCreateManyBody],
					},
					request: {
						method: 'POST',
						url: '=/data/{{$parameter["appId"]}}/tables/{{$parameter["tableName"]}}/records',
					},
					output: {
						postReceive: [checkCreateRecordsResult],
					},
				},
			},
			{
				name: 'Update Multiple Records',
				value: 'updateMany',
				action: 'Update multiple records',
				description: 'Update multiple records in a table in one call',
				routing: {
					send: {
						preSend: [buildUpdateManyBody],
					},
					request: {
						method: 'PUT',
						url: '=/data/{{$parameter["appId"]}}/tables/{{$parameter["tableName"]}}/records',
					},
					output: {
						postReceive: [checkCreateRecordsResult],
					},
				},
			},
			{
				name: 'Delete Multiple Records',
				value: 'deleteMany',
				action: 'Delete multiple records',
				description: 'Delete multiple records from a table in one call',
				routing: {
					send: {
						preSend: [buildDeleteManyBody],
					},
					request: {
						method: 'POST',
						url: '=/data/{{$parameter["appId"]}}/tables/{{$parameter["tableName"]}}/records/delete',
					},
					output: {
						postReceive: [checkCreateRecordsResult],
					},
				},
			},
		],
		default: 'create',
	},
	{
		displayName: 'App',
		name: 'appId',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		displayOptions: {
			show: showOnlyForRecords,
		},
		description: 'The app the table belongs to',
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
	{
		displayName: 'Table',
		name: 'tableName',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		displayOptions: {
			show: showOnlyForRecords,
		},
		description: 'The table to create a record in',
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: {
					searchListMethod: 'getTables',
					searchable: true,
				},
			},
			{
				displayName: 'Name',
				name: 'id',
				type: 'string',
				placeholder: 'e.g. customer',
			},
		],
	},
		{
		displayName: 'Record',
		name: 'recordId',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		displayOptions: {
			show: showOnlyForRecordId,
		},
		description: 'The record to get, update, or delete',
		typeOptions: {
			loadOptionsDependsOn: ['tableName.value'],
		},
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: {
					searchListMethod: 'getRecords',
					searchable: true,
				},
			},
			{
				displayName: 'ID',
				name: 'id',
				type: 'string',
				placeholder: 'e.g. 7088e546-6b22-4e28-a5ce-d5b898ea7a82',
			},
		],
	},
	{
		displayName: 'Search Field Name or ID',
		name: 'searchField',
		type: 'options',
		default: '',
		required: true,
		displayOptions: {
			show: showOnlyForRecordSearch,
		},
		typeOptions: {
			loadOptionsDependsOn: ['tableName.value'],
			loadOptionsMethod: 'getSearchableFields',
		},
		description:
			'Field to search by (exact match). Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Value',
		name: 'searchValue',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: showOnlyForRecordSearch,
		},
		description: 'Value to match against the search field',
	},
	{
		displayName: 'Columns',
		name: 'columns',
		type: 'resourceMapper',
		default: {
			mappingMode: 'defineBelow',
			value: null,
		},
		noDataExpression: true,
		required: true,
		displayOptions: {
			show: showOnlyForRecordCreate,
		},
		typeOptions: {
			loadOptionsDependsOn: ['tableName.value'],
			resourceMapper: {
				resourceMapperMethod: 'getTableFields',
				mode: 'add',
				fieldWords: {
					singular: 'field',
					plural: 'fields',
				},
				addAllFields: true,
			},
		},
	},
	{
		displayName: 'Columns',
		name: 'columns',
		type: 'resourceMapper',
		default: {
			mappingMode: 'defineBelow',
			value: null,
		},
		noDataExpression: true,
		required: true,
		displayOptions: {
			show: showOnlyForRecordUpdate,
		},
		typeOptions: {
			loadOptionsDependsOn: ['tableName.value'],
			resourceMapper: {
				resourceMapperMethod: 'getTableFields',
				mode: 'add',
				fieldWords: {
					singular: 'field',
					plural: 'fields',
				},
				addAllFields: false,
			},
		},
	},
	{
		displayName: 'Records',
		name: 'recordsToCreate',
		type: 'fixedCollection',
		default: {},
		required: true,
		displayOptions: {
			show: showOnlyForRecordCreateMany,
		},
		typeOptions: {
			multipleValues: true,
		},
		placeholder: 'Add Record',
		options: [
			{
				name: 'record',
				displayName: 'Record',
				values: [
					{
						displayName: 'Columns',
						name: 'columns',
						type: 'resourceMapper',
						default: {
							mappingMode: 'defineBelow',
							value: null,
						},
						noDataExpression: true,
						required: true,
						typeOptions: {
							loadOptionsDependsOn: ['tableName.value'],
							resourceMapper: {
								resourceMapperMethod: 'getTableFields',
								mode: 'add',
								fieldWords: {
									singular: 'field',
									plural: 'fields',
								},
								addAllFields: true,
							},
						},
					},
				],
			},
		],
	},
	{
		displayName: 'Records',
		name: 'recordsToUpdate',
		type: 'fixedCollection',
		default: {},
		required: true,
		displayOptions: {
			show: showOnlyForRecordUpdateMany,
		},
		typeOptions: {
			multipleValues: true,
		},
		placeholder: 'Add Record',
		options: [
			{
				name: 'record',
				displayName: 'Record',
				values: [
					{
						displayName: 'Record ID',
						name: 'recordId',
						type: 'string',
						default: '',
						required: true,
						description: 'The ID of the record to update',
					},
					{
						displayName: 'Columns',
						name: 'columns',
						type: 'resourceMapper',
						default: {
							mappingMode: 'defineBelow',
							value: null,
						},
						noDataExpression: true,
						required: true,
						typeOptions: {
							loadOptionsDependsOn: ['tableName.value'],
							resourceMapper: {
								resourceMapperMethod: 'getTableFields',
								mode: 'add',
								fieldWords: {
									singular: 'field',
									plural: 'fields',
								},
								addAllFields: false,
							},
						},
					},
				],
			},
		],
	},
	{
		displayName: 'Record IDs',
		name: 'recordIdsList',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: showOnlyForRecordDeleteMany,
		},
		description: 'Comma-separated list of record IDs to delete, e.g. 2aadd83d-d0d0-4e4a-af93-21685c1fbbae, 17c6bc1f-877c-4f2a-8027-62706ae8710a',
	},
];