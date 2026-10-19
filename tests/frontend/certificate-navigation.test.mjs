import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../../', import.meta.url));

// Render real page and navigation content with browser context and UI shells mocked.
async function renderComponent(path, exportName, role, props = {}) {
    const { build } = await import('esbuild');
    const result = await build({
        entryPoints: [root + path],
        bundle: true,
        write: false,
        format: 'cjs',
        platform: 'node',
        packages: 'external',
        plugins: [
            {
                name: 'server-render-context',
                setup(builder) {
                    builder.onResolve({ filter: /^lucide-react$/ }, () => ({
                        path: 'icons',
                        namespace: 'mock',
                    }));
                    builder.onResolve({ filter: /^react$/ }, () => ({
                        path: 'react',
                        external: true,
                    }));
                    builder.onResolve(
                        { filter: /^@inertiajs\/react$/ },
                        () => ({ path: 'inertia', namespace: 'mock' }),
                    );
                    builder.onResolve(
                        { filter: /^@\/layouts\/app-layout$/ },
                        () => ({ path: 'layout', namespace: 'mock' }),
                    );
                    builder.onResolve(
                        {
                            filter: /^@\/components\/(ui\/sidebar|nav-user|nav-footer)$/,
                        },
                        (args) => ({ path: args.path, namespace: 'mock' }),
                    );
                    builder.onLoad(
                        { filter: /.*/, namespace: 'mock' },
                        (args) => {
                            const prelude =
                                'const React = require("react"); const wrapper = ({children}) => React.createElement("div", null, children);';
                            if (args.path === 'icons') {
                                return {
                                    contents:
                                        prelude +
                                        ['Award', 'FileCheck', 'Mail', 'Plus']
                                            .map(
                                                (name) =>
                                                    `exports.${name} = () => null;`,
                                            )
                                            .join(''),
                                };
                            }
                            if (args.path === 'inertia') {
                                return {
                                    contents: `${prelude}
                        exports.usePage = () => ({url: '/certificates', props: {auth: {user: {name: 'Operator', role: ${JSON.stringify(role)}}}}});
                        exports.Head = () => null;
                        exports.Link = ({href, children}) => React.createElement('a', {href: typeof href === 'string' ? href : href.url}, children);`,
                                };
                            }
                            if (args.path === 'layout')
                                return {
                                    contents: `${prelude} module.exports = wrapper;`,
                                };
                            const names = args.path.endsWith('sidebar')
                                ? [
                                      'Sidebar',
                                      'SidebarContent',
                                      'SidebarFooter',
                                      'SidebarHeader',
                                      'SidebarMenu',
                                      'SidebarMenuButton',
                                      'SidebarMenuItem',
                                      'SidebarGroup',
                                      'SidebarGroupLabel',
                                  ]
                                : [
                                      args.path.endsWith('nav-user')
                                          ? 'NavUser'
                                          : 'NavFooter',
                                  ];
                            return {
                                contents:
                                    prelude +
                                    names
                                        .map(
                                            (name) =>
                                                `exports.${name} = wrapper;`,
                                        )
                                        .join(''),
                            };
                        },
                    );
                },
            },
        ],
    });
    const module = { exports: {} };
    new Function('require', 'module', 'exports', result.outputFiles[0].text)(
        require,
        module,
        module.exports,
    );
    return renderToStaticMarkup(
        React.createElement(module.exports[exportName], props),
    );
}

for (const role of ['admin', 'pimpinan', 'pengaju']) {
    test(`certificate navigation for ${role} hides unrelated modules`, async () => {
        const html = await renderComponent(
            'resources/js/components/app-sidebar.tsx',
            'AppSidebar',
            role,
        );
        assert.doesNotMatch(
            html,
            /href="\/(documents|users|settings|dashboard)/,
        );
        if (role !== 'pengaju') {
            assert.match(html, /href="\/templates"/);
            assert.match(html, /href="\/certificates"/);
        } else {
            assert.doesNotMatch(html, /Template Sertifikat/);
        }
    });
}

test('landing page presents only certificate actions and statistics', async () => {
    const html = await renderComponent(
        'resources/js/pages/dashboard.tsx',
        'default',
        'admin',
        {
            user: { name: 'Operator', role: 'admin' },
            stats: { total_templates: 3, total_certificates: 125 },
        },
    );
    assert.match(html, /Cetak Sertifikat Massal/);
    assert.match(html, /Sertifikat dan Kirim Massal/);
    assert.match(html, /href="\/certificates\/bulk\/create"/);
    assert.match(html, /125/);
    assert.doesNotMatch(
        html,
        /Dokumen|Review|href="\/(documents|users|settings)/,
    );
});

test('restricted role sees access guidance without certificate actions', async () => {
    const html = await renderComponent(
        'resources/js/pages/dashboard.tsx',
        'default',
        'pengaju',
        {
            user: { name: 'Pengaju', role: 'pengaju' },
            stats: {},
        },
    );
    assert.match(html, /Hubungi administrator/);
    assert.doesNotMatch(html, /href=/);
});
