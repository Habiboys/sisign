import assert from 'node:assert/strict';
import test from 'node:test';
import { textBounds, drawCertificateVariables, previewText, prepareCertificateMapping, gradientVector } from '../../resources/js/lib/certificate-mapping.ts';

function context() {
    const calls = [];
    const alphas = [];
    const gradients = [];
    const ctx = { canvas: { width: 900, height: 600 }, measureText: text => ({ width: text.length * 10 }), clearRect() {}, createLinearGradient: (...coords) => { const gradient = { coords, stops: [], addColorStop(offset, color) { this.stops.push([offset, color]); } }; gradients.push(gradient); return gradient; }, fillText: (...args) => { calls.push(['text', ...args]); alphas.push(ctx.globalAlpha); }, fillRect: (...args) => calls.push(['underline', ...args]), strokeRect: (...args) => calls.push(['guide', ...args]), setLineDash() {}, beginPath() {}, arc() {}, fill() {} };
    return { ctx, calls, alphas, gradients, canvas: { width: 900, height: 600, getContext: () => ctx } };
}

test('preview aligns the sample around the saved anchor and scales point sizes', () => {
    const { ctx } = context();
    for (const [alignment, left] of [['L', 450], ['C', 425], ['R', 400]]) {
        const bounds = textBounds(ctx, { x: 0, y: 0, x_pct: 0.5, y_pct: 0.5, fontSize: 24, alignment }, 'Rizky');
        assert.equal(bounds.left, left);
        assert.equal(bounds.y, 300);
        assert.equal(bounds.size, 36);
    }
});

test('normal and italic styles differ from the legacy bold default', () => {
    const { ctx } = context();
    textBounds(ctx, { x: 0, y: 0, fontStyle: 'N' }, 'Sample');
    assert.match(ctx.font, /^normal normal /);
    textBounds(ctx, { x: 0, y: 0, fontStyle: 'BIU' }, 'Sample');
    assert.match(ctx.font, /^italic bold /);
});

test('canvas displays edited sample text, color and underline, with guides optional', () => {
    const { ctx, calls, canvas } = context();
    const variable = { name: 'nama_lengkap', x: 100, y: 200, alignment: 'L', fontStyle: 'U', textColor: '#2456ab' };
    drawCertificateVariables(canvas, [variable], 0, { nama_lengkap: 'Nama yang sangat panjang' }, true);
    assert.deepEqual(calls[0], ['text', 'Nama yang sangat panjang', 100, 200]);
    assert.equal(ctx.fillStyle, '#2456ab');
    assert.ok(calls.some(call => call[0] === 'underline'));
    assert.ok(!calls.some(call => call[0] === 'guide'));
    drawCertificateVariables(canvas, [variable], 0, {}, false);
    assert.ok(calls.some(call => call[0] === 'guide'));
    assert.equal(previewText('nama_lengkap'), 'Muhammad Rizky Pratama, S.Kom.');
});

test('an intentionally empty sample stays empty', () => {
    const { calls, canvas } = context();
    drawCertificateVariables(canvas, [{ name: 'nama_lengkap', x: 0, y: 0 }], null, { nama_lengkap: '' }, true);
    assert.equal(calls[0][1], '');
});

test('saving migrates legacy canvas positions while preserving existing percentage anchors', () => {
    const mapped = prepareCertificateMapping([{ name: 'old', x: 450, y: 300, fontStyle: 'N' }, { name: 'new', x: 1, y: 1, x_pct: 0.8, y_pct: 0.2 }], 900, 600);
    assert.equal(mapped[0].x_pct, 0.5);
    assert.equal(mapped[0].y_pct, 0.5);
    assert.equal(mapped[0].fontStyle, 'N');
    assert.equal(mapped[0].layoutVersion, 2);
    assert.equal(mapped[1].x_pct, 0.8);
    assert.equal(mapped[1].y_pct, 0.2);
});

test('transparency is applied to text and resets before guides and the next variable', () => {
    const { canvas, ctx, alphas } = context();
    drawCertificateVariables(canvas, [{ name: 'first', x: 100, y: 100, opacity: 0 }, { name: 'second', x: 100, y: 200, opacity: 0.35 }, { name: 'third', x: 100, y: 300 }], 0, {});
    assert.deepEqual(alphas, [0, 0.35, 1]);
    assert.equal(ctx.globalAlpha, 1);
});

test('gradient preview interpolates every selected color in order', () => {
    const { canvas, gradients } = context();
    drawCertificateVariables(canvas, [{ name: 'sample', x: 100, y: 100, colorMode: 'gradient', gradientColors: ['#ff0000', '#00ff00', '#0000ff'], gradientAngle: 90 }], null, {});
    assert.equal(gradients.length, 1);
    assert.deepEqual(gradients[0].stops, [[0, '#ff0000'], [0.5, '#00ff00'], [1, '#0000ff']]);
    assert.ok(Math.abs(gradients[0].coords[0] - gradients[0].coords[2]) < 1e-8);
    assert.ok(gradients[0].coords[3] > gradients[0].coords[1]);
});

test('gradient directions reverse correctly, including on wide text boxes', () => {
    const right = gradientVector(0, 0, 200, 20, 0);
    const left = gradientVector(0, 0, 200, 20, 180);
    assert.deepEqual(right, [0, 10, 200, 10]);
    assert.ok(Math.abs(left[0] - 200) < 1e-8);
    assert.ok(Math.abs(left[2]) < 1e-8);
    const up = gradientVector(0, 0, 200, 20, 270);
    assert.ok(up[1] > up[3]);
});
