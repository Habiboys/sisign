import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Head, router, useForm } from '@inertiajs/react';
import { Plus, Save, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
}

interface VariablePosition {
    name: string;
    x: number;
    y: number;
    x_pct?: number;
    y_pct?: number;
    fontSize?: number;
    fontFamily?: string;
    alignment?: 'L' | 'C' | 'R';
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
        template.variable_positions || []
    );
    const [selectedVariable, setSelectedVariable] = useState<number | null>(null);
    const [isAddingVariable, setIsAddingVariable] = useState(false);
    const [newVariableName, setNewVariableName] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const dragStateRef = useRef<{
        index: number;
        moved: boolean;
        startX: number;
        startY: number;
    } | null>(null);
    const justDraggedRef = useRef(false);

    const { data, setData, post, processing, transform } = useForm({
        variable_positions: variables,
    });

    useEffect(() => {
        // Load PDF from signed template path using route
        if (template.signed_template_path && template.id) {
            // Use route to serve PDF instead of direct storage access
            const url = `/templates/${template.id}/signed-pdf`;
            setPdfUrl(url);
        }
    }, [template]);

    const loadPDF = useCallback(async () => {
        if (!pdfUrl || !pdfCanvasRef.current || !overlayCanvasRef.current) return;

        try {
            const pdfjsLib = await import('pdfjs-dist');
            pdfjsLib.GlobalWorkerOptions.workerSrc =
                'https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js';

            const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
            setTotalPages(pdf.numPages);

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
            drawVariables();
        } catch (err) {
            console.error('Error loading PDF:', err);
            error('Gagal memuat PDF template');
        }
    }, [pdfUrl, currentPage]); // Removed variables dependency

    const drawVariables = useCallback(() => {
        const canvas = overlayCanvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear overlay
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw markers
        variables.forEach((variable, index) => {
            // Scale is 1 because canvas width matches viewport width set in loadPDF
            // But we need to be careful if variables.x/y were saved with a different scale?
            // Assuming variables.x/y are in canvas coordinates (which they are from handleCanvasClick)

            // If using percentage, recalculate x/y
            let x = variable.x;
            let y = variable.y;

            if (variable.x_pct !== undefined && variable.y_pct !== undefined) {
                x = variable.x_pct * canvas.width;
                y = variable.y_pct * canvas.height;
            }

            // Draw marker circle
            ctx.fillStyle = index === selectedVariable ? 'rgba(59, 130, 246, 0.8)' : 'rgba(239, 68, 68, 0.8)';
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, 2 * Math.PI);
            ctx.fill();

            // Draw label
            ctx.fillStyle = '#000';

            const fontSize = (variable.fontSize || 12) * 1.5;
            const fontFamily = variable.fontFamily || 'Arial';
            ctx.font = `${fontSize}px ${fontFamily}`;

            ctx.fillText(variable.name, x + 12, y + (fontSize / 3));
        });
    }, [variables, selectedVariable]);

    // Re-draw variables when they change
    useEffect(() => {
        drawVariables();
    }, [drawVariables]);

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

        return { x, y, x_pct: x / canvas.width, y_pct: y / canvas.height };
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
            const distance = Math.hypot(x - vx, y - vy);
            if (distance <= hitRadius) {
                return i;
            }
        }
        return null;
    };

    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
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
        if (!canvas || isAddingVariable) return;

        const { x, y } = getCanvasCoords(e, canvas);
        const hitIndex = findVariableAtPosition(x, y, canvas);

        if (hitIndex === null) return;

        canvas.setPointerCapture(e.pointerId);
        dragStateRef.current = {
            index: hitIndex,
            moved: false,
            startX: x,
            startY: y,
        };
        setIsDragging(true);
        setSelectedVariable(hitIndex);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = overlayCanvasRef.current;
        const dragState = dragStateRef.current;
        if (!canvas || !dragState) return;

        const { x, y, x_pct, y_pct } = getCanvasCoords(e, canvas);

        // Only start visually dragging once the pointer has moved a couple
        // pixels, so a plain click doesn't get treated as a (no-op) drag.
        if (
            !dragState.moved &&
            Math.hypot(x - dragState.startX, y - dragState.startY) < 3
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
    };

    const handleAddVariable = () => {
        if (!newVariableName.trim()) {
            error('Nama variabel tidak boleh kosong');
            return;
        }
        setIsAddingVariable(true);
    };

    const handleSave = () => {
        if (variables.length === 0) {
            error('Minimal harus ada 1 variabel');
            return;
        }

        transform((data) => ({
            ...data,
            variable_positions: variables,
        }));

        post(`/templates/${template.id}/save-variable-positions`, {
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                // Backend flashes a success message, shown automatically by
                // the app layout - don't show a second toast here.
                // Auto download template Excel setelah save
                setTimeout(() => {
                    window.open(
                        `/templates/${template.id}/download-excel-template`,
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
        if (selectedVariable === index) {
            setSelectedVariable(null);
        }
    };

    const handleUpdateVariable = (index: number, field: keyof VariablePosition, value: any) => {
        const updated = [...variables];
        updated[index] = {
            ...updated[index],
            [field]: value,
        };
        setVariables(updated);
    };

    return (
        <AppLayout>
            <Head title={`Map Variables - ${template.title}`} />
            <div className="flex h-full flex-1 flex-col gap-6 overflow-x-auto rounded-xl p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">
                            Mapping Variabel Template
                        </h1>
                        <p className="text-gray-600">
                            Tambahkan variabel lalu seret (drag) langsung di
                            PDF untuk mengatur posisinya
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => router.visit(`/templates/${template.id}`)}
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

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    {/* PDF Canvas */}
                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Template PDF</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                    setCurrentPage(Math.max(1, currentPage - 1))
                                                }
                                                disabled={currentPage === 1}
                                            >
                                                Sebelumnya
                                            </Button>
                                            <span className="flex items-center px-4">
                                                Halaman {currentPage} / {totalPages}
                                            </span>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                    setCurrentPage(
                                                        Math.min(totalPages, currentPage + 1)
                                                    )
                                                }
                                                disabled={currentPage === totalPages}
                                            >
                                                Selanjutnya
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="relative border border-gray-300 rounded-lg overflow-auto bg-gray-50">
                                        <div className="relative inline-block">
                                            <canvas
                                                ref={pdfCanvasRef}
                                                style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
                                            />
                                            <canvas
                                                ref={overlayCanvasRef}
                                                onClick={handleCanvasClick}
                                                onPointerDown={handlePointerDown}
                                                onPointerMove={handlePointerMove}
                                                onPointerUp={handlePointerUp}
                                                className={`absolute top-0 left-0 ${
                                                    isAddingVariable
                                                        ? 'cursor-crosshair'
                                                        : isDragging
                                                          ? 'cursor-grabbing'
                                                          : 'cursor-grab'
                                                }`}
                                                style={{ maxWidth: '100%', height: 'auto', touchAction: 'none' }}
                                            />
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-500">
                                        {isAddingVariable
                                            ? `Klik pada PDF untuk menambahkan variabel "${newVariableName}"`
                                            : 'Seret (drag) titik merah/biru untuk memindahkan posisi variabel, atau klik untuk memilih & mengatur font-nya.'}
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
                                        {['nomor_sertif', 'nama_lengkap', 'tanggal_terbit', 'jabatan', 'departemen'].map((varName) => (
                                            <Button
                                                key={varName}
                                                variant="outline"
                                                size="sm"
                                                onClick={() => addStandardVariable(varName)}
                                                className="text-xs"
                                                disabled={variables.some(v => v.name === varName)}
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
                                            onChange={(e) => setNewVariableName(e.target.value)}
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
                                </div>

                                {/* Variable List */}
                                <div className="space-y-3 max-h-96 overflow-y-auto">
                                    {variables.map((variable, index) => (
                                        <Card
                                            key={index}
                                            onClick={() =>
                                                setSelectedVariable(
                                                    selectedVariable === index
                                                        ? null
                                                        : index,
                                                )
                                            }
                                            className={`cursor-pointer p-3 transition-colors ${selectedVariable === index
                                                ? 'border-blue-500 bg-blue-50'
                                                : 'hover:border-gray-300'
                                                }`}
                                        >
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <Label className="font-semibold">
                                                        {variable.name}
                                                    </Label>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteVariable(index);
                                                        }}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                    </Button>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    <div>
                                                        <span className="text-gray-500">X:</span>{' '}
                                                        {Math.round(variable.x)}
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">Y:</span>{' '}
                                                        {Math.round(variable.y)}
                                                    </div>
                                                </div>
                                                <div
                                                    className="space-y-2"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <div>
                                                        <Label className="text-xs">
                                                            Ukuran Font
                                                        </Label>
                                                        <Input
                                                            type="number"
                                                            min="8"
                                                            max="72"
                                                            value={variable.fontSize || 12}
                                                            onChange={(e) =>
                                                                handleUpdateVariable(
                                                                    index,
                                                                    'fontSize',
                                                                    parseInt(e.target.value) || 12
                                                                )
                                                            }
                                                            className="h-8 text-xs"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label className="text-xs">Jenis Font</Label>
                                                        <Select
                                                            value={variable.fontFamily || 'Arial'}
                                                            onValueChange={(value) =>
                                                                handleUpdateVariable(
                                                                    index,
                                                                    'fontFamily',
                                                                    value
                                                                )
                                                            }
                                                        >
                                                            <SelectTrigger className="h-8 text-xs">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="Arial">Arial</SelectItem>
                                                                <SelectItem value="Times">Times</SelectItem>
                                                                <SelectItem value="Courier">Courier</SelectItem>
                                                                <SelectItem value="Helvetica">Helvetica</SelectItem>
                                                                <SelectItem value="Times-Roman">Times Roman</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div>
                                                        <Label className="text-xs">Alignment</Label>
                                                        <Select
                                                            value={variable.alignment || 'C'}
                                                            onValueChange={(value: 'L' | 'C' | 'R') =>
                                                                handleUpdateVariable(
                                                                    index,
                                                                    'alignment',
                                                                    value
                                                                )
                                                            }
                                                        >
                                                            <SelectTrigger className="h-8 text-xs">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="L">Kiri</SelectItem>
                                                                <SelectItem value="C">Tengah</SelectItem>
                                                                <SelectItem value="R">Kanan</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                                {selectedVariable === index && (
                                                    <p className="text-xs text-blue-600">
                                                        Terpilih — seret
                                                        titik biru di PDF
                                                        untuk memindahkan
                                                        posisinya.
                                                    </p>
                                                )}
                                            </div>
                                        </Card>
                                    ))}
                                </div>

                                {variables.length === 0 && (
                                    <p className="text-sm text-gray-500 text-center py-4">
                                        Belum ada variabel. Tambahkan variabel baru di atas.
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

