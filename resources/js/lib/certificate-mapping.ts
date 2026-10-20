export interface VariablePosition {
    name: string;
    x: number;
    y: number;
    x_pct?: number;
    y_pct?: number;
    fontSize?: number;
    fontFamily?: string;
    fontStyle?: string;
    textColor?: string;
    opacity?: number;
    colorMode?: 'solid' | 'gradient';
    gradientColors?: string[];
    gradientAngle?: number;
    alignment?: 'L' | 'C' | 'R';
    layoutVersion?: number;
}

export const certificateFonts = [
    'Arial',
    'Helvetica',
    'Times',
    'Times-Roman',
    'Courier',
    'DejaVu Sans',
    'DejaVu Serif',
    'DejaVu Sans Mono',
];

export function previewText(name: string): string {
    const examples: Record<string, string> = {
        nama_lengkap: 'Muhammad Rizky Pratama, S.Kom.',
        nomor_sertif: '001/SERT/X/2026',
        tanggal_terbit: '14/10/2026',
        jabatan: 'Peserta',
        departemen: 'Fakultas Teknologi Informasi',
    };
    return examples[name.toLowerCase()] ?? name.replaceAll('_', ' ');
}

export function browserFont(family = 'Arial'): string {
    return family === 'Times' || family === 'Times-Roman'
        ? '"Times New Roman", serif'
        : `"${family}", ${family.includes('Mono') || family === 'Courier' ? 'monospace' : 'sans-serif'}`;
}

export function textBounds(
    ctx: CanvasRenderingContext2D,
    variable: VariablePosition,
    text: string,
    scale = 1.5,
) {
    const size = (variable.fontSize ?? 12) * scale;
    const style = variable.fontStyle ?? 'B';
    ctx.font = `${style.includes('I') ? 'italic' : 'normal'} ${style.includes('B') ? 'bold' : 'normal'} ${size}px ${browserFont(variable.fontFamily)}`;
    const width = ctx.measureText(text).width;
    const x =
        variable.x_pct !== undefined
            ? variable.x_pct * ctx.canvas.width
            : variable.x;
    const y =
        variable.y_pct !== undefined
            ? variable.y_pct * ctx.canvas.height
            : variable.y;
    const left =
        x -
        (variable.alignment === 'L'
            ? 0
            : variable.alignment === 'R'
              ? width
              : width / 2);
    return { x, y, left, width, size };
}

export const defaultGradientColors = ['#2563eb', '#9333ea'];
export const gradientPresets = [
    { name: 'Samudra', colors: ['#06b6d4', '#2563eb'] },
    { name: 'Senja', colors: ['#f97316', '#ec4899', '#7c3aed'] },
    { name: 'Emas', colors: ['#854d0e', '#facc15', '#a16207'] },
    { name: 'Hutan', colors: ['#14532d', '#22c55e', '#a3e635'] },
    {
        name: 'Pelangi',
        colors: ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7'],
    },
];

export function gradientVector(
    left: number,
    top: number,
    width: number,
    height: number,
    angle: number,
) {
    const radians = (angle * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const length = Math.abs(width * cos) + Math.abs(height * sin);
    return [
        left + width / 2 - (cos * length) / 2,
        top + height / 2 - (sin * length) / 2,
        left + width / 2 + (cos * length) / 2,
        top + height / 2 + (sin * length) / 2,
    ] as const;
}

export function drawCertificateVariables(
    canvas: HTMLCanvasElement,
    variables: VariablePosition[],
    selected: number | null,
    samples: Record<string, string>,
    clean = false,
) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    variables.forEach((variable, index) => {
        const text = samples[variable.name] ?? previewText(variable.name);
        const { x, y, left, width, size } = textBounds(ctx, variable, text);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.globalAlpha = Math.max(0, Math.min(1, variable.opacity ?? 1));
        const colors = variable.gradientColors ?? defaultGradientColors;
        if (
            variable.colorMode === 'gradient' &&
            colors.length >= 2 &&
            width > 0
        ) {
            const vector = gradientVector(
                left,
                y - size,
                width,
                size * 1.3,
                variable.gradientAngle ?? 0,
            );
            const gradient = ctx.createLinearGradient(...vector);
            colors.forEach((color, stop) =>
                gradient.addColorStop(stop / (colors.length - 1), color),
            );
            ctx.fillStyle = gradient;
        } else {
            ctx.fillStyle = variable.textColor ?? '#000000';
        }
        ctx.fillText(text, left, y);
        if ((variable.fontStyle ?? 'B').includes('U')) {
            ctx.fillRect(left, y + size * 0.1, width, Math.max(1, size / 18));
        }
        ctx.globalAlpha = 1;
        if (!clean) {
            ctx.strokeStyle = index === selected ? '#2563eb' : '#94a3b8';
            ctx.setLineDash([4, 3]);
            ctx.strokeRect(left - 4, y - size, width + 8, size * 1.3);
            ctx.setLineDash([]);
            ctx.fillStyle = index === selected ? '#2563eb' : '#64748b';
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
        }
    });
}

export function prepareCertificateMapping(
    variables: VariablePosition[],
    width: number,
    height: number,
): VariablePosition[] {
    return variables.map((variable) => ({
        ...variable,
        x_pct: variable.x_pct ?? Math.max(0, Math.min(1, variable.x / width)),
        y_pct: variable.y_pct ?? Math.max(0, Math.min(1, variable.y / height)),
        layoutVersion: 2,
    }));
}
