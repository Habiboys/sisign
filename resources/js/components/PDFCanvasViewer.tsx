import AlertModal from '@/components/ui/alert-modal';
import { Button } from '@/components/ui/button';
import ConfirmModal from '@/components/ui/confirm-modal';
import { Input } from '@/components/ui/input';
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from '@/components/ui/input-otp';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useModal } from '@/hooks/use-modal';
import { useToast } from '@/hooks/use-toast';
import { type SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import {
    ChevronDown,
    ChevronUp,
    Eraser,
    Image,
    PenTool,
    QrCode,
    Save,
    Stamp,
    Trash2,
    X,
} from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import QRCode from 'qrcode';
import { useCallback, useEffect, useRef, useState } from 'react';

// Logo shown in the middle of generated verification QR codes. Uses the
// site logo for now, per product decision.
const QR_LOGO_SRC = '/images/sisign-logo-only.png';

/**
 * Renders a verification QR code (high error-correction so it still scans
 * with a logo punched into the middle) with the app logo centered on top.
 */
async function generateQrCodeWithLogo(
    data: string,
    size = 240,
): Promise<string> {
    const qrDataUrl = await QRCode.toDataURL(data, {
        width: size,
        margin: 1,
        errorCorrectionLevel: 'H',
        color: { dark: '#000000', light: '#FFFFFF' },
    });

    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            resolve(qrDataUrl);
            return;
        }

        const qrImg = new window.Image();
        qrImg.onload = () => {
            ctx.drawImage(qrImg, 0, 0, size, size);

            const logoImg = new window.Image();
            logoImg.onload = () => {
                const logoSize = size * 0.24;
                const padding = logoSize * 0.14;
                const logoX = (size - logoSize) / 2;
                const logoY = (size - logoSize) / 2;
                const bgX = logoX - padding;
                const bgY = logoY - padding;
                const bgSize = logoSize + padding * 2;
                const radius = 8;

                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.moveTo(bgX + radius, bgY);
                ctx.arcTo(bgX + bgSize, bgY, bgX + bgSize, bgY + bgSize, radius);
                ctx.arcTo(bgX + bgSize, bgY + bgSize, bgX, bgY + bgSize, radius);
                ctx.arcTo(bgX, bgY + bgSize, bgX, bgY, radius);
                ctx.arcTo(bgX, bgY, bgX + bgSize, bgY, radius);
                ctx.closePath();
                ctx.fill();

                ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
                resolve(canvas.toDataURL('image/png'));
            };
            // Logo failing to load shouldn't block signing - fall back to a
            // plain QR code without the logo.
            logoImg.onerror = () => resolve(qrDataUrl);
            logoImg.src = QR_LOGO_SRC;
        };
        qrImg.onerror = () => reject(new Error('Gagal memuat kode QR.'));
        qrImg.src = qrDataUrl;
    });
}

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

    // QR verification barcode (dropped on the PDF like a stamp, movable/resizable)
    const [barcodeData, setBarcodeData] = useState<string | null>(null);

    // Store previous canvas content to preserve drawings
    const [previousCanvasContent, setPreviousCanvasContent] = useState<
        string | null
    >(null);

    // Advanced tools (color, eraser, manual stamp upload/resize) are hidden
    // by default to keep the primary flow simple for less tech-savvy users.
    const [showAdvancedTools, setShowAdvancedTools] = useState(false);

    // Step-by-step flow: choose how to sign first, then enter PIN & save.
    const [flowStep, setFlowStep] = useState<'choose' | 'sign' | 'pin'>(
        'choose',
    );

    // PIN is entered inside the confirmation modal, right before saving.
    const [confirmPin, setConfirmPin] = useState('');

    const { auth } = usePage<SharedData>().props;
    const { error, info } = useToast();
    const alertModal = useModal();
    const confirmSaveModal = useModal();
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
        // A short touch/mouse-up ends a stroke: if the user drew at least one
        // stroke, offer the PIN step. Deferring keeps a single tap from
        // advancing the flow.
        setFlowStep('pin');
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
                info('Hanya file gambar yang diperbolehkan (JPG, PNG, GIF)');
                return;
            }

            // Validate file size (max 2MB)
            if (file.size > 2 * 1024 * 1024) {
                info('Ukuran file maksimal 2MB');
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

    // After the user has drawn their signature, move them to the PIN step
    const finishDrawing = useCallback(() => {
        if (!isDrawing) return;
        setIsDrawing(false);
        setFlowStep('pin');
    }, [isDrawing]);

    // Go back from the PIN step to redo the signature
    const backToDrawing = useCallback(() => {
        setFlowStep('sign');
        // Keep existing drawing so the user can adjust rather than start over
        if (barcodeData) {
            setDrawingMode('stamp');
        } else if (stampImage) {
            setDrawingMode('stamp');
        } else {
            setDrawingMode('pen');
        }
    }, [barcodeData, stampImage]);

    const removeStamp = useCallback(() => {
        setStampImage(null);
        setBarcodeData(null);
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

    const handleUseSavedSignature = useCallback(() => {
        if (!auth.user.signature_image) {
            info('Anda belum mengupload tanda tangan di profil Anda.');
            return;
        }

        const signatureUrl = `/storage/${auth.user.signature_image}`;

        // Load image and set as stamp
        const img = new window.Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            // Create a canvas to convert image to data URL if needed
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0);
                const dataUrl = canvas.toDataURL('image/png');

                saveCanvasContent();
                setStampImage(dataUrl);
                setStampPosition({ x: 100, y: 100 });
                setDrawingMode('stamp');
                // Adjust stamp size logic if needed, maybe fit to reasonable size
                setStampSize(150);
                setFlowStep('pin');
            }
        };
        img.onerror = () => {
            error('Gagal memuat gambar tanda tangan tersimpan.');
        };
        img.src = signatureUrl;
    }, [auth.user.signature_image, alertModal, saveCanvasContent]);

    // Switch to barcode-only mode: generate the verification QR in the
    // browser, load it as the "stamp" so the user can click/drag/resize it on
    // the PDF exactly like a stamp, then sign with just the barcode.
    const useBarcodeOnly = useCallback(async () => {
        try {
            const baseUrl = window.location.origin;
            const qrCodeData = `${baseUrl}/verify-document/${documentId}`;
            const qrCodeImageData = await generateQrCodeWithLogo(qrCodeData, 240);

            saveCanvasContent();
            setBarcodeData(qrCodeImageData);
            setStampImage(qrCodeImageData);
            setStampPosition({ x: 150, y: 150 });
            setStampSize(140);
            setDrawingMode('stamp');
            setFlowStep('pin');
        } catch (err) {
            console.error('Failed to generate barcode:', err);
            error('Gagal membuat barcode verifikasi.');
        }
    }, [documentId, saveCanvasContent, error]);



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
            info('Silakan buat tanda tangan atau gunakan stempel terlebih dahulu.');
            return;
        }

        // Open the confirmation modal where the 6-digit PIN is entered, so
        // signing happens in a single explicit step.
        setConfirmPin('');
        confirmSaveModal.open();
    }, [info, confirmSaveModal]);

    const performSave = useCallback(async () => {
        if (!canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

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
                        info('Format gambar stempel tidak didukung. Gunakan PNG atau JPG.');
                        return;
                    }
                }

                // Scale stamp position and size to match PDF coordinates
                const embedDims = stampImageEmbedded.scale(1);
                const ratio = embedDims.width / embedDims.height;
                const scaledStampX = stampPosition.x * canvasToPageScale;
                const scaledStampY =
                    (canvas.height - stampPosition.y) * canvasToPageScale; // Flip Y coordinate
                const scaledStampSize = stampSize * canvasToPageScale;
                const pdfDrawWidth = scaledStampSize;
                const pdfDrawHeight = scaledStampSize / ratio;

                console.log('Stamp positioning:', {
                    originalPosition: stampPosition,
                    originalSize: stampSize,
                    scaledPosition: { x: scaledStampX, y: scaledStampY },
                    scaledSize: scaledStampSize,
                    ratio,
                    pdfDrawWidth,
                    pdfDrawHeight,
                });

                page.drawImage(stampImageEmbedded, {
                    x: scaledStampX - pdfDrawWidth / 2,
                    y: scaledStampY - pdfDrawHeight / 2,
                    width: pdfDrawWidth,
                    height: pdfDrawHeight,
                });
                console.log('Stamp drawn on PDF');
            }

            // Embed QR code if exists (only for documents, templates are handled by backend)
            // Use generateQRCode prop if provided, otherwise fallback to !isTemplate
            const shouldGenerateQR = generateQRCode !== undefined ? generateQRCode : !isTemplate;

            // When the user placed the barcode themselves (barcode-only mode),
            // the QR is already the signature stamp - don't add a duplicate
            // automatic one in the corner.
            if (shouldGenerateQR && !barcodeData) {
                // Generate QR code image with verification link (with logo)
                const baseUrl = window.location.origin;
                const qrCodeData = `${baseUrl}/verify-document/${documentId}`;
                console.log('QR Code data:', qrCodeData);
                const qrCodeImageData = await generateQrCodeWithLogo(
                    qrCodeData,
                    120,
                );

                // Embed QR code image
                const qrCodeImage = await pdfDoc.embedPng(qrCodeImageData);
                console.log('QR code embedded successfully');

                // Add QR code at bottom right
                page.drawImage(qrCodeImage, {
                    x: pageWidth - 100,
                    y: 20,
                    width: 80,
                    height: 80,
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
            } catch (err: any) {
                console.error('Base64 conversion failed:', err);
                throw err;
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
            } catch (err: any) {
                console.error('PDF validation failed:', err);
                const errorMessage =
                    err instanceof Error ? err.message : 'Unknown error';
                console.error('PDF validation error details:', {
                    message: errorMessage,
                    stack: err instanceof Error ? err.stack : undefined,
                    name: err instanceof Error ? err.name : 'Unknown',
                });
                error('PDF yang dihasilkan rusak: ' + errorMessage);
                setIsProcessing(false);
                return;
            }

            // Send to backend for storage
            onSave(signatureData, confirmPin || undefined, signedPdfBase64);

            setConfirmPin('');
            clearCanvas();
        } catch (err) {
            console.error('Error processing signature:', err);

            let errorMessage = 'Unknown error';
            let errorTitle = 'Gagal Memproses';

            if (err instanceof Error) {
                errorMessage = err.message;

                // Specific error messages for common issues
                if (err.message.includes('not a PNG file')) {
                    errorTitle = 'Format Gambar Tidak Didukung';
                    errorMessage =
                        'Format gambar stempel tidak didukung. Gunakan PNG atau JPG.';
                } else if (err.message.includes('not a JPEG file')) {
                    errorTitle = 'Format JPEG Tidak Valid';
                    errorMessage = 'File JPEG tidak valid atau rusak.';
                } else if (err.message.includes('Maximum call stack')) {
                    errorTitle = 'File Terlalu Besar';
                    errorMessage = 'File PDF terlalu besar untuk diproses.';
                }
            }

            console.error('Error details:', {
                message: errorMessage,
                stack: err instanceof Error ? err.stack : undefined,
                name: err instanceof Error ? err.name : 'Unknown',
            });

            error(errorMessage);
        } finally {
            setIsProcessing(false);
        }
    }, [onSave, confirmPin, currentPage, pdfUrl, clearCanvas, barcodeData, generateQRCode, documentId, isTemplate]);

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
                        const ratio = stampImg.width / stampImg.height;
                        const drawWidth = stampSize;
                        const drawHeight = stampSize / ratio;
                        const stampX = stampPosition.x - drawWidth / 2;
                        const stampY = stampPosition.y - drawHeight / 2;

                        ctx.drawImage(
                            stampImg,
                            stampX,
                            stampY,
                            drawWidth,
                            drawHeight,
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
                const ratio = img.width / img.height;
                const drawWidth = stampSize;
                const drawHeight = stampSize / ratio;
                const stampX = stampPosition.x - drawWidth / 2;
                const stampY = stampPosition.y - drawHeight / 2;

                ctx.drawImage(img, stampX, stampY, drawWidth, drawHeight);
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
                    {/* STEP 'choose': pick how to sign */}
                    {flowStep === 'choose' && (
                        <div className="rounded-lg border-2 border-blue-100 bg-blue-50/50 p-3 sm:p-4">
                            <p className="mb-2 text-sm font-semibold text-gray-800">
                                1. Pilih cara tanda tangan
                            </p>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleUseSavedSignature}
                                    className="h-auto justify-start gap-3 border-blue-300 bg-white px-4 py-3 text-left hover:bg-blue-50"
                                >
                                    <Stamp className="h-5 w-5 shrink-0 text-blue-600" />
                                    <span>
                                        <span className="block text-sm font-medium text-gray-900">
                                            Pakai Tanda Tangan Tersimpan
                                        </span>
                                        <span className="block text-xs text-gray-500">
                                            Gambar TTD yang sudah diupload di
                                            profil
                                        </span>
                                    </span>
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setDrawingMode('pen');
                                        setFlowStep('sign');
                                    }}
                                    className="h-auto justify-start gap-3 border-blue-300 bg-white px-4 py-3 text-left hover:bg-blue-50"
                                >
                                    <PenTool className="h-5 w-5 shrink-0 text-blue-600" />
                                    <span>
                                        <span className="block text-sm font-medium text-gray-900">
                                            Gambar Langsung di Layar
                                        </span>
                                        <span className="block text-xs text-gray-500">
                                            Tulis pakai jari / mouse
                                        </span>
                                    </span>
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={useBarcodeOnly}
                                    className="h-auto justify-start gap-3 border-blue-300 bg-white px-4 py-3 text-left hover:bg-blue-50"
                                >
                                    <QrCode className="h-5 w-5 shrink-0 text-blue-600" />
                                    <span>
                                        <span className="block text-sm font-medium text-gray-900">
                                            Letakkan Barcode / QR Verifikasi
                                        </span>
                                        <span className="block text-xs text-gray-500">
                                            Pilih posisi & ukuran QR di PDF
                                        </span>
                                    </span>
                                </Button>
                                {auth.user.signature_image && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                            document
                                                .getElementById('stamp-upload')
                                                ?.click();
                                        }}
                                        className="h-auto justify-start gap-3 border-blue-300 bg-white px-4 py-3 text-left hover:bg-blue-50"
                                    >
                                        <Image className="h-5 w-5 shrink-0 text-blue-600" />
                                        <span>
                                            <span className="block text-sm font-medium text-gray-900">
                                                Upload Stempel / Gambar
                                            </span>
                                            <span className="block text-xs text-gray-500">
                                                TTD digital, stempel resmi, dll
                                            </span>
                                        </span>
                                    </Button>
                                )}
                            </div>
                            <p className="mt-2 text-xs text-gray-500">
                                Pilih salah satu cara di atas. Anda juga bisa
                                mengkombinasikannya nanti (misal gambar + QR)
                                melalui opsi lanjutan.
                            </p>
                        </div>
                    )}

                    {/* STEP 'sign': draw (only after choosing manual) */}
                    {flowStep === 'sign' && (
                        <div className="rounded-lg border-2 border-blue-100 bg-blue-50/50 p-3 sm:p-4">
                            <p className="mb-2 text-sm font-semibold text-gray-800">
                                1. Gambar tanda tangan di area PDF di atas
                            </p>
                            <p className="text-xs text-gray-500">
                                Gunakan jari / mouse untuk menulis tanda tangan
                                langsung di dokumen. Selesai menggambar akan
                                otomatis lanjut ke langkah PIN.
                            </p>
                        </div>
                    )}

                    {/* Always-visible essential actions (during sign/choose) */}
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={clearAll}
                            className="text-xs text-red-600 hover:bg-red-50 hover:text-red-700 sm:text-sm"
                        >
                            <Trash2 className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                            Hapus Coretan
                        </Button>

                        {flowStep === 'sign' && (
                            <>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setFlowStep('choose')}
                                    className="text-xs text-gray-500 sm:text-sm"
                                >
                                    Ganti cara tanda tangan
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowAdvancedTools((v) => !v)}
                                    className="ml-auto text-xs text-gray-500 sm:text-sm"
                                >
                                    {showAdvancedTools ? (
                                        <ChevronUp className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                                    ) : (
                                        <ChevronDown className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                                    )}
                                    Opsi Lanjutan (stempel, warna, ukuran)
                                </Button>
                            </>
                        )}
                    </div>

                    {/* Advanced tools, hidden by default, only during manual drawing */}
                    {showAdvancedTools && flowStep === 'sign' && (
                        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 p-2 sm:gap-4 sm:p-4">
                            <div className="flex items-center space-x-2">
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
                                    <span className="hidden sm:inline">
                                        Eraser
                                    </span>
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
                        </div>
                    )}

                    {/* STEP 'pin': only shown once a signature has been drawn/placed */}
                    {flowStep === 'pin' && (
                        <div className="sticky bottom-0 z-10 -mx-2 space-y-3 rounded-t-lg border-t-2 border-blue-100 bg-white p-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] sm:relative sm:mx-0 sm:rounded-lg sm:border sm:border-gray-200 sm:bg-gray-50 sm:shadow-none sm:p-4">
                            <p className="mb-2 text-sm font-semibold text-gray-800">
                                2. Simpan tanda tangan
                            </p>
                            <p className="mb-3 text-xs text-gray-500">
                                Tekan tombol di bawah, lalu masukkan PIN 6
                                digit Anda di kotak konfirmasi untuk
                                menyelesaikan tanda tangan.
                            </p>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="lg"
                                    onClick={backToDrawing}
                                    disabled={isProcessing}
                                    className="h-14 px-4 text-sm font-medium"
                                >
                                    Kembali
                                </Button>
                                <Button
                                    onClick={handleSave}
                                    size="lg"
                                    className="h-14 w-full bg-green-600 text-base font-semibold hover:bg-green-700"
                                    disabled={isProcessing}
                                >
                                    <Save className="mr-2 h-5 w-5" />
                                    {isProcessing
                                        ? 'Memproses...'
                                        : 'Simpan Tanda Tangan'}
                                </Button>
                            </div>
                        </div>
                    )}
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




            <AlertModal
                open={alertModal.isOpen}
                onClose={alertModal.close}
                title={alertData.title}
                description={alertData.description}
                type={alertData.type}
            />

            {/* Confirmation modal with PIN entry, shown when clicking Simpan */}
            <Dialog
                open={confirmSaveModal.isOpen}
                onOpenChange={(open) => {
                    if (!open && !isProcessing) {
                        confirmSaveModal.close();
                    }
                }}
            >
                <DialogContent className="sm:max-w-[440px]">
                    <DialogHeader>
                        <DialogTitle>Konfirmasi Tanda Tangan</DialogTitle>
                        <DialogDescription>
                            Setelah disimpan, tanda tangan ini akan tercatat
                            resmi pada{' '}
                            {isTemplate ? 'template' : 'dokumen'} ini dan
                            tidak dapat diedit. Tanda tangan hanya bisa dihapus
                            selama belum ditandatangani lengkap oleh semua
                            pihak. Masukkan PIN 6 digit Anda untuk
                            menyelesaikan.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col items-center gap-2 py-2">
                        <Label
                            htmlFor="confirm-pin"
                            className="text-sm font-medium text-gray-700"
                        >
                            PIN Digital Signature
                        </Label>
                        <InputOTP
                            id="confirm-pin"
                            maxLength={6}
                            value={confirmPin}
                            onChange={(value) => setConfirmPin(value)}
                            pattern={REGEXP_ONLY_DIGITS}
                            inputMode="numeric"
                            autoComplete="one-time-code"
                        >
                            <InputOTPGroup>
                                {Array.from({ length: 6 }, (_, index) => (
                                    <InputOTPSlot
                                        key={index}
                                        index={index}
                                        className="h-12 w-10 text-base sm:w-11 sm:text-lg"
                                    />
                                ))}
                            </InputOTPGroup>
                        </InputOTP>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={confirmSaveModal.close}
                            disabled={isProcessing}
                        >
                            Batal
                        </Button>
                        <Button
                            onClick={() => {
                                if (confirmPin.length !== 6) {
                                    error(
                                        'PIN harus 6 digit angka sebelum menyimpan.',
                                    );
                                    return;
                                }
                                performSave();
                            }}
                            disabled={isProcessing || confirmPin.length !== 6}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            <Save className="mr-1 h-4 w-4" />
                            {isProcessing
                                ? 'Memproses...'
                                : 'Ya, Simpan Tanda Tangan'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
}
