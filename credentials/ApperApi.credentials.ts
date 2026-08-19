import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class ApperApi implements ICredentialType {
	name = 'apperApi';
	icon = { light: 'file:../nodes/Apper/apper.svg', dark: 'file:../nodes/Apper/apper.dark.svg' } as const;
	displayName = 'Apper API';

	// Link to your community node's README
	documentationUrl = 'https://github.com/CompanyHub-IG/n8n-apper-node?tab=readme-ov-file#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'Authorization': '={{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.apper.io/v1',
			url: '/auth/me',
		},
	};
}
