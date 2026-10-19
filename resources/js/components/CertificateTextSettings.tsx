import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    browserFont,
    certificateFonts,
    defaultGradientColors,
    gradientPresets,
    previewText,
    type VariablePosition,
} from '@/lib/certificate-mapping';

interface Props {
    variable: VariablePosition;
    sample?: string;
    onSampleChange: (value: string) => void;
    onChange: (patch: Partial<VariablePosition>) => void;
}

export default function CertificateTextSettings({
    variable,
    sample,
    onSampleChange,
    onChange,
}: Props) {
    const style = variable.fontStyle ?? 'B';
    const colors = variable.gradientColors ?? defaultGradientColors;
    const angle = variable.gradientAngle ?? 0;
    const opacity = variable.opacity ?? 1;
    const gradientBackground = `linear-gradient(${angle + 90}deg, ${colors.join(', ')})`;
    const toggle = (letter: string) =>
        onChange({
            fontStyle:
                ['B', 'I', 'U']
                    .filter((flag) =>
                        flag === letter
                            ? !style.includes(flag)
                            : style.includes(flag),
                    )
                    .join('') || 'N',
        });
    return (
        <div className="space-y-4" onClick={(event) => event.stopPropagation()}>
            <label className="grid gap-2 text-xs font-medium">
                Contoh teks untuk preview
                <Input
                    value={sample ?? previewText(variable.name)}
                    onChange={(event) => onSampleChange(event.target.value)}
                />
                <span className="font-normal text-muted-foreground">
                    Coba nama pendek atau panjang. Saat cetak, teks diambil dari
                    Excel.
                </span>
            </label>
            <label className="grid gap-2 text-xs font-medium">
                Jenis font
                <select
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={variable.fontFamily ?? 'Arial'}
                    onChange={(event) =>
                        onChange({ fontFamily: event.target.value })
                    }
                >
                    {certificateFonts.map((font) => (
                        <option
                            key={font}
                            value={font}
                            style={{ fontFamily: browserFont(font) }}
                        >
                            {font}
                        </option>
                    ))}
                </select>
            </label>
            <label className="grid gap-2 text-xs font-medium">
                Geser untuk mengubah ukuran
                <input
                    type="range"
                    min={8}
                    max={72}
                    step={0.5}
                    value={variable.fontSize ?? 12}
                    onChange={(event) =>
                        onChange({ fontSize: Number(event.target.value) })
                    }
                    className="w-full accent-blue-600"
                />
            </label>
            <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-2 text-xs font-medium">
                    Ukuran (pt)
                    <Input
                        type="number"
                        min={8}
                        max={72}
                        step={0.5}
                        value={variable.fontSize ?? 12}
                        onChange={(event) => {
                            const size = Number(event.target.value);
                            if (Number.isFinite(size))
                                onChange({
                                    fontSize: Math.max(8, Math.min(72, size)),
                                });
                        }}
                    />
                </label>
                <label className="grid gap-2 text-xs font-medium">
                    Warna solid
                    <Input
                        type="color"
                        className="w-full cursor-pointer p-1"
                        disabled={variable.colorMode === 'gradient'}
                        value={variable.textColor ?? '#000000'}
                        onChange={(event) =>
                            onChange({ textColor: event.target.value })
                        }
                    />
                </label>
            </div>
            <fieldset className="space-y-3 rounded-lg border p-3">
                <legend className="px-1 text-xs font-semibold">
                    Warna & efek teks
                </legend>
                <div className="flex gap-2">
                    {(['solid', 'gradient'] as const).map((mode) => (
                        <Button
                            key={mode}
                            type="button"
                            size="sm"
                            variant={
                                (variable.colorMode ?? 'solid') === mode
                                    ? 'default'
                                    : 'outline'
                            }
                            aria-pressed={
                                (variable.colorMode ?? 'solid') === mode
                            }
                            onClick={() => onChange({ colorMode: mode })}
                        >
                            {mode === 'solid' ? 'Warna solid' : 'Gradasi'}
                        </Button>
                    ))}
                </div>
                {variable.colorMode === 'gradient' && (
                    <>
                        <div
                            className="h-8 rounded-md border"
                            style={{ background: gradientBackground }}
                            aria-label="Kombinasi warna gradasi"
                        />
                        <div className="flex flex-wrap gap-2">
                            {gradientPresets.map((preset) => (
                                <button
                                    key={preset.name}
                                    type="button"
                                    className="rounded-md border px-2 py-1 text-xs"
                                    onClick={() =>
                                        onChange({
                                            gradientColors: [...preset.colors],
                                        })
                                    }
                                >
                                    <span
                                        className="mr-1 inline-block h-3 w-5 rounded-sm align-middle"
                                        style={{
                                            background: `linear-gradient(90deg, ${preset.colors.join(', ')})`,
                                        }}
                                    />
                                    {preset.name}
                                </button>
                            ))}
                        </div>
                        <div className="space-y-2">
                            {colors.map((color, index) => (
                                <div
                                    key={index}
                                    className="flex items-center gap-2"
                                >
                                    <label className="flex flex-1 items-center gap-2 text-xs">
                                        Warna {index + 1}
                                        <Input
                                            type="color"
                                            className="h-8 min-w-0 flex-1 cursor-pointer p-1"
                                            value={color}
                                            onChange={(event) =>
                                                onChange({
                                                    gradientColors: colors.map(
                                                        (item, position) =>
                                                            position === index
                                                                ? event.target
                                                                      .value
                                                                : item,
                                                    ),
                                                })
                                            }
                                        />
                                    </label>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        aria-label={`Hapus warna ${index + 1}`}
                                        disabled={colors.length <= 2}
                                        onClick={() =>
                                            onChange({
                                                gradientColors: colors.filter(
                                                    (_, position) =>
                                                        position !== index,
                                                ),
                                            })
                                        }
                                    >
                                        Hapus
                                    </Button>
                                </div>
                            ))}
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={colors.length >= 5}
                                    onClick={() =>
                                        onChange({
                                            gradientColors: [
                                                ...colors,
                                                '#f59e0b',
                                            ],
                                        })
                                    }
                                >
                                    + Warna
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                        onChange({
                                            gradientColors: [
                                                ...colors,
                                            ].reverse(),
                                        })
                                    }
                                >
                                    Balik warna
                                </Button>
                            </div>
                        </div>
                        <label className="grid gap-2 text-xs font-medium">
                            Arah gradasi
                            <select
                                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                                value={
                                    [
                                        0, 45, 90, 135, 180, 225, 270, 315,
                                    ].includes(angle)
                                        ? angle
                                        : 'custom'
                                }
                                onChange={(event) => {
                                    if (event.target.value !== 'custom')
                                        onChange({
                                            gradientAngle: Number(
                                                event.target.value,
                                            ),
                                        });
                                }}
                            >
                                {[
                                    [0, 'Kiri ke kanan'],
                                    [45, 'Diagonal kanan bawah'],
                                    [90, 'Atas ke bawah'],
                                    [135, 'Diagonal kiri bawah'],
                                    [180, 'Kanan ke kiri'],
                                    [225, 'Diagonal kiri atas'],
                                    [270, 'Bawah ke atas'],
                                    [315, 'Diagonal kanan atas'],
                                ].map(([value, label]) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                ))}
                                <option value="custom">Sudut khusus</option>
                            </select>
                        </label>
                        <label className="grid gap-2 text-xs font-medium">
                            Sudut: {angle} derajat
                            <input
                                type="range"
                                min={0}
                                max={360}
                                step={1}
                                value={angle}
                                className="w-full accent-blue-600"
                                onChange={(event) =>
                                    onChange({
                                        gradientAngle: Number(
                                            event.target.value,
                                        ),
                                    })
                                }
                            />
                        </label>
                    </>
                )}
                <label className="grid gap-2 text-xs font-medium">
                    Transparansi: {Math.round((1 - opacity) * 100)}%
                    <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={Math.round((1 - opacity) * 100)}
                        className="w-full accent-blue-600"
                        onChange={(event) =>
                            onChange({
                                opacity: 1 - Number(event.target.value) / 100,
                            })
                        }
                    />
                    <span className="font-normal text-muted-foreground">
                        0%: warna penuh. 100%: teks tidak terlihat.
                    </span>
                </label>
            </fieldset>
            <div className="space-y-2">
                <Label className="text-xs">Gaya teks</Label>
                <div className="flex gap-2">
                    {(
                        [
                            ['B', 'Tebal'],
                            ['I', 'Miring'],
                            ['U', 'Garis bawah'],
                        ] as const
                    ).map(([flag, label]) => (
                        <Button
                            type="button"
                            key={flag}
                            size="sm"
                            variant={
                                style.includes(flag) ? 'default' : 'outline'
                            }
                            aria-label={label}
                            aria-pressed={style.includes(flag)}
                            onClick={() => toggle(flag)}
                        >
                            <span
                                style={{
                                    fontWeight:
                                        flag === 'B' ? 'bold' : 'normal',
                                    fontStyle:
                                        flag === 'I' ? 'italic' : 'normal',
                                    textDecoration:
                                        flag === 'U' ? 'underline' : undefined,
                                }}
                            >
                                {flag}
                            </span>
                        </Button>
                    ))}
                </div>
            </div>
            <div className="space-y-2">
                <Label className="text-xs">Rata teks</Label>
                <div className="flex gap-2">
                    {(
                        [
                            ['L', 'Kiri'],
                            ['C', 'Tengah'],
                            ['R', 'Kanan'],
                        ] as const
                    ).map(([value, label]) => (
                        <Button
                            type="button"
                            key={value}
                            size="sm"
                            variant={
                                (variable.alignment ?? 'C') === value
                                    ? 'default'
                                    : 'outline'
                            }
                            aria-pressed={(variable.alignment ?? 'C') === value}
                            onClick={() => onChange({ alignment: value })}
                        >
                            {label}
                        </Button>
                    ))}
                </div>
                <Label className="text-xs">Posisi di halaman</Label>
                <div className="flex flex-wrap gap-2">
                    {(
                        [
                            ['L', 'Tepi kiri', 0.05],
                            ['C', 'Tengah', 0.5],
                            ['R', 'Tepi kanan', 0.95],
                        ] as const
                    ).map(([alignment, label, position]) => (
                        <Button
                            key={alignment}
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                                onChange({ x_pct: position, alignment })
                            }
                        >
                            {label}
                        </Button>
                    ))}
                </div>
            </div>
        </div>
    );
}
