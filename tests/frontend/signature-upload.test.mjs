import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../../', import.meta.url));

test('build exclusions keep private uploads and local dependencies out of the context', () => {
    const ignore = require('ignore');
    const context = ignore().add(readFileSync(root + '.dockerignore', 'utf8'));
    for (const path of [
        'storage/app/private/signatures/stamp.png',
        'storage/logs/laravel.log',
        '.env',
        '.env copy',
        '.env-copy',
        'vendor/autoload.php',
        'node_modules/react/index.js',
        'public/storage/signatures/stamp.png',
    ]) {
        assert.equal(context.ignores(path), true, path);
    }
    for (const path of [
        'Dockerfile',
        'compose.yaml',
        'composer.json',
        'package-lock.json',
        'app/Providers/AppServiceProvider.php',
        'resources/js/app.tsx',
        '.env.example',
    ]) {
        assert.equal(context.ignores(path), false, path);
    }
});

async function renderViewer(signatureImage, canEdit = true) {
    const result = await build({
        entryPoints: [root + 'resources/js/components/PDFCanvasViewer.tsx'],
        bundle: true,
        write: false,
        format: 'cjs',
        platform: 'node',
        packages: 'external',
        plugins: [
            {
                name: 'render-signing-controls',
                setup(builder) {
                    builder.onResolve({ filter: /^react$/ }, () => ({
                        path: 'react',
                        external: true,
                    }));
                    builder.onResolve(
                        {
                            filter: /^(@inertiajs\/react|lucide-react|input-otp|@\/components\/ui\/|@\/hooks\/)/,
                        },
                        (args) => ({ path: args.path, namespace: 'mock' }),
                    );
                    builder.onLoad(
                        { filter: /.*/, namespace: 'mock' },
                        (args) => {
                            const base = `const React = require('react'); const wrapper = ({children}) => React.createElement('div', null, children);`;
                            if (args.path === '@inertiajs/react')
                                return {
                                    contents: `exports.usePage = () => ({props: {auth: {user: {id: 1, signature_image: ${JSON.stringify(signatureImage)}}}}});`,
                                };
                            if (args.path.endsWith('use-toast'))
                                return {
                                    contents:
                                        'exports.useToast = () => ({error() {}, info() {}});',
                                };
                            if (args.path.endsWith('use-modal'))
                                return {
                                    contents:
                                        'exports.useModal = () => ({isOpen: false, open() {}, close() {}});',
                                };
                            if (args.path.endsWith('alert-modal'))
                                return {
                                    contents: 'module.exports = () => null;',
                                };
                            const names =
                                args.path === 'lucide-react'
                                    ? [
                                          'Check',
                                          'ChevronDown',
                                          'ChevronLeft',
                                          'ChevronRight',
                                          'ChevronUp',
                                          'Eraser',
                                          'Image',
                                          'PenTool',
                                          'QrCode',
                                          'Save',
                                          'Stamp',
                                          'Trash2',
                                          'X',
                                      ]
                                    : [
                                          'Button',
                                          'Input',
                                          'InputOTP',
                                          'InputOTPGroup',
                                          'InputOTPSlot',
                                          'Label',
                                          'Dialog',
                                          'DialogContent',
                                          'DialogDescription',
                                          'DialogFooter',
                                          'DialogHeader',
                                          'DialogTitle',
                                      ];
                            return {
                                contents:
                                    base +
                                    names
                                        .map(
                                            (name) =>
                                                `exports.${name} = wrapper;`,
                                        )
                                        .join('') +
                                    'exports.REGEXP_ONLY_DIGITS = "[0-9]";',
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
        React.createElement(module.exports.default, {
            pdfUrl: '/test.pdf',
            documentId: 'test',
            canEdit,
            onSave() {},
        }),
    );
}

for (const signatureImage of [null, '/saved-signature.png']) {
    test(`file picker is mounted before opening advanced tools, saved signature: ${Boolean(signatureImage)}`, async () => {
        const html = await renderViewer(signatureImage);
        assert.equal((html.match(/type="file"/g) || []).length, 1);
        assert.match(html, /Upload Stempel \/ Gambar/);
        assert.match(
            html,
            /aria-label="Pilih gambar tanda tangan atau stempel"/,
        );
        assert.doesNotMatch(html, /type="file"[^>]*disabled/);
    });
}

test('read-only viewer disables image selection', async () => {
    const html = await renderViewer(null, false);
    assert.match(html, /type="file"[^>]*disabled/);
    assert.doesNotMatch(html, /Upload Stempel \/ Gambar/);
});
