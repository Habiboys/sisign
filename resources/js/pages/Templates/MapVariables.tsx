import { downloadExcelTemplate } from '@/actions/App/Http/Controllers/SertifikatController';
import {
    saveVariablePositions,
    viewSignedPDF,
} from '@/actions/App/Http/Controllers/TemplateSertifController';
import CertificateTextSettings from '@/components/CertificateTextSettings';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    drawCertificateVariables,
    prepareCertificateMapping,
    previewText,
    textBounds,
    type VariablePosition,
} from '@/lib/certificate-mapping';

import { useToast } from '@/hooks/use-toast';
import AppLayout from '@/layouts/app-layout';
import { Head, router, useForm } from '@inertiajs/react';
import { GripVertical, Plus, Save, Settings2, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
}

interface Template {
    id: string;
    title: string;
    files: string;
    signed_template_path?: string;
    variable_positions?: VariablePosition[];
}

interface Props {
    template: Template;
    user: User;
}

export default function TemplatesMapVariables({ template, user }: Props) {
    const { error } = useToast();
    const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [pdfUrl, setPdfUrl] = useState<string>('');
    const [variables, setVariables] = useState<VariablePosition[]>(
        template.variable_positions || [],
    );
    const [samples, setSamples] = useState<Record<string, string>>({});
    const [cleanPreview, setCleanPreview] = useState(false);
    const [selectedVariable, setSelectedVariable] = useState<number | null>(
        null,
    );
    const [isAddingVariable, setIsAddingVariable] = useState(false);
    const [newVariableName, setNewVariableName] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const dragStateRef = useRef<{
        index: number;
        moved: boolean;
        startX: number;
        startY: number;
        offsetX: number;
        offsetY: number;
    } | null>(null);
    const justDraggedRef = useRef(false);

    const { post, processing, transform } = useForm({
        variable_positions: variables.map((variable) => ({
            ...variable,
            layoutVersion: 2,
        })),
    });

    useEffect(() => {
        // Load PDF from signed template path using route
        if (template.signed_template_path && template.id) {
            // Use route to serve PDF instead of direct storage access
            const url = viewSignedPDF.url(template.id);
            setPdfUrl(url);
        }
    }, [template]);

    const initialPdfRef = useRef('');
    const [pdfLoading, setPdfLoading] = useState(false);
    const drawRef = useRef<() => void>(() => {});

    const loadPDF = useCallback(async () => {
        if (!pdfUrl || !pdfCanvasRef.current || !overlayCanvasRef.current)
            return;

        setPdfLoading(true);
        try {
            const pdfjsLib = await import('pdfjs-dist');
            pdfjsLib.GlobalWorkerOptions.workerSrc =
                'https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js';

            const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
            setTotalPages(pdf.numPages);
            if (initialPdfRef.current !== pdfUrl) {
                initialPdfRef.current = pdfUrl;
                if (currentPage !== pdf.numPages) {
                    setCurrentPage(pdf.numPages);
                    return;
                }
            }

            const pageData = await pdf.getPage(currentPage);
            const viewport = pageData.getViewport({ scale: 1.5 });

            const pdfCanvas = pdfCanvasRef.current;
            const overlayCanvas = overlayCanvasRef.current;

            // Set dimensions for both canvases
            pdfCanvas.width = viewport.width;
            pdfCanvas.height = viewport.height;
            overlayCanvas.width = viewport.width;
            overlayCanvas.height = viewport.height;

            const ctx = pdfCanvas.getContext('2d');
            if (!ctx) return;

            const renderContext = {
                canvasContext: ctx,
                viewport: viewport,
            };

            await pageData.render(renderContext).promise;

            // Draw variables on overlay
            drawRef.current();
        } catch (err) {
            console.error('Error loading PDF:', err);
            error('Gagal memuat PDF template');
        } finally {
            setPdfLoading(false);
        }
    }, [pdfUrl, currentPage]); // Removed variables dependency

    const drawVariables = useCallback(() => {
        const canvas = overlayCanvasRef.current;
        if (canvas)
            drawCertificateVariables(
                canvas,
                currentPage === totalPages ? variables : [],
                selectedVariable,
                samples,
                cleanPreview,
            );
    }, [
        variables,
        selectedVariable,
        samples,
        cleanPreview,
        currentPage,
        totalPages,
    ]);

    useEffect(() => {
        drawRef.current = drawVariables;
        drawVariables();
        let active = true;
        Promise.all(
            variables.map((variable) =>
                document.fonts.load(
                    `${(variable.fontStyle ?? 'B').includes('I') ? 'italic' : 'normal'} ${(variable.fontStyle ?? 'B').includes('B') ? 'bold' : 'normal'} 12px "${variable.fontFamily ?? 'Arial'}"`,
                ),
            ),
        ).then(() => {
            if (active) drawRef.current();
        });
        return () => {
            active = false;
        };
    }, [drawVariables, variables]);

    useEffect(() => {
        loadPDF();
    }, [loadPDF]);

    const getCanvasCoords = (
        e: { clientX: number; clientY: number },
        canvas: HTMLCanvasElement,
    ) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        return {
            x: Math.max(0, Math.min(canvas.width, x)),
            y: Math.max(0, Math.min(canvas.height, y)),
            x_pct: Math.max(0, Math.min(1, x / canvas.width)),
            y_pct: Math.max(0, Math.min(1, y / canvas.height)),
        };
    };

    const findVariableAtPosition = (
        x: number,
        y: number,
        canvas: HTMLCanvasElement,
    ): number | null => {
        const hitRadius = 14; // slightly bigger than the drawn marker for easier grabbing
        for (let i = variables.length - 1; i >= 0; i--) {
            const variable = variables[i];
            let vx = variable.x;
            let vy = variable.y;
            if (variable.x_pct !== undefined && variable.y_pct !== undefined) {
                vx = variable.x_pct * canvas.width;
                vy = variable.y_pct * canvas.height;
            }
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;
            const bounds = textBounds(
                ctx,
                variable,
                samples[variable.name] ?? previewText(variable.name),
            );
            if (
                Math.hypot(x - vx, y - vy) <= hitRadius ||
                (x >= bounds.left - 8 &&
                    x <= bounds.left + bounds.width + 8 &&
                    y >= bounds.y - bounds.size - 8 &&
                    y <= bounds.y + 10)
            ) {
                return i;
            }
        }
        return null;
    };

    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (pdfLoading || currentPage !== totalPages) return;
        const canvas = overlayCanvasRef.current;
        if (!canvas) return;

        // Ignore the click that fires right after a drag ends.
        if (justDraggedRef.current) {
            justDraggedRef.current = false;
            return;
        }

        const { x, y, x_pct, y_pct } = getCanvasCoords(e, canvas);

        if (isAddingVariable && newVariableName.trim()) {
            // Add new variable at clicked position
            const newVariable: VariablePosition = {
                name: newVariableName.trim(),
                x: x,
                y: y,
                x_pct: x_pct,
                y_pct: y_pct,
                fontSize: 12,
                fontFamily: 'Arial',
                alignment: 'C',
            };
            setVariables([...variables, newVariable]);
            setNewVariableName('');
            setIsAddingVariable(false);
            setSelectedVariable(variables.length);
        }
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = overlayCanvasRef.current;
        if (
            !canvas ||
            isAddingVariable ||
            pdfLoading ||
            currentPage !== totalPages
        )
            return;

        const { x, y } = getCanvasCoords(e, canvas);
        const hitIndex = findVariableAtPosition(x, y, canvas);

        if (hitIndex === null) return;

        canvas.setPointerCapture(e.pointerId);
        dragStateRef.current = {
            index: hitIndex,
            moved: false,
            startX: x,
            startY: y,
            offsetX:
                x -
                (variables[hitIndex].x_pct !== undefined
                    ? variables[hitIndex].x_pct! * canvas.width
                    : variables[hitIndex].x),
            offsetY:
                y -
                (variables[hitIndex].y_pct !== undefined
                    ? variables[hitIndex].y_pct! * canvas.height
                    : variables[hitIndex].y),
        };
        setIsDragging(true);
        setSelectedVariable(hitIndex);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = overlayCanvasRef.current;
        const dragState = dragStateRef.current;
        if (!canvas || !dragState) return;

        const { x: pointerX, y: pointerY } = getCanvasCoords(e, canvas);
        const x = Math.max(
            0,
            Math.min(canvas.width, pointerX - dragState.offsetX),
        );
        const y = Math.max(
            0,
            Math.min(canvas.height, pointerY - dragState.offsetY),
        );
        const x_pct = x / canvas.width;
        const y_pct = y / canvas.height;

        // Only start visually dragging once the pointer has moved a couple
        // pixels, so a plain click doesn't get treated as a (no-op) drag.
        if (
            !dragState.moved &&
            Math.hypot(
                pointerX - dragState.startX,
                pointerY - dragState.startY,
            ) < 3
        ) {
            return;
        }
        dragState.moved = true;

        setVariables((prev) => {
            const updated = [...prev];
            updated[dragState.index] = {
                ...updated[dragState.index],
                x,
                y,
                x_pct,
                y_pct,
            };
            return updated;
        });
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = overlayCanvasRef.current;
        const dragState = dragStateRef.current;
        if (canvas && canvas.hasPointerCapture(e.pointerId)) {
            canvas.releasePointerCapture(e.pointerId);
        }

        if (dragState?.moved) {
            // Suppress the synthetic click that follows this pointer up.
            justDraggedRef.current = true;
        }

        dragStateRef.current = null;
        setIsDragging(false);
    };

    const addStandardVariable = (name: string) => {
        if (pdfLoading || currentPage !== totalPages) return;
        const canvas = overlayCanvasRef.current;
        if (!canvas) return;

        // Default position: Center of canvas
        const x = canvas.width / 2;
        const y = canvas.height / 2;
        const x_pct = 0.5;
        const y_pct = 0.5;

        const newVariable: VariablePosition = {
            name: name,
            x: x,
            y: y,
            x_pct: x_pct,
            y_pct: y_pct,
            fontSize: 12,
            fontFamily: 'Arial',
            alignment: 'C',
        };
        setVariables([...variables, newVariable]);
        setSelectedVariable(variables.length);
    };

    const handleAddVariable = () => {
        if (!newVariableName.trim()) {
            error('Nama variabel tidak boleh kosong');
            return;
        }
        if (
            variables.some(
                (variable) => variable.name === newVariableName.trim(),
            )
        ) {
            error('Nama variabel sudah digunakan');
            return;
        }
        setIsAddingVariable(true);
    };

    const handleSave = () => {
        if (pdfLoading || !overlayCanvasRef.current) return;
        if (variables.length === 0) {
            error('Minimal harus ada 1 variabel');
            return;
        }

        transform((data) => ({
            ...data,
            variable_positions: prepareCertificateMapping(
                variables,
                overlayCanvasRef.current!.width,
                overlayCanvasRef.current!.height,
            ),
        }));

        post(saveVariablePositions.url(template.id), {
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                // Backend flashes a success message, shown automatically by
                // the app layout - don't show a second toast here.
                // Auto download template Excel setelah save
                setTimeout(() => {
                    window.open(
                        downloadExcelTemplate.url(template.id),
                        '_blank',
                    );
                }, 500);
            },
            onError: () => {
                error('Gagal menyimpan posisi variabel');
            },
        });
    };

    const handleDeleteVariable = (index: number) => {
        setVariables(variables.filter((_, i) => i !== index));
        setSelectedVariable((previous) =>
            previous === null || previous === index
                ? null
                : previous > index
                  ? previous - 1
                  : previous,
        );
    };

    return (
        <AppLayout>
            <Head title={`Map Variables - ${template.title}`} />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            Mapping Variabel Template
                        </h1>
                        <p className="text-sm text-gray-600">
                            Tambahkan variabel, lalu seret langsung di PDF untuk
                            mengatur posisinya.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() =>
                                router.visit(`/templates/${template.id}`)
                            }
                        >
                            <X className="mr-2 h-4 w-4" />
                            Batal
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={processing || variables.length === 0}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            <Save className="mr-2 h-4 w-4" />
                            Simpan
                        </Button>
                    </div>
                </div>

                {/* 3-step guide so the flow is obvious at a glance */}
                <div className="grid grid-cols-1 gap-2 rounded-lg border border-blue-100 bg-blue-50/50 p-3 text-xs text-gray-700 sm:grid-cols-3 sm:text-sm">
                    <div className="flex items-start gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">
                            1
                        </span>
                        <span>
                            Tambahkan variabel dari daftar standar atau ketik
                            nama sendiri.
                        </span>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">
                            2
                        </span>
                        <span>
                            Seret titik warna di PDF untuk memindahkan
                            posisinya.
                        </span>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">
                            3
                        </span>
                        <span>
                            Klik variabel di daftar untuk atur ukuran, font &
                            rata teks.
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    {/* PDF Canvas */}
                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <CardTitle>Preview Sertifikat</CardTitle>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        aria-pressed={cleanPreview}
                                        onClick={() =>
                                            setCleanPreview((value) => !value)
                                        }
                                    >
                                        {cleanPreview
                                            ? 'Tampilkan panduan'
                                            : 'Preview bersih'}
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                    setCurrentPage(
                                                        Math.max(
                                                            1,
                                                            currentPage - 1,
                                                        ),
                                                    )
                                                }
                                                disabled={currentPage === 1}
                                            >
                                                Sebelumnya
                                            </Button>
                                            <span className="flex items-center px-4">
                                                Halaman {currentPage} /{' '}
                                                {totalPages}
                                            </span>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                    setCurrentPage(
                                                        Math.min(
                                                            totalPages,
                                                            currentPage + 1,
                                                        ),
                                                    )
                                                }
                                                disabled={
                                                    currentPage === totalPages
                                                }
                                            >
                                                Selanjutnya
                                            </Button>
                                        </div>
                                    </div>
                                    {pdfLoading && (
                                        <p
                                            role="status"
                                            className="animate-pulse text-sm text-muted-foreground"
                                        >
                                            Memuat preview sertifikat...
                                        </p>
                                    )}
                                    {totalPages > 1 && (
                                        <p className="text-sm text-muted-foreground">
                                            Teks variabel dicetak pada halaman
                                            terakhir.{' '}
                                            {currentPage !== totalPages && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        setCurrentPage(
                                                            totalPages,
                                                        )
                                                    }
                                                >
                                                    Kembali ke halaman mapping
                                                </Button>
                                            )}
                                        </p>
                                    )}
                                    <div className="relative overflow-auto rounded-lg border border-gray-300 bg-gray-50">
                                        <div className="relative inline-block">
                                            <canvas
                                                ref={pdfCanvasRef}
                                                style={{
                                                    display: 'block',
                                                    maxWidth: '100%',
                                                    height: 'auto',
                                                }}
                                            />
                                            <canvas
                                                ref={overlayCanvasRef}
                                                onClick={handleCanvasClick}
                                                onPointerDown={
                                                    handlePointerDown
                                                }
                                                onPointerMove={
                                                    handlePointerMove
                                                }
                                                onPointerUp={handlePointerUp}
                                                onPointerCancel={
                                                    handlePointerUp
                                                }
                                                className={`absolute top-0 left-0 ${
                                                    isAddingVariable
                                                        ? 'cursor-crosshair'
                                                        : isDragging
                                                          ? 'cursor-grabbing'
                                                          : 'cursor-grab'
                                                }`}
                                                style={{
                                                    maxWidth: '100%',
                                                    height: 'auto',
                                                    touchAction: 'none',
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <p className="flex items-center gap-1.5 text-sm text-gray-500">
                                        <GripVertical className="h-4 w-4 shrink-0 text-gray-400" />
                                        {isAddingVariable
                                            ? `Klik pada PDF untuk menambahkan variabel "${newVariableName}"`
                                            : 'Seret teks contoh untuk memindahkan posisinya. Klik teks untuk memilih pengaturannya.'}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Variable List */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Daftar Variabel</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Add New Variable */}
                                <div className="space-y-2">
                                    <Label>Variabel Standar</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {[
                                            'nomor_sertif',
                                            'nama_lengkap',
                                            'tanggal_terbit',
                                            'jabatan',
                                            'departemen',
                                        ].map((varName) => (
                                            <Button
                                                key={varName}
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                    addStandardVariable(varName)
                                                }
                                                className="text-xs"
                                                disabled={variables.some(
                                                    (v) => v.name === varName,
                                                )}
                                            >
                                                + {varName.replace('_', ' ')}
                                            </Button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Nama Variabel Baru</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            value={newVariableName}
                                            onChange={(e) =>
                                                setNewVariableName(
                                                    e.target.value,
                                                )
                                            }
                                            placeholder="Contoh: nama_lengkap"
                                            onKeyPress={(e) => {
                                                if (e.key === 'Enter') {
                                                    handleAddVariable();
                                                }
                                            }}
                                        />
                                        <Button
                                            onClick={handleAddVariable}
                                            size="sm"
                                            variant="outline"
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    {isAddingVariable && (
                                        <p className="text-xs text-blue-600">
                                            Sekarang klik posisi di PDF untuk
                                            menempatkan "{newVariableName}".
                                        </p>
                                    )}
                                </div>

                                {/* Variable List */}
                                <div className="max-h-[28rem] space-y-2 overflow-y-auto">
                                    {variables.map((variable, index) => {
                                        const isSelected =
                                            selectedVariable === index;
                                        return (
                                            <Card
                                                key={index}
                                                onClick={() =>
                                                    setSelectedVariable(
                                                        isSelected
                                                            ? null
                                                            : index,
                                                    )
                                                }
                                                className={`cursor-pointer gap-0 p-3 transition-colors ${
                                                    isSelected
                                                        ? 'border-blue-500 bg-blue-50 shadow-sm'
                                                        : 'hover:border-gray-300'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex min-w-0 items-center gap-2">
                                                        <span
                                                            className={`h-2.5 w-2.5 shrink-0 rounded-full ${isSelected ? 'bg-blue-500' : 'bg-red-500'}`}
                                                        />
                                                        <span className="truncate font-medium text-gray-900">
                                                            {variable.name}
                                                        </span>
                                                    </div>
                                                    <div className="flex shrink-0 items-center gap-1">
                                                        <Badge
                                                            variant="secondary"
                                                            className="hidden text-[10px] font-normal text-gray-500 sm:inline-flex"
                                                        >
                                                            {variable.fontSize ||
                                                                12}{' '}
                                                            pt
                                                        </Badge>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 w-7 p-0"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedVariable(
                                                                    isSelected
                                                                        ? null
                                                                        : index,
                                                                );
                                                            }}
                                                            title="Pengaturan font & posisi"
                                                        >
                                                            <Settings2 className="h-4 w-4 text-gray-500" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 w-7 p-0"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteVariable(
                                                                    index,
                                                                );
                                                            }}
                                                            title="Hapus variabel"
                                                        >
                                                            <Trash2 className="h-4 w-4 text-red-500" />
                                                        </Button>
                                                    </div>
                                                </div>

                                                {/* Detail settings only shown for the selected variable, to avoid
                                                    a wall of controls when there are many variables. */}
                                                {isSelected && (
                                                    <div
                                                        className="mt-3 space-y-3 border-t border-blue-200 pt-3"
                                                        onClick={(e) =>
                                                            e.stopPropagation()
                                                        }
                                                    >
                                                        <p className="text-xs text-blue-600">
                                                            Seret titik biru di
                                                            PDF untuk
                                                            memindahkan
                                                            posisinya.
                                                        </p>
                                                        <CertificateTextSettings
                                                            variable={variable}
                                                            sample={
                                                                samples[
                                                                    variable
                                                                        .name
                                                                ]
                                                            }
                                                            onSampleChange={(
                                                                value,
                                                            ) =>
                                                                setSamples(
                                                                    (
                                                                        previous,
                                                                    ) => ({
                                                                        ...previous,
                                                                        [variable.name]:
                                                                            value,
                                                                    }),
                                                                )
                                                            }
                                                            onChange={(patch) =>
                                                                setVariables(
                                                                    (
                                                                        previous,
                                                                    ) =>
                                                                        previous.map(
                                                                            (
                                                                                item,
                                                                                itemIndex,
                                                                            ) =>
                                                                                itemIndex ===
                                                                                index
                                                                                    ? {
                                                                                          ...item,
                                                                                          ...patch,
                                                                                      }
                                                                                    : item,
                                                                        ),
                                                                )
                                                            }
                                                        />
                                                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                                                            <div>
                                                                X:{' '}
                                                                {Math.round(
                                                                    variable.x,
                                                                )}
                                                            </div>
                                                            <div>
                                                                Y:{' '}
                                                                {Math.round(
                                                                    variable.y,
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </Card>
                                        );
                                    })}
                                </div>

                                {variables.length === 0 && (
                                    <p className="py-4 text-center text-sm text-gray-500">
                                        Belum ada variabel. Tambahkan variabel
                                        baru di atas.
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
