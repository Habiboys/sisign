import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PenTool, Trash2, Upload } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

interface SignatureCanvasProps {
    onSignatureChange: (signatureData: string | null) => void;
    initialSignature?: string | null;
}

export default function SignatureCanvas({
    onSignatureChange,
    initialSignature,
}: SignatureCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [signatureMethod, setSignatureMethod] = useState<'draw' | 'upload'>(
        'draw',
    );

    const startDrawing = useCallback(
        (e: React.MouseEvent<HTMLCanvasElement>) => {
            if (signatureMethod !== 'draw') return;

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
        [signatureMethod],
    );

    const draw = useCallback(
        (e: React.MouseEvent<HTMLCanvasElement>) => {
            if (!isDrawing || signatureMethod !== 'draw') return;

            const canvas = canvasRef.current;
            if (!canvas) return;

            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.lineTo(x, y);
            ctx.stroke();
        },
        [isDrawing, signatureMethod],
    );

    const stopDrawing = useCallback(() => {
        if (!isDrawing) return;

        setIsDrawing(false);
        const canvas = canvasRef.current;
        if (!canvas) return;

        const signatureData = canvas.toDataURL('image/png');
        onSignatureChange(signatureData);
    }, [isDrawing, onSignatureChange]);

    const clearCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        onSignatureChange(null);
    }, [onSignatureChange]);

    const handleFileUpload = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                const result = event.target?.result as string;
                onSignatureChange(result);
            };
            reader.readAsDataURL(file);
        },
        [onSignatureChange],
    );

    const initializeCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size
        canvas.width = 400;
        canvas.height = 200;

        // Set drawing style
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Load initial signature if provided
        if (initialSignature && signatureMethod === 'draw') {
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0);
            };
            img.src = initialSignature;
        }
    }, [initialSignature, signatureMethod]);

    // Initialize canvas on mount
    useState(() => {
        initializeCanvas();
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center">
                    <PenTool className="mr-2 h-5 w-5" />
                    Tanda Tangan Digital
                </CardTitle>
                <CardDescription>
                    Pilih metode tanda tangan digital
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Method Selection */}
                <div className="flex space-x-2">
                    <Button
                        variant={
                            signatureMethod === 'draw' ? 'default' : 'outline'
                        }
                        onClick={() => setSignatureMethod('draw')}
                        className="flex-1"
                    >
                        <PenTool className="mr-2 h-4 w-4" />
                        Gambar Tanda Tangan
                    </Button>
                    <Button
                        variant={
                            signatureMethod === 'upload' ? 'default' : 'outline'
                        }
                        onClick={() => setSignatureMethod('upload')}
                        className="flex-1"
                    >
                        <Upload className="mr-2 h-4 w-4" />
                        Upload File
                    </Button>
                </div>

                {/* Drawing Canvas */}
                {signatureMethod === 'draw' && (
                    <div className="space-y-4">
                        <div className="rounded-lg border-2 border-dashed border-gray-300 p-4">
                            <canvas
                                ref={canvasRef}
                                className="mx-auto block w-full max-w-md cursor-crosshair rounded border border-gray-200"
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                                style={{ touchAction: 'none' }}
                            />
                        </div>
                        <div className="flex justify-center space-x-2">
                            <Button
                                variant="outline"
                                onClick={clearCanvas}
                                className="text-red-600 hover:text-red-700"
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Hapus
                            </Button>
                        </div>
                    </div>
                )}

                {/* File Upload */}
                {signatureMethod === 'upload' && (
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="signature-file">
                                Upload File Tanda Tangan
                            </Label>
                            <Input
                                ref={fileInputRef}
                                id="signature-file"
                                type="file"
                                accept="image/*"
                                onChange={handleFileUpload}
                                className="mt-1"
                            />
                            <p className="mt-1 text-sm text-gray-500">
                                Format yang didukung: PNG, JPG, JPEG (MAX. 2MB)
                            </p>
                        </div>
                    </div>
                )}

                {/* Preview */}
                {initialSignature && (
                    <div className="space-y-2">
                        <Label>Preview Tanda Tangan:</Label>
                        <div className="rounded border border-gray-200 p-2">
                            <img
                                src={initialSignature}
                                alt="Signature Preview"
                                className="mx-auto h-auto max-h-32 max-w-full"
                            />
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}


