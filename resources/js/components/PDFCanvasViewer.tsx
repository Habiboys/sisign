import AlertModal from '@/components/ui/alert-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useModal } from '@/hooks/use-modal';
import { useToast } from '@/hooks/use-toast';
import { Eraser, Image, PenTool, Save, Stamp, Trash2, X } from 'lucide-react';
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
    isTemplate?: boolean; // Add flag to differentiate template from document
    generateQRCode?: boolean;
}

export default function PDFCanvasViewer({
    pdfUrl,
    onSave,
    canEdit = false,
    documentId,
    isTemplate = false,
    generateQRCode,
}: PDFCanvasViewerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [passphrase, setPassphrase] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [drawingMode, setDrawingMode] = useState<'pen' | 'eraser' | 'stamp'>(
        'pen',
    );
    const [penSize, setPenSize] = useState(3);
    const [penColor, setPenColor] = useState('#000000');

    // Stamp states
    const [stampImage, setStampImage] = useState<string | null>(null);
    const [stampPosition, setStampPosition] = useState<{
        x: number;
        y: number;
    } | null>(null);
    const [stampSize, setStampSize] = useState(100);
    const [isDraggingStamp, setIsDraggingStamp] = useState(false);

    // Store previous canvas content to preserve drawings
    const [previousCanvasContent, setPreviousCanvasContent] = useState<
        string | null
    >(null);

    const { error } = useToast();
    const alertModal = useModal();
    const [alertData, setAlertData] = useState({
        title: '',
        description: '',
        type: 'info' as const,
    });

    const startDrawing = useCallback(
        (
            e:
                | React.MouseEvent<HTMLCanvasElement>
                | React.TouchEvent<HTMLCanvasElement>,
        ) => {
            if (!canEdit) return;

            // Prevent default to avoid scrolling on mobile
            e.preventDefault();

            setIsDrawing(true);
            const canvas = canvasRef.current;
            if (!canvas) return;

            // Handle both mouse and touch events
            let clientX: number, clientY: number;
            if (e.type === 'touchstart') {
                const touch = (e as React.TouchEvent).touches[0];
                clientX = touch.clientX;
                clientY = touch.clientY;
            } else {
                const mouse = e as React.MouseEvent;
                clientX = mouse.clientX;
                clientY = mouse.clientY;
            }

            const rect = canvas.getBoundingClientRect();
            // Use devicePixelRatio for accurate positioning on mobile
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;

            const x = (clientX - rect.left) * scaleX;
            const y = (clientY - rect.top) * scaleY;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.beginPath();
            ctx.moveTo(x, y);
        },
        [canEdit],
    );

    const draw = useCallback(
        (
            e:
                | React.MouseEvent<HTMLCanvasElement>
                | React.TouchEvent<HTMLCanvasElement>,
        ) => {
            if (!isDrawing || !canEdit) return;

            // Prevent default to avoid scrolling on mobile
            e.preventDefault();

            const canvas = canvasRef.current;
            if (!canvas) return;

            // Handle both mouse and touch events
            let clientX: number, clientY: number;
            if (e.type === 'touchmove') {
                const touch = (e as React.TouchEvent).touches[0];
                clientX = touch.clientX;
                clientY = touch.clientY;
            } else {
                const mouse = e as React.MouseEvent;
                clientX = mouse.clientX;
                clientY = mouse.clientY;
            }

            const rect = canvas.getBoundingClientRect();
            // Use devicePixelRatio for accurate positioning on mobile
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;

            const x = (clientX - rect.left) * scaleX;
            const y = (clientY - rect.top) * scaleY;

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

    // Save current canvas content
    const saveCanvasContent = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const content = canvas.toDataURL();
        setPreviousCanvasContent(content);
    }, []);

    // Stamp handling functions
    const handleStampUpload = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            if (!file) return;

            // Validate file type
            if (!file.type.startsWith('image/')) {
                setAlertData({
                    title: 'File Tidak Valid',
                    description:
                        'Hanya file gambar yang diperbolehkan (JPG, PNG, GIF)',
                    type: 'info',
                });
                alertModal.open();
                return;
            }

            // Validate file size (max 2MB)
            if (file.size > 2 * 1024 * 1024) {
                setAlertData({
                    title: 'File Terlalu Besar',
                    description: 'Ukuran file maksimal 2MB',
                    type: 'info',
                });
                alertModal.open();
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const result = e.target?.result as string;

                // Save current canvas content before adding stamp
                saveCanvasContent();

                setStampImage(result);
                setStampPosition({ x: 100, y: 100 }); // Default position
                setDrawingMode('stamp');
            };
            reader.readAsDataURL(file);
        },
        [alertModal, saveCanvasContent],
    );

    const removeStamp = useCallback(() => {
        setStampImage(null);
        setStampPosition(null);
        setDrawingMode('pen');

        // Restore previous canvas content when removing stamp
        if (previousCanvasContent) {
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    const img = new window.Image();
                    img.onload = () => {
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(img, 0, 0);
                    };
                    img.src = previousCanvasContent;
                }
            }
        }
    }, [previousCanvasContent]);

    const handleStampClick = useCallback(
        (
            e:
                | React.MouseEvent<HTMLCanvasElement>
                | React.TouchEvent<HTMLCanvasElement>,
        ) => {
            if (drawingMode !== 'stamp' || !stampImage) return;

            // Prevent default to avoid scrolling on mobile
            e.preventDefault();

            const canvas = canvasRef.current;
            if (!canvas) return;

            // Handle both mouse and touch events
            let clientX: number, clientY: number;
            if (e.type === 'touchstart') {
                const touch = (e as React.TouchEvent).touches[0];
                clientX = touch.clientX;
                clientY = touch.clientY;
            } else {
                const mouse = e as React.MouseEvent;
                clientX = mouse.clientX;
                clientY = mouse.clientY;
            }

            const rect = canvas.getBoundingClientRect();
            // Use devicePixelRatio for accurate positioning on mobile
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;

            const x = (clientX - rect.left) * scaleX;
            const y = (clientY - rect.top) * scaleY;

            console.log('Stamp clicked at:', {
                x,
                y,
                canvasSize: `${canvas.width}x${canvas.height}`,
                scaleX,
                scaleY,
            });
            setStampPosition({ x, y });
        },
        [drawingMode, stampImage],
    );

    // Handle wheel scroll for stamp resizing
    const handleWheel = useCallback(
        (e: React.WheelEvent<HTMLCanvasElement>) => {
            if (drawingMode !== 'stamp' || !stampImage) return;

            e.preventDefault();

            // Increase/decrease stamp size based on wheel direction
            const delta = e.deltaY > 0 ? -10 : 10;
            const newSize = Math.max(50, Math.min(300, stampSize + delta));

            setStampSize(newSize);

            console.log('Stamp size changed:', {
                oldSize: stampSize,
                newSize,
                delta,
            });
        },
        [drawingMode, stampImage, stampSize],
    );

    const clearAll = useCallback(() => {
        clearCanvas();
        if (stampImage) {
            removeStamp();
        }
        // Reset canvas content state
        setPreviousCanvasContent(null);
    }, [clearCanvas, stampImage, removeStamp]);

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
            setAlertData({
                title: 'Belum Ada Tanda Tangan',
                description: 'Silakan buat tanda tangan terlebih dahulu.',
                type: 'info',
            });
            alertModal.open();
            return;
        }

        // Validate passphrase is required
        if (!passphrase || passphrase.trim() === '') {
            setAlertData({
                title: 'Passphrase Diperlukan',
                description:
                    'Passphrase harus diisi untuk keamanan digital signature.',
                type: 'info',
            });
            alertModal.open();
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

            // Embed stamp if exists
            if (stampImage && stampPosition) {
                let stampImageEmbedded;
                try {
                    // Try PNG first
                    stampImageEmbedded = await pdfDoc.embedPng(stampImage);
                    console.log('Stamp embedded as PNG successfully');
                } catch (pngError) {
                    try {
                        // Try JPEG if PNG fails
                        stampImageEmbedded = await pdfDoc.embedJpg(stampImage);
                        console.log('Stamp embedded as JPEG successfully');
                    } catch (jpegError) {
                        console.error('Failed to embed stamp:', {
                            pngError,
                            jpegError,
                        });
                        setAlertData({
                            title: 'Format Stempel Tidak Didukung',
                            description:
                                'Format gambar stempel tidak didukung. Gunakan PNG atau JPG.',
                            type: 'info',
                        });
                        alertModal.open();
                        return;
                    }
                }

                // Scale stamp position and size to match PDF coordinates
                const scaledStampX = stampPosition.x * canvasToPageScale;
                const scaledStampY =
                    (canvas.height - stampPosition.y) * canvasToPageScale; // Flip Y coordinate
                const scaledStampSize = stampSize * canvasToPageScale;

                console.log('Stamp positioning:', {
                    originalPosition: stampPosition,
                    originalSize: stampSize,
                    scaledPosition: { x: scaledStampX, y: scaledStampY },
                    scaledSize: scaledStampSize,
                });

                page.drawImage(stampImageEmbedded, {
                    x: scaledStampX - scaledStampSize / 2,
                    y: scaledStampY - scaledStampSize / 2,
                    width: scaledStampSize,
                    height: scaledStampSize,
                });
                console.log('Stamp drawn on PDF');
            }

            // Embed QR code if exists (only for documents, templates are handled by backend)
            // Use generateQRCode prop if provided, otherwise fallback to !isTemplate
            const shouldGenerateQR = generateQRCode !== undefined ? generateQRCode : !isTemplate;

            if (shouldGenerateQR) {
                // Generate QR code image with verification link
                const baseUrl = window.location.origin;
                const qrCodeData = `${baseUrl}/verify-document/${documentId}`;
                console.log('QR Code data:', qrCodeData);
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
            }

            // Save the signed PDF with object streams disabled for FPDI compatibility
            const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
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
                const errorMessage =
                    error instanceof Error ? error.message : 'Unknown error';
                console.error('PDF validation error details:', {
                    message: errorMessage,
                    stack: error instanceof Error ? error.stack : undefined,
                    name: error instanceof Error ? error.name : 'Unknown',
                });
                setAlertData({
                    title: 'PDF Rusak',
                    description: 'PDF yang dihasilkan rusak: ' + errorMessage,
                    type: 'info',
                });
                alertModal.open();
                setIsProcessing(false);
                return;
            }

            // Send to backend for storage
            onSave(signatureData, passphrase || undefined, signedPdfBase64);

            setPassphrase('');
            clearCanvas();
        } catch (error) {
            console.error('Error processing signature:', error);

            let errorMessage = 'Unknown error';
            let errorTitle = 'Gagal Memproses';

            if (error instanceof Error) {
                errorMessage = error.message;

                // Specific error messages for common issues
                if (error.message.includes('not a PNG file')) {
                    errorTitle = 'Format Gambar Tidak Didukung';
                    errorMessage =
                        'Format gambar stempel tidak didukung. Gunakan PNG atau JPG.';
                } else if (error.message.includes('not a JPEG file')) {
                    errorTitle = 'Format JPEG Tidak Valid';
                    errorMessage = 'File JPEG tidak valid atau rusak.';
                } else if (error.message.includes('Maximum call stack')) {
                    errorTitle = 'File Terlalu Besar';
                    errorMessage = 'File PDF terlalu besar untuk diproses.';
                }
            }

            console.error('Error details:', {
                message: errorMessage,
                stack: error instanceof Error ? error.stack : undefined,
                name: error instanceof Error ? error.name : 'Unknown',
            });

            setAlertData({
                title: errorTitle,
                description: errorMessage,
                type: 'info',
            });
            alertModal.open();
        } finally {
            setIsProcessing(false);
        }
    }, [onSave, passphrase, currentPage, pdfUrl, clearCanvas]);

    useEffect(() => {
        loadPDF();
    }, [loadPDF]);

    // Redraw stamp only (preserve existing drawings)
    const redrawStamp = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // If we have previous content, restore it first
        if (previousCanvasContent) {
            const img = new window.Image();
            img.onload = () => {
                // Clear canvas and restore previous content
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);

                // Then draw stamp on top if exists
                if (stampImage && stampPosition) {
                    const stampImg = new window.Image();
                    stampImg.onload = () => {
                        const stampX = stampPosition.x - stampSize / 2;
                        const stampY = stampPosition.y - stampSize / 2;

                        ctx.drawImage(
                            stampImg,
                            stampX,
                            stampY,
                            stampSize,
                            stampSize,
                        );
                    };
                    stampImg.src = stampImage;
                }
            };
            img.src = previousCanvasContent;
        } else if (stampImage && stampPosition) {
            // No previous content, just draw stamp
            const img = new window.Image();
            img.onload = () => {
                const stampX = stampPosition.x - stampSize / 2;
                const stampY = stampPosition.y - stampSize / 2;

                ctx.drawImage(img, stampX, stampY, stampSize, stampSize);
            };
            img.src = stampImage;
        }
    }, [stampImage, stampPosition, stampSize, previousCanvasContent]);

    // Render stamp on canvas
    useEffect(() => {
        redrawStamp();
    }, [redrawStamp]);

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
                            • Upload stempel/gambar untuk menambah stempel resmi
                        </li>
                        <li>
                            • Klik tombol "Stempel" lalu klik di PDF untuk
                            menempatkan stempel
                        </li>
                        <li>
                            • Perbesar/perkecil stempel dengan scroll mouse atau
                            slider
                        </li>
                        <li>
                            •{' '}
                            <span className="font-medium text-red-600">
                                Passphrase wajib diisi
                            </span>{' '}
                            untuk keamanan digital signature
                        </li>
                        <li>
                            • PDF yang dihasilkan akan memiliki:{' '}
                            <span className="font-medium text-green-600">
                                Tanda tangan fisik (gambar) + QR Code verifikasi
                                digital
                            </span>
                        </li>
                        <li>
                            • TTD dan stempel akan langsung digambar di PDF
                            dengan koordinat yang tepat
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
                            className={`absolute inset-0 rounded-lg ${drawingMode === 'stamp'
                                ? 'cursor-move'
                                : 'cursor-crosshair'
                                }`}
                            style={{
                                maxWidth: '100%',
                                height: 'auto',
                                touchAction: 'none',
                                userSelect: 'none',
                                WebkitUserSelect: 'none',
                                WebkitTouchCallout: 'none',
                            }}
                            onMouseDown={
                                drawingMode === 'stamp'
                                    ? handleStampClick
                                    : startDrawing
                            }
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            onTouchStart={
                                drawingMode === 'stamp'
                                    ? handleStampClick
                                    : startDrawing
                            }
                            onTouchMove={draw}
                            onTouchEnd={stopDrawing}
                            onWheel={handleWheel}
                        />
                    )}
                </div>
            </div>

            {canEdit && (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 p-2 sm:gap-4 sm:p-4">
                        <div className="flex items-center space-x-2">
                            <Button
                                variant={
                                    drawingMode === 'pen'
                                        ? 'default'
                                        : 'outline'
                                }
                                size="sm"
                                className="px-2 text-xs sm:px-3 sm:text-sm"
                                onClick={() => setDrawingMode('pen')}
                            >
                                <PenTool className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                                <span className="hidden sm:inline">Pen</span>
                            </Button>
                            <Button
                                variant={
                                    drawingMode === 'eraser'
                                        ? 'default'
                                        : 'outline'
                                }
                                size="sm"
                                className="px-2 text-xs sm:px-3 sm:text-sm"
                                onClick={() => setDrawingMode('eraser')}
                            >
                                <Eraser className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                                <span className="hidden sm:inline">Eraser</span>
                            </Button>
                        </div>

                        {/* Stamp Controls */}
                        <div className="flex items-center space-x-2">
                            <Button
                                variant={
                                    drawingMode === 'stamp'
                                        ? 'default'
                                        : 'outline'
                                }
                                size="sm"
                                className={`px-2 text-xs sm:px-3 sm:text-sm ${drawingMode === 'stamp'
                                    ? 'bg-blue-600 text-white'
                                    : ''
                                    }`}
                                onClick={() =>
                                    stampImage && setDrawingMode('stamp')
                                }
                                disabled={!stampImage}
                            >
                                <Stamp className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                                <span className="hidden sm:inline">
                                    {drawingMode === 'stamp'
                                        ? 'Mode Stempel'
                                        : 'Stempel'}
                                </span>
                                <span className="sm:hidden">
                                    {drawingMode === 'stamp' ? 'Stempel' : 'ST'}
                                </span>
                            </Button>

                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleStampUpload}
                                className="hidden"
                                id="stamp-upload"
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                className="px-2 text-xs sm:px-3 sm:text-sm"
                                onClick={() =>
                                    document
                                        .getElementById('stamp-upload')
                                        ?.click()
                                }
                            >
                                <Image className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                                <span className="hidden sm:inline">
                                    Upload Gambar
                                </span>
                                <span className="sm:hidden">Upload</span>
                            </Button>

                            {stampImage && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 sm:px-3 sm:text-sm"
                                    onClick={removeStamp}
                                >
                                    <X className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                                    <span className="hidden sm:inline">
                                        Hapus
                                    </span>
                                </Button>
                            )}
                        </div>

                        <div className="flex items-center space-x-1 sm:space-x-2">
                            <Label
                                htmlFor="penSize"
                                className="text-xs font-medium sm:text-sm"
                            >
                                <span className="hidden sm:inline">Size:</span>
                                <span className="sm:hidden">S:</span>
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
                                className="w-12 sm:w-20"
                            />
                            <span className="min-w-[25px] text-xs text-gray-500 sm:min-w-[30px] sm:text-sm">
                                {penSize}
                            </span>
                        </div>

                        <div className="flex items-center space-x-1 sm:space-x-2">
                            <Label
                                htmlFor="penColor"
                                className="text-xs font-medium sm:text-sm"
                            >
                                <span className="hidden sm:inline">Color:</span>
                                <span className="sm:hidden">C:</span>
                            </Label>
                            <Input
                                id="penColor"
                                type="color"
                                value={penColor}
                                onChange={(e) => setPenColor(e.target.value)}
                                className="h-6 w-8 rounded border border-gray-300 p-1 sm:h-8 sm:w-12"
                            />
                        </div>

                        {/* Stamp Size Controls - Only show when stamp is active */}
                        {stampImage && (
                            <div className="flex flex-col space-y-2">
                                <div className="flex items-center space-x-1 sm:space-x-2">
                                    <Label
                                        htmlFor="stampSize"
                                        className="text-xs font-medium sm:text-sm"
                                    >
                                        <span className="hidden sm:inline">
                                            Size:
                                        </span>
                                        <span className="sm:hidden">S:</span>
                                    </Label>
                                    <Input
                                        id="stampSize"
                                        type="range"
                                        min="30"
                                        max="300"
                                        step="10"
                                        value={stampSize}
                                        onChange={(e) =>
                                            setStampSize(Number(e.target.value))
                                        }
                                        className="w-16 sm:w-24"
                                    />
                                    <span className="min-w-[25px] text-xs text-gray-500 sm:min-w-[30px] sm:text-sm">
                                        {stampSize}px
                                    </span>
                                </div>

                                {/* Quick Size Presets */}
                                <div className="flex items-center space-x-1">
                                    <span className="text-xs text-gray-500">
                                        Quick:
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-6 px-2 text-xs"
                                        onClick={() => setStampSize(50)}
                                    >
                                        S
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-6 px-2 text-xs"
                                        onClick={() => setStampSize(100)}
                                    >
                                        M
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-6 px-2 text-xs"
                                        onClick={() => setStampSize(150)}
                                    >
                                        L
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-6 px-2 text-xs"
                                        onClick={() => setStampSize(200)}
                                    >
                                        XL
                                    </Button>
                                </div>
                            </div>
                        )}

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={clearAll}
                            className="px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 sm:px-3 sm:text-sm"
                        >
                            <Trash2 className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                            <span className="hidden sm:inline">Clear</span>
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label
                                htmlFor="passphrase"
                                className="text-xs font-medium sm:text-sm"
                            >
                                <span className="hidden sm:inline">
                                    Passphrase untuk Digital Signature
                                    <span className="ml-1 font-medium text-red-500">
                                        *
                                    </span>
                                </span>
                                <span className="sm:hidden">
                                    Passphrase
                                    <span className="ml-1 font-medium text-red-500">
                                        *
                                    </span>
                                </span>
                            </Label>
                            <Input
                                id="passphrase"
                                type="password"
                                value={passphrase}
                                onChange={(e) => setPassphrase(e.target.value)}
                                placeholder="Masukkan passphrase (wajib diisi)"
                                className="w-full"
                                required
                            />
                            <p className="text-xs text-gray-500">
                                <span className="hidden sm:inline">
                                    Passphrase wajib diisi untuk melindungi
                                    private key digital signature Anda.
                                    <span className="font-medium text-red-500">
                                        *
                                    </span>
                                </span>
                                <span className="sm:hidden">
                                    Wajib diisi untuk keamanan digital
                                    signature.
                                    <span className="font-medium text-red-500">
                                        *
                                    </span>
                                </span>
                            </p>
                        </div>

                        <div className="flex items-end">
                            <Button
                                onClick={handleSave}
                                className="w-full bg-green-600 px-3 py-2 text-xs hover:bg-green-700 sm:px-4 sm:text-sm md:w-auto"
                                disabled={isProcessing}
                            >
                                <Save className="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
                                {isProcessing ? 'Memproses...' : 'Simpan TTD'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col items-center justify-between gap-2 rounded-lg bg-gray-50 p-2 sm:flex-row sm:gap-4 sm:p-4">
                <span className="text-xs font-medium text-gray-700 sm:text-sm">
                    Halaman {currentPage} dari {totalPages}
                </span>
                <div className="flex space-x-1 sm:space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            setCurrentPage(Math.max(1, currentPage - 1))
                        }
                        disabled={currentPage === 1}
                        className="min-w-[60px] text-xs sm:min-w-[80px] sm:text-sm"
                    >
                        <span className="hidden sm:inline">Previous</span>
                        <span className="sm:hidden">Prev</span>
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
                        className="min-w-[60px] text-xs sm:min-w-[80px] sm:text-sm"
                    >
                        Next
                    </Button>
                </div>
            </div>

            {/* Alert Modal */}
            <AlertModal
                open={alertModal.isOpen}
                onClose={alertModal.close}
                title={alertData.title}
                description={alertData.description}
                type={alertData.type}
            />
        </div>
    );
}
