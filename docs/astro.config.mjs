import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightTypeDoc, { typeDocSidebarGroup } from 'starlight-typedoc';

export default defineConfig({
	site: 'https://guard-core.github.io',
	base: '/guard-core-ts',
	integrations: [
		starlight({
			title: '@guardcore',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/Guard-Core/guard-core-ts' }],
			plugins: [
				starlightTypeDoc({
					entryPoints: [
						'../packages/core/src/index.ts',
						'../packages/express/src/index.ts',
						'../packages/fastify/src/index.ts',
						'../packages/hono/src/index.ts',
						'../packages/nestjs/src/index.ts',
					],
					tsconfig: '../tsconfig.typedoc.json',
					output: 'api',
					sidebar: {
						label: 'API Reference',
						collapsed: true,
					},
					typeDoc: {
						excludePrivate: true,
						excludeInternal: true,
					},
				}),
			],
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						{ label: 'Introduction', slug: 'getting-started/introduction' },
						{ label: 'Installation', slug: 'getting-started/installation' },
						{ label: 'Quick Start', slug: 'getting-started/quick-start' },
					{ label: 'Examples', slug: 'getting-started/examples' },
					],
				},
				{
					label: 'Configuration',
					items: [
						{ label: 'SecurityConfig', slug: 'configuration/security-config' },
						{ label: 'Security Headers', slug: 'configuration/security-headers' },
						{ label: 'Rate Limiting', slug: 'configuration/rate-limiting' },
						{ label: 'Detection Engine', slug: 'configuration/detection-engine' },
					],
				},
				{
					label: 'Adapters',
					items: [
						{ label: 'Express', slug: 'adapters/express' },
						{ label: 'Fastify', slug: 'adapters/fastify' },
						{ label: 'NestJS', slug: 'adapters/nestjs' },
						{ label: 'Hono', slug: 'adapters/hono' },
					],
				},
				{
					label: 'Decorators',
					items: [
						{ label: 'Overview', slug: 'decorators/overview' },
						{ label: 'Access Control', slug: 'decorators/access-control' },
						{ label: 'Authentication', slug: 'decorators/authentication' },
						{ label: 'Rate Limiting', slug: 'decorators/rate-limiting' },
						{ label: 'Behavioral', slug: 'decorators/behavioral' },
						{ label: 'Content Filtering', slug: 'decorators/content-filtering' },
						{ label: 'Advanced', slug: 'decorators/advanced' },
					],
				},
				{
					label: 'Architecture',
					items: [
						{ label: 'Overview', slug: 'architecture/overview' },
						{ label: 'Security Pipeline', slug: 'architecture/security-pipeline' },
						{ label: 'Protocols', slug: 'architecture/protocols' },
						{ label: 'Handlers', slug: 'architecture/handlers' },
					],
				},
				{
					label: 'Reference',
					autogenerate: { directory: 'reference' },
				},
				typeDocSidebarGroup,
			],
		}),
	],
});
