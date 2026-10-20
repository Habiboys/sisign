import { downloadExcelTemplate } from '@/actions/App/Http/Controllers/SertifikatController';
import {
    saveVariablePositions,
    viewSignedPDF,
} from '@/actions/App/Http/Controllers/TemplateSertifController';
import CertificateTextSettings from '@/components/CertificateTextSettings';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import AppLayout from '@/layouts/app-layout';
import {
    drawCertificateVariables,
    prepareCertificateMapping,
    previewText,
    textBounds,
    type VariablePosition,
} from '@/lib/certificate-mapping';
import { routes } from '@/utils/routes';
import { Head, router, useForm } from '@inertiajs/react';
import {
    AlertCircle,
    ArrowLeft,
    ArrowRight,
    Award,
    CheckCircle2,
    Download,
    FileSpreadsheet,
    MapPin,
    Upload,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Template {
    id: string;
    title: string;
    description?: string;
    signed_template_path?: string;
    variable_positions?: VariablePosition[];
    has_variables_mapped: boolean;
}

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
}

interface Props {
    templates: Template[];
    user: User;
}

type Step = 'select' | 'mapping' | 'upload';

export default function CertificatesBulkCreateWizard({
    templates,
    user,
}: Props) {
    const { error, info } = useToast();
    const [currentStep, setCurrentStep] = useState<Step>('select');
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [variables, setVariables] = useState<VariablePosition[]>([]);
    const [isMappingMode, setIsMappingMode] = useState(false);
    const [newVariableName, setNewVariableName] = useState('');
    const [samples, setSamples] = useState<Record<string, string>>({});
    const [cleanPreview, setCleanPreview] = useState(false);
    const [selectedVariable, setSelectedVariable] = useState<number | null>(
        null,
    );
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [pdfUrl, setPdfUrl] = useState<string>('');
    const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

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

    const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

    const { data, setData, post, processing, errors, transform } = useForm({
        templateSertifId: '',
        excel_file: null as File | null,
        variable_positions: [] as VariablePosition[],
        show_qr_code: true, // Default: show QR code
    });

    // Load PDF when template is selected
    useEffect(() => {
        if (selectedTemplate?.signed_template_path && selectedTemplate?.id) {
            // Use route to serve PDF instead of direct storage access
            const url = viewSignedPDF.url(selectedTemplate.id);
            setPdfUrl(url);
            // Load variable positions dari template (jika sudah ada di DB)
            if (
                selectedTemplate.variable_positions &&
                selectedTemplate.variable_positions.length > 0
            ) {
                setVariables(selectedTemplate.variable_positions);
            } else {
                // Reset variables jika template belum punya mapping
                setVariables([]);
            }
        }
    }, [selectedTemplate]);

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
        if (currentStep === 'mapping' && pdfUrl) {
            loadPDF();
        }
    }, [currentStep, pdfUrl, loadPDF]);

    const handleTemplateSelect = (templateId: string) => {
        setSelectedTemplateId(templateId);
        setData('templateSertifId', templateId);
        const template = templates.find((t) => t.id === templateId);
        if (template?.has_variables_mapped) {
            setCurrentStep('upload');
        } else {
            setCurrentStep('mapping');
        }
    };

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
        if (justDraggedRef.current) {
            justDraggedRef.current = false;
            return;
        }
        if (!isMappingMode || !newVariableName.trim()) return;

        const canvas = overlayCanvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        // Calculate percentages
        const x_pct = x / canvas.width;
        const y_pct = y / canvas.height;

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
        setSelectedVariable(variables.length);
        setNewVariableName('');
        setIsMappingMode(false);
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = overlayCanvasRef.current;
        if (
            !canvas ||
            isMappingMode ||
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

    const handleSaveMapping = () => {
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

        post(saveVariablePositions.url(selectedTemplateId), {
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                // Backend flashes a success message, shown automatically by
                // the app layout - don't show a second toast here.

                // Reload page untuk mendapatkan data template terbaru dari server
                router.reload({
                    only: ['templates'],
                });

                // Auto download template Excel setelah save (dengan delay untuk memastikan DB ter-update)
                // Delay lebih lama untuk memastikan reload selesai
                setTimeout(() => {
                    window.open(
                        downloadExcelTemplate.url(selectedTemplateId),
                        '_blank',
                    );
                }, 1500);
                setCurrentStep('upload');
            },
            onError: () => {
                error('Gagal menyimpan posisi variabel');
            },
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!data.excel_file) {
            error('Silakan pilih file Excel terlebih dahulu');
            return;
        }

        info('Sedang memproses sertifikat...');

        // Debug: Log form data before submission
        console.log('Form data being submitted:', {
            templateSertifId: data.templateSertifId,
            excel_file: data.excel_file?.name,
            show_qr_code: data.show_qr_code,
        });

        // Backend flashes a success message, shown automatically by the app layout.
        post(routes.certificates.generateFromExcel(), {
            forceFormData: true,
            onError: (errors) => {
                const errorMessage = Object.values(errors).flat().join(', ');
                error('Terjadi kesalahan: ' + errorMessage);
            },
        });
    };

    return (
        <AppLayout>
            <Head title="Bulk Generate Sertifikat" />
            <div className="flex h-full flex-1 flex-col gap-6 overflow-x-auto rounded-xl p-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">
                        Bulk Generate Sertifikat
                    </h1>
                    <p className="text-gray-600">
                        Generate sertifikat dalam jumlah besar dari file Excel
                    </p>
                </div>

                {/* Step Indicator */}
                <div className="mb-6 flex items-center justify-center space-x-4">
                    <div
                        className={`flex items-center ${currentStep === 'select' ? 'text-blue-600' : 'text-gray-400'}`}
                    >
                        <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full ${currentStep === 'select' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                        >
                            1
                        </div>
                        <span className="ml-2 font-medium">Pilih Template</span>
                    </div>
                    <ArrowRight className="text-gray-400" />
                    <div
                        className={`flex items-center ${currentStep === 'mapping' ? 'text-blue-600' : currentStep === 'upload' && selectedTemplate?.has_variables_mapped ? 'text-green-600' : 'text-gray-400'}`}
                    >
                        <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full ${currentStep === 'mapping' ? 'bg-blue-600 text-white' : selectedTemplate?.has_variables_mapped ? 'bg-green-600 text-white' : 'bg-gray-200'}`}
                        >
                            {selectedTemplate?.has_variables_mapped ? (
                                <CheckCircle2 className="h-5 w-5" />
                            ) : (
                                '2'
                            )}
                        </div>
                        <span className="ml-2 font-medium">
                            Mapping Variabel
                        </span>
                    </div>
                    <ArrowRight className="text-gray-400" />
                    <div
                        className={`flex items-center ${currentStep === 'upload' ? 'text-blue-600' : 'text-gray-400'}`}
                    >
                        <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full ${currentStep === 'upload' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                        >
                            3
                        </div>
                        <span className="ml-2 font-medium">
                            Upload & Generate
                        </span>
                    </div>
                </div>

                {/* Step 1: Select Template */}
                {currentStep === 'select' && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center">
                                <Award className="mr-2 h-5 w-5" />
                                Pilih Template Sertifikat
                            </CardTitle>
                            <CardDescription>
                                Pilih template yang sudah ditandatangani untuk
                                bulk generation
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <Label>Template Sertifikat</Label>
                                <Select
                                    value={selectedTemplateId}
                                    onValueChange={handleTemplateSelect}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pilih template sertifikat" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {templates.length === 0 ? (
                                            <div className="p-4 text-center text-gray-500">
                                                <p>
                                                    Tidak ada template yang
                                                    tersedia.
                                                </p>
                                                <p className="text-sm">
                                                    Template harus disetujui dan
                                                    ditandatangani pimpinan
                                                    terlebih dahulu.
                                                </p>
                                            </div>
                                        ) : (
                                            templates.map((template) => (
                                                <SelectItem
                                                    key={template.id}
                                                    value={template.id}
                                                >
                                                    <div className="flex w-full items-center justify-between">
                                                        <span>
                                                            {template.title}
                                                        </span>
                                                        {template.has_variables_mapped ? (
                                                            <Badge className="ml-2 bg-green-100 text-xs text-green-800">
                                                                <CheckCircle2 className="mr-1 h-3 w-3" />
                                                                Siap
                                                            </Badge>
                                                        ) : (
                                                            <Badge className="ml-2 bg-yellow-100 text-xs text-yellow-800">
                                                                <AlertCircle className="mr-1 h-3 w-3" />
                                                                Perlu Mapping
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Step 2: Mapping Variables */}
                {currentStep === 'mapping' && selectedTemplate && (
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        <Card className="lg:col-span-2">
                            <CardHeader>
                                <CardTitle className="flex items-center">
                                    <MapPin className="mr-2 h-5 w-5" />
                                    Mapping Variabel
                                </CardTitle>
                                <CardDescription>
                                    Klik pada PDF untuk menambahkan atau
                                    mengubah posisi variabel
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="mb-3"
                                    aria-pressed={cleanPreview}
                                    onClick={() =>
                                        setCleanPreview((value) => !value)
                                    }
                                >
                                    {cleanPreview
                                        ? 'Tampilkan panduan'
                                        : 'Preview bersih'}
                                </Button>
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
                                                className={`absolute top-0 left-0 touch-none ${isMappingMode ? 'cursor-crosshair' : isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                                                style={{
                                                    maxWidth: '100%',
                                                    height: 'auto',
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-500">
                                        {isMappingMode
                                            ? `Klik pada PDF untuk menambahkan variabel "${newVariableName}"`
                                            : selectedVariable !== null
                                              ? `Seret teks "${variables[selectedVariable]?.name}" untuk memindahkannya`
                                              : 'Masukkan nama variabel dan klik "Tambah", lalu klik pada PDF. Seret teks yang sudah ada untuk memindahkannya.'}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Daftar Variabel</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
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
                                                        addStandardVariable(
                                                            varName,
                                                        )
                                                    }
                                                    className="text-xs"
                                                    disabled={variables.some(
                                                        (v) =>
                                                            v.name === varName,
                                                    )}
                                                >
                                                    +{' '}
                                                    {varName.replace('_', ' ')}
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
                                                    if (
                                                        e.key === 'Enter' &&
                                                        newVariableName.trim()
                                                    ) {
                                                        setIsMappingMode(true);
                                                    }
                                                }}
                                            />
                                            <Button
                                                onClick={() => {
                                                    if (
                                                        newVariableName.trim()
                                                    ) {
                                                        setIsMappingMode(true);
                                                    }
                                                }}
                                                size="sm"
                                                variant="outline"
                                            >
                                                Tambah
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="max-h-96 space-y-2 overflow-y-auto">
                                        {variables.map((variable, index) => (
                                            <div
                                                key={index}
                                                className={`rounded border p-3 ${
                                                    selectedVariable === index
                                                        ? 'border-blue-500 bg-blue-50'
                                                        : ''
                                                }`}
                                            >
                                                <div className="mb-2 flex items-center justify-between">
                                                    <span className="text-sm font-medium">
                                                        {variable.name}
                                                    </span>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            setVariables(
                                                                variables.filter(
                                                                    (_, i) =>
                                                                        i !==
                                                                        index,
                                                                ),
                                                            );
                                                            setSelectedVariable(
                                                                (previous) =>
                                                                    previous ===
                                                                        null ||
                                                                    previous ===
                                                                        index
                                                                        ? null
                                                                        : previous >
                                                                            index
                                                                          ? previous -
                                                                            1
                                                                          : previous,
                                                            );
                                                        }}
                                                    >
                                                        ×
                                                    </Button>
                                                </div>
                                                <div className="space-y-2">
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
                                                    {selectedVariable ===
                                                        index && (
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
                                                    )}
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="w-full"
                                                        onClick={() =>
                                                            setSelectedVariable(
                                                                selectedVariable ===
                                                                    index
                                                                    ? null
                                                                    : index,
                                                            )
                                                        }
                                                    >
                                                        {selectedVariable ===
                                                        index
                                                            ? 'Batal Pilih'
                                                            : 'Atur teks & posisi'}
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                        {variables.length === 0 && (
                                            <p className="py-4 text-center text-sm text-gray-500">
                                                Belum ada variabel. Tambahkan
                                                variabel baru di atas.
                                            </p>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        {variables.length > 0 && (
                                            <Button
                                                onClick={() => {
                                                    window.open(
                                                        downloadExcelTemplate.url(
                                                            selectedTemplateId,
                                                        ),
                                                        '_blank',
                                                    );
                                                }}
                                                variant="outline"
                                                className="w-full"
                                            >
                                                <Download className="mr-2 h-4 w-4" />
                                                Download Template Excel
                                            </Button>
                                        )}
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                onClick={() =>
                                                    setCurrentStep('select')
                                                }
                                                className="flex-1"
                                            >
                                                <ArrowLeft className="mr-2 h-4 w-4" />
                                                Kembali
                                            </Button>
                                            <Button
                                                onClick={handleSaveMapping}
                                                disabled={
                                                    variables.length === 0 ||
                                                    processing
                                                }
                                                className="flex-1 bg-green-600 hover:bg-green-700"
                                            >
                                                Simpan & Lanjut
                                                <ArrowRight className="ml-2 h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}

                {/* Step 3: Upload Excel */}
                {currentStep === 'upload' && selectedTemplate && (
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center">
                                    <Upload className="mr-2 h-5 w-5" />
                                    Upload File Excel
                                </CardTitle>
                                <CardDescription>
                                    Upload file Excel sesuai dengan format
                                    template
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form
                                    onSubmit={handleSubmit}
                                    className="space-y-6"
                                >
                                    <div className="space-y-2">
                                        <Label>File Excel (.xlsx/.xls)</Label>
                                        <div className="flex w-full items-center justify-center">
                                            <label
                                                htmlFor="excel_file"
                                                className="flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100"
                                            >
                                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                    <Upload className="mb-4 h-8 w-8 text-gray-500" />
                                                    <p className="mb-2 text-sm text-gray-500">
                                                        <span className="font-semibold">
                                                            Klik untuk upload
                                                        </span>{' '}
                                                        atau drag and drop
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        XLSX, XLS (MAX. 10MB)
                                                    </p>
                                                </div>
                                                <input
                                                    id="excel_file"
                                                    type="file"
                                                    className="hidden"
                                                    accept=".xlsx,.xls"
                                                    onChange={(e) =>
                                                        setData(
                                                            'excel_file',
                                                            e.target
                                                                .files?.[0] ||
                                                                null,
                                                        )
                                                    }
                                                />
                                            </label>
                                        </div>
                                        {data.excel_file && (
                                            <p className="text-sm text-green-600">
                                                File terpilih:{' '}
                                                {data.excel_file.name}
                                            </p>
                                        )}
                                    </div>

                                    {/* QR Code Toggle */}
                                    <div className="space-y-2">
                                        <div className="flex items-center space-x-2 rounded-lg border border-gray-200 p-4">
                                            <Checkbox
                                                id="show_qr_code"
                                                checked={data.show_qr_code}
                                                onCheckedChange={(checked) =>
                                                    setData(
                                                        'show_qr_code',
                                                        checked as boolean,
                                                    )
                                                }
                                            />
                                            <div className="grid gap-1.5 leading-none">
                                                <label
                                                    htmlFor="show_qr_code"
                                                    className="cursor-pointer text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                                >
                                                    Tampilkan QR Code
                                                </label>
                                                <p className="text-sm text-muted-foreground">
                                                    QR code untuk verifikasi
                                                    sertifikat akan ditambahkan
                                                    di sertifikat
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() =>
                                                setCurrentStep(
                                                    selectedTemplate.has_variables_mapped
                                                        ? 'select'
                                                        : 'mapping',
                                                )
                                            }
                                            className="flex-1"
                                        >
                                            <ArrowLeft className="mr-2 h-4 w-4" />
                                            Kembali
                                        </Button>
                                        <Button
                                            type="submit"
                                            className="flex-1 bg-green-600 hover:bg-green-700"
                                            disabled={processing}
                                        >
                                            {processing
                                                ? 'Generating...'
                                                : 'Generate Sertifikat'}
                                        </Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center">
                                    <FileSpreadsheet className="mr-2 h-5 w-5" />
                                    Format Excel
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {selectedTemplate.has_variables_mapped &&
                                    selectedTemplate.variable_positions && (
                                        <>
                                            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                                                <div className="mb-2 flex items-center">
                                                    <CheckCircle2 className="mr-2 h-5 w-5 text-green-600" />
                                                    <h4 className="font-medium text-green-800">
                                                        Variabel Template
                                                    </h4>
                                                </div>
                                                <div className="space-y-1 text-sm text-green-700">
                                                    {selectedTemplate.variable_positions.map(
                                                        (variable, index) => (
                                                            <div
                                                                key={index}
                                                                className="flex items-center"
                                                            >
                                                                <span className="font-medium">
                                                                    Kolom{' '}
                                                                    {String.fromCharCode(
                                                                        65 +
                                                                            index,
                                                                    )}
                                                                    :
                                                                </span>
                                                                <span className="ml-2 capitalize">
                                                                    {variable.name.replace(
                                                                        /_/g,
                                                                        ' ',
                                                                    )}
                                                                </span>
                                                            </div>
                                                        ),
                                                    )}
                                                </div>
                                            </div>

                                            <Button
                                                onClick={() => {
                                                    window.open(
                                                        downloadExcelTemplate.url(
                                                            selectedTemplateId,
                                                        ),
                                                        '_blank',
                                                    );
                                                }}
                                                variant="outline"
                                                className="w-full"
                                            >
                                                <Download className="mr-2 h-4 w-4" />
                                                Download Template Excel
                                            </Button>
                                        </>
                                    )}

                                <div className="rounded-lg bg-gray-50 p-4">
                                    <h4 className="mb-2 font-medium">
                                        Catatan Penting:
                                    </h4>
                                    <ul className="space-y-1 text-sm text-gray-600">
                                        <li>• Nomor sertifikat opsional. Kosongkan atau hapus kolomnya untuk nomor otomatis. Nomor manual harus unik.</li>
                                        <li>• Format tanggal: YYYY-MM-DD</li>
                                        <li>
                                            • Baris pertama akan diabaikan
                                            (header)
                                        </li>
                                        <li>
                                            • Urutan kolom harus sesuai variabel
                                        </li>
                                    </ul>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
