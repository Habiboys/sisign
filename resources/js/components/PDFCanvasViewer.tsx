import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eraser, PenTool, Save, Trash2 } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import QRCode from 'qrcode';
import { useCallback, useEffect, useRef, useState } from 'react';

interface PDFCanvasViewerProps {
    pdfUrl: string;
    onSave: (
        signatureData: string,
        passphrase?: string,
        signedPdfBase64?: string,
    ) => void;
    canEdit?: boolean;
    documentId: string;
}

export default function PDFCanvasViewer({
    pdfUrl,
    onSave,
    canEdit = false,
    documentId,
}: PDFCanvasViewerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [passphrase, setPassphrase] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [drawingMode, setDrawingMode] = useState<'pen' | 'eraser'>('pen');
    const [penSize, setPenSize] = useState(3);
    const [penColor, setPenColor] = useState('#000000');

    const startDrawing = useCallback(
        (e: React.MouseEvent<HTMLCanvasElement>) => {
            if (!canEdit) return;

            setIsDrawing(true);
            const canvas = canvasRef.current;
            if (!canvas) return;

            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.beginPath();
            ctx.moveTo(x, y);
        },
        [canEdit],
    );

    const draw = useCallback(
        (e: React.MouseEvent<HTMLCanvasElement>) => {
            if (!isDrawing || !canEdit) return;

            const canvas = canvasRef.current;
            if (!canvas) return;

            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            if (drawingMode === 'pen') {
                ctx.globalCompositeOperation = 'source-over';
                ctx.strokeStyle = penColor;
                ctx.lineWidth = penSize;
            } else {
                ctx.globalCompositeOperation = 'destination-out';
                ctx.lineWidth = penSize * 2;
            }

            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            ctx.lineTo(x, y);
            ctx.stroke();

            console.log('Drawing at:', {
                x,
                y,
                mode: drawingMode,
                color: penColor,
                size: penSize,
            });
        },
        [isDrawing, canEdit, drawingMode, penColor, penSize],
    );

    const stopDrawing = useCallback(() => {
        if (!isDrawing) return;
        setIsDrawing(false);
    }, [isDrawing]);

    const clearCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, []);

    const loadPDF = useCallback(async () => {
        try {
            const pdfjsLib = await import('pdfjs-dist');
            pdfjsLib.GlobalWorkerOptions.workerSrc =
                'https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js';

            const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
            setTotalPages(pdf.numPages);

            const pageData = await pdf.getPage(currentPage);
            const viewport = pageData.getViewport({ scale: 1.5 });

            const canvas = pdfCanvasRef.current;
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            canvas.width = viewport.width;
            canvas.height = viewport.height;

            const renderContext = {
                canvasContext: ctx,
                viewport: viewport,
            };

            await pageData.render(renderContext).promise;

            const signatureCanvas = canvasRef.current;
            if (signatureCanvas) {
                // Set canvas size to match PDF canvas size exactly
                signatureCanvas.width = viewport.width;
                signatureCanvas.height = viewport.height;

                // Set up canvas context
                const ctx = signatureCanvas.getContext('2d');
                if (ctx) {
                    ctx.strokeStyle = penColor;
                    ctx.lineWidth = penSize;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.globalCompositeOperation = 'source-over';
                }
            }
        } catch (error) {
            console.error('Error loading PDF:', error);
        }
    }, [pdfUrl, currentPage]);

    const handleSave = useCallback(async () => {
        if (!canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        let hasContent = false;
        let pixelCount = 0;
        for (let i = 0; i < data.length; i += 4) {
            const alpha = data[i + 3];
            if (alpha > 0) {
                hasContent = true;
                pixelCount++;
            }
        }

        console.log('Canvas check:', {
            hasContent,
            pixelCount,
            canvasSize: `${canvas.width}x${canvas.height}`,
        });

        if (!hasContent) {
            alert('Silakan buat tanda tangan terlebih dahulu');
            return;
        }

        setIsProcessing(true);

        try {
            const signatureData = canvas.toDataURL('image/png');

            console.log('Signature data length:', signatureData.length);
            console.log(
                'Signature data preview:',
                signatureData.substring(0, 100),
            );
            console.log('Canvas dimensions:', {
                width: canvas.width,
                height: canvas.height,
            });

            // Create signed PDF with signature embedded
            const response = await fetch(pdfUrl);
            const existingPdfBytes = await response.arrayBuffer();

            console.log('PDF loaded successfully:', {
                originalSize: existingPdfBytes.byteLength,
            });

            const pdfDoc = await PDFDocument.load(existingPdfBytes);
            const pages = pdfDoc.getPages();
            const page = pages[currentPage - 1];

            console.log('PDF page loaded:', {
                currentPage,
                totalPages: pages.length,
                pageSize: page.getSize(),
            });

            const { width: pageWidth, height: pageHeight } = page.getSize();

            // Embed signature image
            const signatureImage = await pdfDoc.embedPng(signatureData);
            console.log('Signature embedded successfully');

            // Canvas is rendered with scale 1.5, so we need to account for that
            // Canvas size = viewport size (with 1.5x scale)
            // PDF page size = original page size
            const canvasToPageScale = 1 / 1.5; // Since canvas is 1.5x scaled

            // Use the exact canvas dimensions for signature
            const signatureWidth = canvas.width;
            const signatureHeight = canvas.height;

            // Scale signature to match PDF dimensions
            const scaledWidth = signatureWidth * canvasToPageScale;
            const scaledHeight = signatureHeight * canvasToPageScale;

            console.log('Signature positioning:', {
                canvasSize: `${canvas.width}x${canvas.height}`,
                pageSize: `${pageWidth}x${pageHeight}`,
                canvasToPageScale: canvasToPageScale,
                scaledSize: `${scaledWidth}x${scaledHeight}`,
            });

            // Position signature at the exact same position as drawn on canvas
            page.drawImage(signatureImage, {
                x: 0,
                y: 0,
                width: scaledWidth,
                height: scaledHeight,
            });
            console.log('Signature drawn on PDF');

            // Generate QR code image with verification link
            const baseUrl = window.location.origin;
            const qrCodeData = `${baseUrl}/verify-document/${documentId}`;
            const qrCodeImageData = await QRCode.toDataURL(qrCodeData, {
                width: 60,
                margin: 1,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF',
                },
            });

            // Embed QR code image
            const qrCodeImage = await pdfDoc.embedPng(qrCodeImageData);
            console.log('QR code embedded successfully');

            // Add QR code at bottom right
            page.drawImage(qrCodeImage, {
                x: pageWidth - 80,
                y: 20,
                width: 60,
                height: 60,
            });
            console.log('QR code drawn on PDF');

            // Save the signed PDF
            const pdfBytes = await pdfDoc.save();
            console.log('PDF saved successfully:', {
                size: pdfBytes.length,
            });

            // Convert to base64 for backend storage (chunked method to avoid call stack overflow)
            let signedPdfBase64;
            try {
                console.log('Converting PDF to base64...');
                const uint8Array = new Uint8Array(pdfBytes);
                let binaryString = '';
                const chunkSize = 8192;

                for (let i = 0; i < uint8Array.length; i += chunkSize) {
                    const chunk = uint8Array.slice(i, i + chunkSize);
                    binaryString += String.fromCharCode.apply(
                        null,
                        Array.from(chunk),
                    );
                }

                signedPdfBase64 = btoa(binaryString);
                console.log('Base64 conversion successful');
            } catch (error) {
                console.error('Base64 conversion failed:', error);
                throw error;
            }

            console.log('PDF data size:', {
                originalBytes: pdfBytes.length,
                base64Length: signedPdfBase64.length,
            });

            // Test if PDF is valid by trying to reload it
            try {
                console.log('Testing PDF validation...');
                const testPdf = await PDFDocument.load(pdfBytes);
                console.log('PDF validation successful:', {
                    pageCount: testPdf.getPageCount(),
                });
            } catch (error) {
                console.error('PDF validation failed:', error);
                console.error('PDF validation error details:', {
                    message: error.message,
                    stack: error.stack,
                    name: error.name,
                });
                alert('PDF yang dihasilkan rusak: ' + error.message);
                setIsProcessing(false);
                return;
            }

            // Send to backend for storage
            onSave(signatureData, passphrase || undefined, signedPdfBase64);

            setPassphrase('');
            clearCanvas();
        } catch (error) {
            console.error('Error processing signature:', error);
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
                name: error.name,
            });
            alert('Gagal memproses tanda tangan: ' + error.message);
        } finally {
            setIsProcessing(false);
        }
    }, [onSave, passphrase, currentPage, pdfUrl, clearCanvas]);

    useEffect(() => {
        loadPDF();
    }, [loadPDF]);

    return (
        <div className="space-y-4">
            {canEdit && (
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                    <h4 className="mb-2 text-sm font-semibold text-yellow-800">
                        Instruksi:
                    </h4>
                    <ul className="space-y-1 text-xs text-yellow-700">
                        <li>
                            • Langsung gambar tanda tangan di PDF di bawah ini
                        </li>
                        <li>• Gunakan tools di bawah untuk menggambar</li>
                        <li>
                            • TTD akan langsung digambar di PDF dengan koordinat
                            yang tepat
                        </li>
                    </ul>
                </div>
            )}

            <div className="relative flex justify-center">
                <div className="relative inline-block">
                    <canvas
                        ref={pdfCanvasRef}
                        className="block rounded-lg border border-gray-300 shadow-lg"
                        style={{ maxWidth: '100%', height: 'auto' }}
                    />
                    {canEdit && (
                        <canvas
                            ref={canvasRef}
                            className="absolute inset-0 cursor-crosshair rounded-lg"
                            style={{ maxWidth: '100%', height: 'auto' }}
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                        />
                    )}
                </div>
            </div>

            {canEdit && (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-4 rounded-lg bg-gray-50 p-4">
                        <div className="flex items-center space-x-2">
                            <Button
                                variant={
                                    drawingMode === 'pen'
                                        ? 'default'
                                        : 'outline'
                                }
                                size="sm"
                                onClick={() => setDrawingMode('pen')}
                            >
                                <PenTool className="mr-1 h-4 w-4" />
                                Pen
                            </Button>
                            <Button
                                variant={
                                    drawingMode === 'eraser'
                                        ? 'default'
                                        : 'outline'
                                }
                                size="sm"
                                onClick={() => setDrawingMode('eraser')}
                            >
                                <Eraser className="mr-1 h-4 w-4" />
                                Eraser
                            </Button>
                        </div>

                        <div className="flex items-center space-x-2">
                            <Label
                                htmlFor="penSize"
                                className="text-sm font-medium"
                            >
                                Size:
                            </Label>
                            <Input
                                id="penSize"
                                type="range"
                                min="1"
                                max="10"
                                value={penSize}
                                onChange={(e) =>
                                    setPenSize(Number(e.target.value))
                                }
                                className="w-20"
                            />
                            <span className="min-w-[30px] text-sm text-gray-500">
                                {penSize}px
                            </span>
                        </div>

                        <div className="flex items-center space-x-2">
                            <Label
                                htmlFor="penColor"
                                className="text-sm font-medium"
                            >
                                Color:
                            </Label>
                            <Input
                                id="penColor"
                                type="color"
                                value={penColor}
                                onChange={(e) => setPenColor(e.target.value)}
                                className="h-8 w-12 rounded border border-gray-300 p-1"
                            />
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={clearCanvas}
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                            <Trash2 className="mr-1 h-4 w-4" />
                            Clear
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label
                                htmlFor="passphrase"
                                className="text-sm font-medium"
                            >
                                Passphrase untuk Digital Signature (Opsional)
                            </Label>
                            <Input
                                id="passphrase"
                                type="password"
                                value={passphrase}
                                onChange={(e) => setPassphrase(e.target.value)}
                                placeholder="Masukkan passphrase untuk keamanan tambahan"
                                className="w-full"
                            />
                            <p className="text-xs text-gray-500">
                                Passphrase akan digunakan untuk melindungi
                                private key digital signature Anda. Kosongkan
                                jika tidak ingin menggunakan passphrase.
                            </p>
                        </div>

                        <div className="flex items-end">
                            <Button
                                onClick={handleSave}
                                className="w-full bg-green-600 hover:bg-green-700 md:w-auto"
                                disabled={isProcessing}
                            >
                                <Save className="mr-2 h-4 w-4" />
                                {isProcessing ? 'Memproses...' : 'Simpan TTD'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col items-center justify-between gap-4 rounded-lg bg-gray-50 p-4 sm:flex-row">
                <span className="text-sm font-medium text-gray-700">
                    Halaman {currentPage} dari {totalPages}
                </span>
                <div className="flex space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            setCurrentPage(Math.max(1, currentPage - 1))
                        }
                        disabled={currentPage === 1}
                        className="min-w-[80px]"
                    >
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            setCurrentPage(
                                Math.min(totalPages, currentPage + 1),
                            )
                        }
                        disabled={currentPage === totalPages}
                        className="min-w-[80px]"
                    >
                        Next
                    </Button>
                </div>
            </div>
        </div>
    );
}
